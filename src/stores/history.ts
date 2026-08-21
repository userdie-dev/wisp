import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import { openPersistedStore, type PersistedStore } from '@/lib/persisted-store'
import { isTauri } from '@/lib/tauri-env'

export interface HistoryEntry {
  id: string
  url: string
  title: string
  favicon: string | null
  visitedAt: number
}

const MAX_ENTRIES = 10_000

let storePromise: Promise<PersistedStore> | null = null
function historyStore(): Promise<PersistedStore> {
  return (storePromise ??= openPersistedStore('history.json'))
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const ready = ref(false)

  async function load() {
    entries.value = (await (await historyStore()).get<HistoryEntry[]>('entries')) ?? []
    ready.value = true
  }
  load()

  async function persist() {
    if (!ready.value) return
    await (await historyStore()).set('entries', entries.value)
  }

  // Same `tab-updated` event the tabs store listens to (see stores/tabs.ts) —
  // both subscribe independently, since they react to different fields.
  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ id: string; url?: string; title?: string }>('tab-updated', (event) => {
        if (!event.payload.url) return
        recordVisit(event.payload.url, event.payload.title ?? event.payload.url)
      })
    })
  }

  function recordVisit(url: string, title: string, favicon: string | null = null) {
    entries.value.unshift({ id: nanoid(), url, title, favicon, visitedAt: Date.now() })
    if (entries.value.length > MAX_ENTRIES) entries.value.length = MAX_ENTRIES
    persist()
  }

  function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    persist()
  }

  function clearAll() {
    entries.value = []
    persist()
  }

  function clearSince(msAgo: number) {
    const cutoff = Date.now() - msAgo
    entries.value = entries.value.filter((e) => e.visitedAt < cutoff)
    persist()
  }

  return { entries, recordVisit, removeEntry, clearAll, clearSince }
})
