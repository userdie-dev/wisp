import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import { isTauri } from '@/lib/tauri-env'
import { openPersistedStore, type PersistedStore } from '@/lib/persisted-store'
import { useSettingsStore } from '@/stores/settings'
import { faviconFor } from '@/lib/favicon'

export interface Tab {
  id: string
  url: string
  title: string
  favicon: string | null
  loading: boolean
  createdAt: number
  /** True for a freshly-opened tab with no page loaded yet — no Rust-side
   * webview exists until the first navigation, see docs/features/tabs.md. */
  pending: boolean
  /** True for a session-restored tab whose native webview hasn't been created
   * yet — created lazily on first activation. See docs/features/session-restore.md. */
  unloaded?: boolean
  /** Back/forward availability from the Rust-side history model, delivered via
   * the `tab-nav-state` event. See docs/features/navigation-state.md. */
  canGoBack?: boolean
  canGoForward?: boolean
}

interface SavedTab {
  id: string
  url: string
  title: string
  favicon: string | null
  pending: boolean
  createdAt: number
}
interface SavedSession {
  tabs: SavedTab[]
  activeTabId: string | null
}

let sessionStorePromise: Promise<PersistedStore> | null = null
function sessionStore(): Promise<PersistedStore> {
  return (sessionStorePromise ??= openPersistedStore('session.json'))
}

export type InternalPage = 'history' | 'bookmarks' | 'settings' | null

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)
  const activeInternalPage = ref<InternalPage>(null)
  /** Flips to true once session restore has finished; gates session autosave. */
  const ready = ref(false)

  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ id: string; url?: string; title?: string; loading?: boolean }>(
        'tab-updated',
        (event) => {
          const tab = tabs.value.find((t) => t.id === event.payload.id)
          if (!tab) return
          if (event.payload.url !== undefined && event.payload.url !== tab.url) {
            tab.url = event.payload.url
            // The page's real favicon isn't observable from here — guess it
            // from the origin. See docs/features/favicons.md.
            tab.favicon = faviconFor(event.payload.url)
          }
          if (event.payload.title !== undefined) tab.title = event.payload.title
          if (event.payload.loading !== undefined) tab.loading = event.payload.loading
        },
      )
      listen<{ id: string; canGoBack: boolean; canGoForward: boolean }>(
        'tab-nav-state',
        (event) => {
          const tab = tabs.value.find((t) => t.id === event.payload.id)
          if (!tab) return
          tab.canGoBack = event.payload.canGoBack
          tab.canGoForward = event.payload.canGoForward
        },
      )
    })
  }

  /** Restore last session's tabs, or not, per the `startupBehavior` setting.
   * Called once from App.vue before the "no tabs → open one" fallback.
   * See docs/features/session-restore.md. */
  async function restoreSession(): Promise<void> {
    try {
      const settings = useSettingsStore()
      await settings.loaded
      if (settings.startupBehavior === 'restore') {
        const saved = await (await sessionStore()).get<SavedSession>('session')
        if (saved && saved.tabs.length > 0) {
          for (const t of saved.tabs) {
            tabs.value.push({
              id: t.id,
              url: t.url,
              title: t.title,
              favicon: t.favicon,
              loading: false,
              createdAt: t.createdAt,
              pending: t.pending,
              unloaded: !t.pending,
            })
          }
          const target =
            (saved.activeTabId && tabs.value.some((t) => t.id === saved.activeTabId)
              ? saved.activeTabId
              : tabs.value[tabs.value.length - 1]?.id) ?? null
          if (target) await activateTab(target)
        }
      }
    } finally {
      ready.value = true
    }
  }

  async function persistSession(): Promise<void> {
    if (!ready.value) return
    const payload: SavedSession = {
      tabs: tabs.value.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        favicon: t.favicon,
        pending: t.pending,
        createdAt: t.createdAt,
      })),
      activeTabId: activeTabId.value,
    }
    await (await sessionStore()).set('session', payload)
  }
  watch([tabs, activeTabId], persistSession, { deep: true })

  async function createTab(url?: string): Promise<string> {
    const id = nanoid()
    const tab: Tab = {
      id,
      url: url ?? '',
      title: url ? url : 'Новая вкладка',
      favicon: url ? faviconFor(url) : null,
      loading: !!url,
      createdAt: Date.now(),
      pending: !url,
    }
    tabs.value.push(tab)

    if (url && isTauri()) {
      await invoke('tabs_create', { id, url })
    }
    await activateTab(id)
    return id
  }

  /** Called when a pending (empty) tab's omnibox is submitted for the first time. */
  async function navigate(id: string, url: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return
    tab.url = url
    tab.favicon = faviconFor(url)
    tab.loading = true
    const wasPending = tab.pending
    tab.pending = false // clears the start page regardless of Tauri availability

    if (!isTauri()) return
    if (wasPending) {
      await invoke('tabs_create', { id, url })
      await invoke('tabs_activate', { id })
    } else {
      await invoke('tabs_navigate', { id, url })
    }
  }

  async function closeTab(id: string): Promise<void> {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return
    const wasActive = activeTabId.value === id

    if (isTauri() && !tabs.value[index].pending) {
      await invoke('tabs_close', { id })
    }
    tabs.value.splice(index, 1)

    if (wasActive) {
      const next = tabs.value[index] ?? tabs.value[index - 1]
      if (next) await activateTab(next.id)
      else activeTabId.value = null
    }
  }

  async function activateTab(id: string): Promise<void> {
    activeInternalPage.value = null
    activeTabId.value = id
    const tab = tabs.value.find((t) => t.id === id)
    if (!isTauri()) return
    if (tab && !tab.pending) {
      if (tab.unloaded) {
        // Session-restored tab: its native webview was never created. Do it
        // now, on first activation — see docs/features/session-restore.md.
        tab.unloaded = false
        tab.loading = true
        await invoke('tabs_create', { id, url: tab.url })
      }
      await invoke('tabs_activate', { id })
    } else {
      // Pending tab has no webview of its own — render the start page in the
      // chrome webview instead, same as an internal page (see
      // docs/features/start-page.md). Still need to hide whatever tab
      // webview was showing before.
      await invoke('show_internal_page')
    }
  }

  async function showInternalPage(page: Exclude<InternalPage, null>): Promise<void> {
    activeTabId.value = null
    activeInternalPage.value = page
    if (isTauri()) await invoke('show_internal_page')
  }

  async function goBack(id: string): Promise<void> {
    if (isTauri()) await invoke('tabs_back', { id })
  }
  async function goForward(id: string): Promise<void> {
    if (isTauri()) await invoke('tabs_forward', { id })
  }
  async function reload(id: string): Promise<void> {
    if (isTauri()) await invoke('tabs_reload', { id })
  }
  async function stop(id: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) tab.loading = false
    if (isTauri()) await invoke('tabs_stop', { id })
  }

  /** Called from TabItem's `<img @error>` when a guessed favicon 404s. */
  function clearFavicon(id: string): void {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) tab.favicon = null
  }

  return {
    tabs,
    activeTabId,
    activeInternalPage,
    ready,
    restoreSession,
    createTab,
    navigate,
    closeTab,
    activateTab,
    showInternalPage,
    goBack,
    goForward,
    reload,
    stop,
    clearFavicon,
  }
})
