import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const isTauriMock = vi.fn(() => false)
vi.mock('@/lib/tauri-env', () => ({ isTauri: () => isTauriMock() }))

const checkMock = vi.fn()
vi.mock('@tauri-apps/plugin-updater', () => ({ check: (...a: unknown[]) => checkMock(...a) }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('9.9.9') }))

import { useUpdaterStore } from './updater'

describe('updater store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isTauriMock.mockReturnValue(false)
    checkMock.mockReset()
  })

  it('reports unsupported and never calls the plugin outside Tauri', async () => {
    const store = useUpdaterStore()
    expect(store.status).toBe('unsupported')
    await store.check()
    expect(checkMock).not.toHaveBeenCalled()
    expect(store.status).toBe('unsupported')
  })

  it('goes to "available" and keeps the update info when the plugin finds one', async () => {
    isTauriMock.mockReturnValue(true)
    checkMock.mockResolvedValue({
      version: '1.2.3',
      body: 'notes here',
      date: '2026-01-01',
      downloadAndInstall: vi.fn(),
    })
    const store = useUpdaterStore()

    await store.check()

    expect(store.status).toBe('available')
    expect(store.info).toEqual({ version: '1.2.3', notes: 'notes here', date: '2026-01-01' })
    expect(store.bannerDismissed).toBe(false)
  })

  it('reports "upToDate" on a non-silent check with no update', async () => {
    isTauriMock.mockReturnValue(true)
    checkMock.mockResolvedValue(null)
    const store = useUpdaterStore()

    await store.check()
    expect(store.status).toBe('upToDate')
  })

  it('stays "idle" on a silent check with no update', async () => {
    isTauriMock.mockReturnValue(true)
    checkMock.mockResolvedValue(null)
    const store = useUpdaterStore()

    await store.check({ silent: true })
    expect(store.status).toBe('idle')
  })

  it('surfaces errors only on non-silent checks', async () => {
    isTauriMock.mockReturnValue(true)
    checkMock.mockRejectedValue(new Error('network down'))
    const store = useUpdaterStore()

    await store.check({ silent: true })
    expect(store.status).toBe('idle')

    await store.check()
    expect(store.status).toBe('error')
    expect(store.error).toBe('network down')
  })

  it('downloadAndInstall drives progress then lands on "ready"', async () => {
    isTauriMock.mockReturnValue(true)
    type Cb = (e: unknown) => void
    const downloadAndInstall = vi.fn(async (cb: Cb) => {
      cb({ event: 'Started', data: { contentLength: 100 } })
      cb({ event: 'Progress', data: { chunkLength: 40 } })
      cb({ event: 'Progress', data: { chunkLength: 60 } })
      cb({ event: 'Finished' })
    })
    checkMock.mockResolvedValue({ version: '1.2.3', body: '', date: undefined, downloadAndInstall })
    const store = useUpdaterStore()

    await store.check()
    await store.downloadAndInstall()

    expect(store.contentLength).toBe(100)
    expect(store.downloaded).toBe(100)
    expect(store.status).toBe('ready')
  })
})
