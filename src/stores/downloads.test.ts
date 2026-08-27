import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const isTauriMock = vi.fn(() => true)
vi.mock('@/lib/tauri-env', () => ({ isTauri: () => isTauriMock() }))

const eventListeners = new Map<string, (event: { payload: unknown }) => void>()
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: { payload: unknown }) => void) => {
    eventListeners.set(name, cb)
    return Promise.resolve(() => {})
  }),
}))

const openPath = vi.fn().mockResolvedValue(undefined)
const revealItemInDir = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath, revealItemInDir }))

// In-memory persisted store keyed off localStorage, matching the non-Tauri
// fallback shape without needing the Tauri runtime.
vi.mock('@/lib/persisted-store', () => ({
  openPersistedStore: async (file: string) => ({
    get: async (key: string) => {
      const raw = localStorage.getItem(`${file}:${key}`)
      return raw ? JSON.parse(raw) : null
    },
    set: async (key: string, value: unknown) => {
      localStorage.setItem(`${file}:${key}`, JSON.stringify(value))
    },
  }),
}))

import { useDownloadsStore } from './downloads'

function emit(name: string, payload: unknown) {
  eventListeners.get(name)?.({ payload })
}

/** Lets the store's dynamic `import('@tauri-apps/api/event')` resolve. */
async function freshStore() {
  const store = useDownloadsStore()
  await new Promise((r) => setTimeout(r))
  return store
}

describe('downloads store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isTauriMock.mockReturnValue(true)
    eventListeners.clear()
    openPath.mockClear()
    revealItemInDir.mockClear()
    localStorage.clear()
  })

  it('adds an in-progress item on download-started (newest first)', async () => {
    const store = await freshStore()

    emit('download-started', { id: '0', url: 'https://x.test/a.zip', filename: 'a.zip', path: '/d/a.zip' })
    emit('download-started', { id: '1', url: 'https://x.test/b.zip', filename: 'b.zip', path: '/d/b.zip' })

    expect(store.items.map((i) => i.id)).toEqual(['1', '0'])
    expect(store.items[0].state).toBe('in_progress')
  })

  it('marks the matching item done/failed on download-finished', async () => {
    const store = await freshStore()
    emit('download-started', { id: '0', url: 'https://x.test/a.zip', filename: 'a.zip', path: '/d/a.zip' })

    emit('download-finished', { url: 'https://x.test/a.zip', path: '/d/final/a.zip', success: true })

    expect(store.items[0].state).toBe('done')
    expect(store.items[0].path).toBe('/d/final/a.zip')
  })

  it('does not open a file that is not finished', async () => {
    const store = await freshStore()
    emit('download-started', { id: '0', url: 'https://x.test/a.zip', filename: 'a.zip', path: '/d/a.zip' })

    await store.openFile(store.items[0])
    expect(openPath).not.toHaveBeenCalled()

    emit('download-finished', { url: 'https://x.test/a.zip', path: null, success: true })
    await store.openFile(store.items[0])
    expect(openPath).toHaveBeenCalledWith('/d/a.zip')
  })

  it('clearFinished keeps only running downloads', async () => {
    const store = await freshStore()
    emit('download-started', { id: '0', url: 'https://x.test/a.zip', filename: 'a.zip', path: '/d/a.zip' })
    emit('download-started', { id: '1', url: 'https://x.test/b.zip', filename: 'b.zip', path: '/d/b.zip' })
    emit('download-finished', { url: 'https://x.test/a.zip', path: null, success: true })

    store.clearFinished()

    expect(store.items.map((i) => i.id)).toEqual(['1'])
  })

  it('revives stale in-progress items as failed on load', async () => {
    localStorage.setItem(
      'downloads.json:items',
      JSON.stringify([
        { id: '0', url: 'u', filename: 'f', path: 'p', state: 'in_progress', startedAt: 1 },
      ]),
    )
    const store = await freshStore()
    expect(store.items[0].state).toBe('failed')
  })
})
