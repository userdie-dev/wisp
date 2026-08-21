import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const isTauriMock = vi.fn(() => false)
vi.mock('@/lib/tauri-env', () => ({ isTauri: () => isTauriMock() }))

const invokeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { useTabsStore } from './tabs'

describe('tabs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isTauriMock.mockReturnValue(false)
    invokeMock.mockClear()
  })

  describe('createTab', () => {
    it('creates a pending tab when no url is given', async () => {
      const store = useTabsStore()
      const id = await store.createTab()
      const tab = store.tabs.find((t) => t.id === id)
      expect(tab?.pending).toBe(true)
      expect(tab?.url).toBe('')
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('creates a non-pending, loading tab when a url is given outside Tauri', async () => {
      const store = useTabsStore()
      const id = await store.createTab('https://example.com')
      const tab = store.tabs.find((t) => t.id === id)
      expect(tab?.pending).toBe(false)
      expect(tab?.loading).toBe(true)
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('invokes tabs_create when a url is given inside Tauri', async () => {
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      const id = await store.createTab('https://example.com')
      expect(invokeMock).toHaveBeenCalledWith('tabs_create', { id, url: 'https://example.com' })
    })
  })

  describe('navigate', () => {
    it('clears the pending flag on a pending tab even outside Tauri', async () => {
      // Regression test: the pending flag used to only clear inside the
      // `if (!isTauri()) return` guard, so a pending tab navigated during
      // `pnpm dev` (no Tauri runtime) never left the start page.
      const store = useTabsStore()
      const id = await store.createTab()
      expect(store.tabs.find((t) => t.id === id)?.pending).toBe(true)

      await store.navigate(id, 'https://example.com')

      const tab = store.tabs.find((t) => t.id === id)
      expect(tab?.pending).toBe(false)
      expect(tab?.url).toBe('https://example.com')
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('invokes tabs_create for a pending tab\'s first navigation inside Tauri', async () => {
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      const id = await store.createTab()
      invokeMock.mockClear()

      await store.navigate(id, 'https://example.com')

      expect(invokeMock).toHaveBeenCalledWith('tabs_create', { id, url: 'https://example.com' })
      expect(store.tabs.find((t) => t.id === id)?.pending).toBe(false)
    })

    it('invokes tabs_navigate for a non-pending tab inside Tauri', async () => {
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      const id = await store.createTab('https://example.com')
      invokeMock.mockClear()

      await store.navigate(id, 'https://example.org')

      expect(invokeMock).toHaveBeenCalledWith('tabs_navigate', { id, url: 'https://example.org' })
    })

    it('is a no-op for an unknown tab id', async () => {
      const store = useTabsStore()
      await expect(store.navigate('missing', 'https://example.com')).resolves.toBeUndefined()
      expect(invokeMock).not.toHaveBeenCalled()
    })
  })

  describe('closeTab', () => {
    it('removes the tab and activates the next one', async () => {
      const store = useTabsStore()
      const first = await store.createTab('https://a.test')
      const second = await store.createTab('https://b.test')
      expect(store.activeTabId).toBe(second)

      await store.closeTab(second)

      expect(store.tabs.map((t) => t.id)).toEqual([first])
      expect(store.activeTabId).toBe(first)
    })

    it('does not invoke tabs_close for a pending tab', async () => {
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      const id = await store.createTab()
      invokeMock.mockClear()

      await store.closeTab(id)

      expect(invokeMock).not.toHaveBeenCalledWith('tabs_close', expect.anything())
    })
  })
})
