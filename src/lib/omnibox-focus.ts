import { ref } from 'vue'

/**
 * Bumped whenever something (e.g. the Ctrl+L shortcut) wants the address bar
 * focused. Toolbar.vue watches this and selects the input. A plain counter
 * rather than an event bus keeps it a single shared module-level ref.
 * See docs/features/keyboard-shortcuts.md.
 */
export const omniboxFocusNonce = ref(0)

export function requestOmniboxFocus(): void {
  omniboxFocusNonce.value++
}
