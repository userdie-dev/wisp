import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { isTauri } from '@/lib/tauri-env'

/**
 * Watches an element's on-screen rect and reports it to Rust so the active
 * tab's child webview (or nothing, for internal pages) can be positioned
 * exactly into that "hole" — see docs/architecture.md and
 * src-tauri/src/webview_manager.rs::ContentBounds.
 */
export function useContentBounds(target: Ref<HTMLElement | null>) {
  let observer: ResizeObserver | null = null

  async function report() {
    const el = target.value
    if (!el || !isTauri()) return
    const rect = el.getBoundingClientRect()
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_content_bounds', {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
  }

  onMounted(() => {
    if (!target.value) return
    observer = new ResizeObserver(() => report())
    observer.observe(target.value)
    window.addEventListener('resize', report)
    report()
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    window.removeEventListener('resize', report)
  })
}
