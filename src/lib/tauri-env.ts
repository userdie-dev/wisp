/**
 * True when running inside the Tauri webview (desktop app). False during
 * `pnpm dev` in a plain browser tab, where `invoke`/plugins are unavailable —
 * see docs/setup-and-build.md, "Локальная разработка фронтенда".
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
