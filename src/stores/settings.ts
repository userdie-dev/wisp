import { defineStore } from 'pinia'
import { ref, watch, watchEffect } from 'vue'
import { openPersistedStore, type PersistedStore } from '@/lib/persisted-store'
import { BUILT_IN_SEARCH_ENGINES, type SearchEngine } from '@/lib/search-engines'

export type Theme = 'system' | 'light' | 'dark'
/** What to show when the app starts — see docs/features/session-restore.md. */
export type StartupBehavior = 'restore' | 'newTab'

let storePromise: Promise<PersistedStore> | null = null
function settingsStore(): Promise<PersistedStore> {
  return (storePromise ??= openPersistedStore('settings.json'))
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<Theme>('system')
  const searchEngineId = ref<string>('google')
  const customSearchEngines = ref<SearchEngine[]>([])
  const sidebarCollapsed = ref(false)
  const updatesAutoCheck = ref(true)
  const startupBehavior = ref<StartupBehavior>('restore')
  /** Download destination folder. `null` = the OS "Downloads" folder. Applied
   * to the Rust side on startup — see docs/features/downloads.md. */
  const downloadsDir = ref<string | null>(null)
  const ready = ref(false)

  const systemPrefersDark = ref(
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)').matches : false,
  )
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches
    })
  }

  async function load() {
    const store = await settingsStore()
    theme.value = (await store.get<Theme>('theme')) ?? 'system'
    searchEngineId.value = (await store.get<string>('searchEngineId')) ?? 'google'
    customSearchEngines.value = (await store.get<SearchEngine[]>('customSearchEngines')) ?? []
    sidebarCollapsed.value = (await store.get<boolean>('sidebarCollapsed')) ?? false
    updatesAutoCheck.value = (await store.get<boolean>('updatesAutoCheck')) ?? true
    startupBehavior.value = (await store.get<StartupBehavior>('startupBehavior')) ?? 'restore'
    downloadsDir.value = (await store.get<string>('downloadsDir')) ?? null
    ready.value = true
  }
  /** Resolves once persisted settings have loaded — awaited by consumers that
   * must read a setting before acting (e.g. session restore in stores/tabs.ts). */
  const loaded = load()

  watch(theme, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('theme', value)
  })
  watch(
    customSearchEngines,
    async (value) => {
      if (!ready.value) return
      ;(await settingsStore()).set('customSearchEngines', value)
    },
    { deep: true },
  )
  watch(searchEngineId, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('searchEngineId', value)
  })
  watch(sidebarCollapsed, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('sidebarCollapsed', value)
  })
  watch(updatesAutoCheck, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('updatesAutoCheck', value)
  })
  watch(startupBehavior, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('startupBehavior', value)
  })
  watch(downloadsDir, async (value) => {
    if (!ready.value) return
    ;(await settingsStore()).set('downloadsDir', value)
  })

  watchEffect(() => {
    const isDark = theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark.value)
    document.documentElement.classList.toggle('dark', isDark)
  })

  const allSearchEngines = () => [...BUILT_IN_SEARCH_ENGINES, ...customSearchEngines.value]

  function activeSearchEngine(): SearchEngine {
    return allSearchEngines().find((e) => e.id === searchEngineId.value) ?? BUILT_IN_SEARCH_ENGINES[0]
  }

  function addCustomSearchEngine(engine: SearchEngine) {
    customSearchEngines.value.push(engine)
  }

  function removeCustomSearchEngine(id: string) {
    customSearchEngines.value = customSearchEngines.value.filter((e) => e.id !== id)
    if (searchEngineId.value === id) searchEngineId.value = 'google'
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    theme,
    searchEngineId,
    customSearchEngines,
    sidebarCollapsed,
    updatesAutoCheck,
    startupBehavior,
    downloadsDir,
    loaded,
    toggleSidebar,
    allSearchEngines,
    activeSearchEngine,
    addCustomSearchEngine,
    removeCustomSearchEngine,
  }
})
