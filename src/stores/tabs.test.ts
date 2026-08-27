import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const isTauriMock = vi.fn(() => false)
vi.mock('@/lib/tauri-env', () => ({ isTauri: () => isTauriMock() }))

const invokeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

const eventListeners = new Map<string, (event: { payload: unknown }) => void>()
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: { payload: unknown }) => void) => {
    eventListeners.set(name, cb)
    return Promise.resolve(() => {})
  }),
}))

import { useTabsStore } from './tabs'

/** Fires a Rust-emitted event into whatever handler the store registered. */
function emit(name: string, payload: unknown) {
  eventListeners.get(name)?.({ payload })
}

describe('tabs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    isTauriMock.mockReturnValue(false)
    invokeMock.mockClear()
    eventListeners.clear()
    localStorage.clear()
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

    it('invokes tabs_create then tabs_activate for a pending tab\'s first navigation inside Tauri', async () => {
      // Regression test: tabs_create alone leaves the new webview hidden
      // (Rust creates it hidden and expects an explicit activate) — without
      // the follow-up tabs_activate call, the content area stays blank.
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      const id = await store.createTab()
      invokeMock.mockClear()

      await store.navigate(id, 'https://example.com')

      expect(invokeMock).toHaveBeenCalledWith('tabs_create', { id, url: 'https://example.com' })
      expect(invokeMock).toHaveBeenCalledWith('tabs_activate', { id })
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

  describe('restoreSession', () => {
    function seedSession(session: unknown) {
      localStorage.setItem('session.json:session', JSON.stringify(session))
    }

    it('restores saved tabs and the saved active tab by default', async () => {
      seedSession({
        tabs: [
          { id: 'a', url: 'https://a.test', title: 'A', favicon: null, pending: false, createdAt: 1 },
          { id: 'b', url: '', title: 'Новая вкладка', favicon: null, pending: true, createdAt: 2 },
        ],
        activeTabId: 'a',
      })
      const store = useTabsStore()

      await store.restoreSession()

      expect(store.tabs.map((t) => t.id)).toEqual(['a', 'b'])
      expect(store.activeTabId).toBe('a')
      expect(store.ready).toBe(true)
      // Restored non-pending tab has no webview yet.
      expect(store.tabs.find((t) => t.id === 'a')?.unloaded).toBe(true)
      expect(store.tabs.find((t) => t.id === 'b')?.unloaded).toBe(false)
    })

    it('falls back to the last tab when the saved active id is gone', async () => {
      seedSession({
        tabs: [
          { id: 'a', url: 'https://a.test', title: 'A', favicon: null, pending: false, createdAt: 1 },
        ],
        activeTabId: 'missing',
      })
      const store = useTabsStore()

      await store.restoreSession()

      expect(store.activeTabId).toBe('a')
    })

    it('does not restore when startupBehavior is newTab', async () => {
      localStorage.setItem('settings.json:startupBehavior', JSON.stringify('newTab'))
      seedSession({
        tabs: [
          { id: 'a', url: 'https://a.test', title: 'A', favicon: null, pending: false, createdAt: 1 },
        ],
        activeTabId: 'a',
      })
      const store = useTabsStore()

      await store.restoreSession()

      expect(store.tabs).toHaveLength(0)
      expect(store.ready).toBe(true)
    })

    it('is a no-op with an empty saved session', async () => {
      const store = useTabsStore()
      await store.restoreSession()
      expect(store.tabs).toHaveLength(0)
      expect(store.ready).toBe(true)
    })

    it('persists the session after restore completes', async () => {
      const store = useTabsStore()
      await store.restoreSession()
      await store.createTab('https://a.test')

      await new Promise((r) => setTimeout(r))
      const saved = JSON.parse(localStorage.getItem('session.json:session') ?? '{}')
      expect(saved.tabs.map((t: { url: string }) => t.url)).toEqual(['https://a.test'])
      expect(saved.activeTabId).toBe(store.activeTabId)
    })

    it('lazily creates the native webview when a restored tab is first activated', async () => {
      seedSession({
        tabs: [
          { id: 'a', url: 'https://a.test', title: 'A', favicon: null, pending: false, createdAt: 1 },
          { id: 'b', url: 'https://b.test', title: 'B', favicon: null, pending: false, createdAt: 2 },
        ],
        activeTabId: 'a',
      })
      const store = useTabsStore()
      await store.restoreSession()

      isTauriMock.mockReturnValue(true)
      invokeMock.mockClear()

      await store.activateTab('b')

      expect(invokeMock).toHaveBeenCalledWith('tabs_create', { id: 'b', url: 'https://b.test' })
      expect(invokeMock).toHaveBeenCalledWith('tabs_activate', { id: 'b' })
      expect(store.tabs.find((t) => t.id === 'b')?.unloaded).toBe(false)

      invokeMock.mockClear()
      await store.activateTab('b')
      expect(invokeMock).not.toHaveBeenCalledWith('tabs_create', expect.anything())
    })
  })

  describe('Rust events', () => {
    async function tauriStore() {
      isTauriMock.mockReturnValue(true)
      const store = useTabsStore()
      // Let the dynamic `import('@tauri-apps/api/event')` in the store resolve
      // so its `listen(...)` calls register into eventListeners.
      await new Promise((r) => setTimeout(r))
      const id = await store.createTab('https://example.com/page')
      return { store, id }
    }

    it('applies the loading flag from tab-updated instead of always clearing it', async () => {
      const { store, id } = await tauriStore()

      emit('tab-updated', { id, url: 'https://example.com/page', loading: false })
      expect(store.tabs.find((t) => t.id === id)?.loading).toBe(false)

      emit('tab-updated', { id, loading: true })
      expect(store.tabs.find((t) => t.id === id)?.loading).toBe(true)

      // A title-only update must not disturb the loading flag.
      emit('tab-updated', { id, title: 'Example' })
      expect(store.tabs.find((t) => t.id === id)?.loading).toBe(true)
    })

    it('guesses a favicon when the url changes', async () => {
      const { store, id } = await tauriStore()

      emit('tab-updated', { id, url: 'https://other.test/deep' })

      const tab = store.tabs.find((t) => t.id === id)
      expect(tab?.url).toBe('https://other.test/deep')
      expect(tab?.favicon).toBe('https://other.test/favicon.ico')
    })

    it('tracks back/forward availability from tab-nav-state', async () => {
      const { store, id } = await tauriStore()

      emit('tab-nav-state', { id, canGoBack: true, canGoForward: false })

      const tab = store.tabs.find((t) => t.id === id)
      expect(tab?.canGoBack).toBe(true)
      expect(tab?.canGoForward).toBe(false)
    })

    it('clearFavicon resets a bad guess', async () => {
      const { store, id } = await tauriStore()
      emit('tab-updated', { id, url: 'https://other.test/' })
      expect(store.tabs.find((t) => t.id === id)?.favicon).toBe('https://other.test/favicon.ico')

      store.clearFavicon(id)
      expect(store.tabs.find((t) => t.id === id)?.favicon).toBeNull()
    })
  })
})
