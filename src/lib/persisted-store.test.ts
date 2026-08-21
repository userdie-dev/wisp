import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./tauri-env', () => ({ isTauri: () => false }))

describe('openPersistedStore (non-Tauri fallback)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for a key that was never set', async () => {
    const { openPersistedStore } = await import('./persisted-store')
    const store = await openPersistedStore('settings.json')
    expect(await store.get('theme')).toBeNull()
  })

  it('round-trips a value through localStorage', async () => {
    const { openPersistedStore } = await import('./persisted-store')
    const store = await openPersistedStore('settings.json')
    await store.set('theme', 'dark')
    expect(await store.get('theme')).toBe('dark')
    expect(localStorage.getItem('settings.json:theme')).toBe('"dark"')
  })

  it('namespaces keys by file name', async () => {
    const { openPersistedStore } = await import('./persisted-store')
    const settings = await openPersistedStore('settings.json')
    const history = await openPersistedStore('history.json')
    await settings.set('shared', 'a')
    await history.set('shared', 'b')
    expect(await settings.get('shared')).toBe('a')
    expect(await history.get('shared')).toBe('b')
  })
})
