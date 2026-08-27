import { defineStore } from 'pinia'
import { ref } from 'vue'
import { openPersistedStore, type PersistedStore } from '@/lib/persisted-store'
import { isTauri } from '@/lib/tauri-env'

export type DownloadState = 'in_progress' | 'done' | 'failed'

export interface DownloadItem {
  /** Monotonic id from Rust (`download-started`). */
  id: string
  url: string
  filename: string
  path: string
  state: DownloadState
  startedAt: number
}

const MAX_ENTRIES = 200

let storePromise: Promise<PersistedStore> | null = null
function downloadsStore(): Promise<PersistedStore> {
  return (storePromise ??= openPersistedStore('downloads.json'))
}

/**
 * Download history + actions. Fed by the Rust `download-started` /
 * `download-finished` events (Wry exposes no byte-level progress, only request
 * and completion) — see docs/features/downloads.md.
 */
export const useDownloadsStore = defineStore('downloads', () => {
  const items = ref<DownloadItem[]>([])
  const ready = ref(false)

  async function load() {
    items.value = (await (await downloadsStore()).get<DownloadItem[]>('items')) ?? []
    // A download still "in progress" from a previous run can never resume.
    for (const item of items.value) {
      if (item.state === 'in_progress') item.state = 'failed'
    }
    ready.value = true
  }
  load()

  async function persist() {
    if (!ready.value) return
    await (await downloadsStore()).set('items', items.value)
  }

  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ id: string; url: string; filename: string; path: string }>(
        'download-started',
        (event) => {
          items.value.unshift({
            id: event.payload.id,
            url: event.payload.url,
            filename: event.payload.filename,
            path: event.payload.path,
            state: 'in_progress',
            startedAt: Date.now(),
          })
          if (items.value.length > MAX_ENTRIES) items.value.length = MAX_ENTRIES
          persist()
        },
      )
      // `Finished` carries no id, only the url — match the most recent
      // still-running download of that url.
      listen<{ url: string; path: string | null; success: boolean }>(
        'download-finished',
        (event) => {
          const item = items.value.find(
            (i) => i.state === 'in_progress' && i.url === event.payload.url,
          )
          if (!item) return
          item.state = event.payload.success ? 'done' : 'failed'
          if (event.payload.path) item.path = event.payload.path
          persist()
        },
      )
    })
  }

  async function openFile(item: DownloadItem): Promise<void> {
    if (!isTauri() || item.state !== 'done') return
    const { openPath } = await import('@tauri-apps/plugin-opener')
    await openPath(item.path)
  }

  async function showInFolder(item: DownloadItem): Promise<void> {
    if (!isTauri()) return
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(item.path)
  }

  function remove(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
    persist()
  }

  function clearFinished(): void {
    items.value = items.value.filter((i) => i.state === 'in_progress')
    persist()
  }

  return { items, ready, openFile, showInFolder, remove, clearFinished }
})
