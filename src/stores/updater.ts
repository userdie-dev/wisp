import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isTauri } from '@/lib/tauri-env'

/**
 * Auto-update against GitHub Releases via `@tauri-apps/plugin-updater`.
 * See docs/features/auto-update.md. All Tauri-specific calls are behind a
 * dynamic import + `isTauri()` guard, so in `pnpm dev` (no runtime) the store
 * is inert and reports `status: 'unsupported'`.
 */
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'upToDate'
  | 'error'
  | 'unsupported'

export interface UpdateInfo {
  version: string
  notes: string
  date?: string
}

// Injected by Vite (see vite.config.ts) so the dev build can still show a
// meaningful "current version" without the Tauri app API.
declare const __APP_VERSION__: string

export const useUpdaterStore = defineStore('updater', () => {
  const status = ref<UpdaterStatus>(isTauri() ? 'idle' : 'unsupported')
  const info = ref<UpdateInfo | null>(null)
  const downloaded = ref(0)
  const contentLength = ref(0)
  const error = ref<string | null>(null)
  const currentVersion = ref<string>(
    typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  )
  const bannerDismissed = ref(false)

  // The resolved `Update` handle from the last successful `check()`, kept so
  // `downloadAndInstall` can reuse it instead of re-checking.
  let pending: { downloadAndInstall: (cb: (e: DownloadEvent) => void) => Promise<void> } | null =
    null

  type DownloadEvent =
    | { event: 'Started'; data: { contentLength?: number } }
    | { event: 'Progress'; data: { chunkLength: number } }
    | { event: 'Finished' }

  if (isTauri()) {
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((v) => {
        currentVersion.value = v
      })
      .catch(() => {})
  }

  /**
   * @param silent auto-check on startup — stays quiet unless an update is
   *   actually found (no `upToDate`/`error` status churn, no banner reset).
   */
  async function check({ silent = false }: { silent?: boolean } = {}): Promise<void> {
    if (!isTauri()) {
      status.value = 'unsupported'
      return
    }
    if (status.value === 'checking' || status.value === 'downloading') return

    status.value = 'checking'
    error.value = null
    try {
      const { check: runCheck } = await import('@tauri-apps/plugin-updater')
      const update = await runCheck()
      if (update) {
        pending = update
        info.value = {
          version: update.version,
          notes: update.body ?? '',
          date: update.date ?? undefined,
        }
        bannerDismissed.value = false
        status.value = 'available'
      } else {
        pending = null
        info.value = null
        status.value = silent ? 'idle' : 'upToDate'
      }
    } catch (e) {
      pending = null
      error.value = e instanceof Error ? e.message : String(e)
      status.value = silent ? 'idle' : 'error'
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (!isTauri() || !pending) return
    if (status.value === 'downloading') return

    status.value = 'downloading'
    downloaded.value = 0
    contentLength.value = 0
    error.value = null
    try {
      await pending.downloadAndInstall((e: DownloadEvent) => {
        switch (e.event) {
          case 'Started':
            contentLength.value = e.data.contentLength ?? 0
            break
          case 'Progress':
            downloaded.value += e.data.chunkLength
            break
          case 'Finished':
            break
        }
      })
      status.value = 'ready'
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }

  async function relaunch(): Promise<void> {
    if (!isTauri()) return
    const { relaunch: doRelaunch } = await import('@tauri-apps/plugin-process')
    await doRelaunch()
  }

  function dismissBanner(): void {
    bannerDismissed.value = true
  }

  return {
    status,
    info,
    downloaded,
    contentLength,
    error,
    currentVersion,
    bannerDismissed,
    check,
    downloadAndInstall,
    relaunch,
    dismissBanner,
  }
})
