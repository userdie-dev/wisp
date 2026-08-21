import { isTauri } from './tauri-env'

/**
 * Thin wrapper around `@tauri-apps/plugin-store` that falls back to
 * `localStorage` when running outside the Tauri webview (`pnpm dev` in a
 * plain browser tab — see docs/setup-and-build.md). Real persistence always
 * goes through the plugin; this only exists so the UI is usable for local
 * frontend iteration without the Tauri runtime.
 */
export interface PersistedStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
}

export async function openPersistedStore(fileName: string): Promise<PersistedStore> {
  if (!isTauri()) {
    return {
      async get<T>(key: string): Promise<T | null> {
        const raw = localStorage.getItem(`${fileName}:${key}`)
        return raw ? (JSON.parse(raw) as T) : null
      },
      async set<T>(key: string, value: T): Promise<void> {
        localStorage.setItem(`${fileName}:${key}`, JSON.stringify(value))
      },
    }
  }

  const { load } = await import('@tauri-apps/plugin-store')
  const store = await load(fileName, { autoSave: true })
  return {
    get: async (key) => (await store.get(key)) ?? null,
    set: (key, value) => store.set(key, value),
  }
}
