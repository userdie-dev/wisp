import { onBeforeUnmount, onMounted } from 'vue'
import { isTauri } from '@/lib/tauri-env'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { buildSearchUrl } from '@/lib/search-engines'

/**
 * Chrome-side handlers for the events the Rust content bridge emits when a
 * native context-menu item is chosen. `tab-open-request` is handled in the
 * tabs store; clipboard writes happen Rust-side (clipboard-manager plugin).
 * See docs/features/new-tab-and-context-menu.md.
 */
export function useContentBridge(): void {
  const tabs = useTabsStore()
  const settings = useSettingsStore()
  const unlisten: Array<() => void> = []

  onMounted(async () => {
    if (!isTauri()) return
    const { listen } = await import('@tauri-apps/api/event')

    unlisten.push(
      await listen<{ id: string; command: 'back' | 'forward' | 'reload' }>(
        'wisp-tab-command',
        (event) => {
          const { id, command } = event.payload
          if (command === 'back') tabs.goBack(id)
          else if (command === 'forward') tabs.goForward(id)
          else if (command === 'reload') tabs.reload(id)
        },
      ),
    )

    unlisten.push(
      await listen<string>('wisp-search', (event) => {
        const text = event.payload.trim()
        if (text) tabs.openFromContent(buildSearchUrl(settings.activeSearchEngine(), text), false)
      }),
    )
  })

  onBeforeUnmount(() => unlisten.forEach((off) => off()))
}
