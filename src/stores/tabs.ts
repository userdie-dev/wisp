import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import { isTauri } from '@/lib/tauri-env'

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

  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ id: string; url?: string; title?: string }>('tab-updated', (event) => {
        const tab = tabs.value.find((t) => t.id === event.payload.id)
        if (!tab) return
        if (event.payload.url !== undefined) tab.url = event.payload.url
        if (event.payload.title !== undefined) tab.title = event.payload.title
        tab.loading = false
      })
    })
  }

  async function createTab(url?: string): Promise<string> {
    const id = nanoid()
    const tab: Tab = {
      id,
      url: url ?? '',
      title: url ? url : 'Новая вкладка',
      favicon: null,
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
    tab.loading = true

    if (!isTauri()) return
    if (tab.pending) {
      await invoke('tabs_create', { id, url })
      tab.pending = false
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

  return {
    tabs,
    activeTabId,
    activeInternalPage,
    createTab,
    navigate,
    closeTab,
    activateTab,
    showInternalPage,
    goBack,
    goForward,
    reload,
  }
})
