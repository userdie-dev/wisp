import { onBeforeUnmount, onMounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { requestOmniboxFocus } from '@/lib/omnibox-focus'

/**
 * Browser-wide keyboard shortcuts. Pure key→action mapping lives in
 * `resolveShortcut` (unit-tested); the composable wires it to a `window`
 * keydown listener and dispatches into the tabs store.
 *
 * Limitation: while a tab's webview has focus, keydown events go to that page,
 * not the chrome webview — shortcuts only fire when focus is in the chrome
 * (start/internal pages, omnibox, right after switching tabs).
 * See docs/features/keyboard-shortcuts.md.
 */
export type ShortcutAction =
  | { type: 'new-tab' }
  | { type: 'close-tab' }
  | { type: 'focus-omnibox' }
  | { type: 'reload' }
  | { type: 'next-tab' }
  | { type: 'prev-tab' }
  | { type: 'select-tab'; index: number } // 0-based, or -1 for the last tab
  | { type: 'back' }
  | { type: 'forward' }

export function resolveShortcut(e: KeyboardEvent): ShortcutAction | null {
  const mod = e.ctrlKey || e.metaKey

  if (e.altKey && !mod) {
    if (e.key === 'ArrowLeft') return { type: 'back' }
    if (e.key === 'ArrowRight') return { type: 'forward' }
    return null
  }

  if (e.key === 'F5' && !mod && !e.altKey) return { type: 'reload' }

  if (mod && !e.altKey) {
    if (e.key === 'Tab') return { type: e.shiftKey ? 'prev-tab' : 'next-tab' }
    if (e.shiftKey) return null

    const key = e.key.toLowerCase()
    if (key === 't') return { type: 'new-tab' }
    if (key === 'w') return { type: 'close-tab' }
    if (key === 'l') return { type: 'focus-omnibox' }
    if (key === 'r') return { type: 'reload' }
    if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key)
      return { type: 'select-tab', index: n === 9 ? -1 : n - 1 }
    }
  }

  return null
}

export function useKeyboardShortcuts(): void {
  const tabs = useTabsStore()

  function dispatch(action: ShortcutAction): void {
    const activeId = tabs.activeTabId

    switch (action.type) {
      case 'new-tab':
        tabs.createTab()
        break
      case 'close-tab':
        if (activeId) {
          if (tabs.tabs.length === 1) tabs.createTab()
          tabs.closeTab(activeId)
        }
        break
      case 'focus-omnibox':
        requestOmniboxFocus()
        break
      case 'reload':
        if (activeId) tabs.reload(activeId)
        break
      case 'back':
        if (activeId) tabs.goBack(activeId)
        break
      case 'forward':
        if (activeId) tabs.goForward(activeId)
        break
      case 'next-tab':
      case 'prev-tab': {
        const list = tabs.tabs
        if (list.length === 0) break
        const current = list.findIndex((t) => t.id === activeId)
        const delta = action.type === 'next-tab' ? 1 : -1
        const next = list[(current + delta + list.length) % list.length]
        if (next) tabs.activateTab(next.id)
        break
      }
      case 'select-tab': {
        const list = tabs.tabs
        const target = action.index === -1 ? list[list.length - 1] : list[action.index]
        if (target) tabs.activateTab(target.id)
        break
      }
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    const action = resolveShortcut(e)
    if (!action) return
    e.preventDefault()
    dispatch(action)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
