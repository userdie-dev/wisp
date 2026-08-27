/**
 * Best-effort favicon URL for a page. Child tab webviews load arbitrary
 * external pages and get no Tauri IPC, so the real `<link rel="icon">` can't be
 * read back reliably — instead the icon is guessed from the origin. A broken
 * guess is cleared by the `<img @error>` fallback in TabItem.vue.
 * See docs/features/favicons.md.
 */
export function faviconFor(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.origin}/favicon.ico`
  } catch {
    return null
  }
}
