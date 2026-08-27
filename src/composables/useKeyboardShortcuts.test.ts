import { describe, it, expect } from 'vitest'
import { resolveShortcut } from './useKeyboardShortcuts'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('resolveShortcut', () => {
  it('maps Ctrl/Cmd + letter shortcuts', () => {
    expect(resolveShortcut(key({ key: 't', ctrlKey: true }))).toEqual({ type: 'new-tab' })
    expect(resolveShortcut(key({ key: 'w', metaKey: true }))).toEqual({ type: 'close-tab' })
    expect(resolveShortcut(key({ key: 'l', ctrlKey: true }))).toEqual({ type: 'focus-omnibox' })
    expect(resolveShortcut(key({ key: 'r', ctrlKey: true }))).toEqual({ type: 'reload' })
  })

  it('treats F5 as reload without a modifier', () => {
    expect(resolveShortcut(key({ key: 'F5' }))).toEqual({ type: 'reload' })
  })

  it('cycles tabs with Ctrl+Tab / Ctrl+Shift+Tab', () => {
    expect(resolveShortcut(key({ key: 'Tab', ctrlKey: true }))).toEqual({ type: 'next-tab' })
    expect(resolveShortcut(key({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'prev-tab',
    })
  })

  it('selects tabs by number, with 9 meaning the last tab', () => {
    expect(resolveShortcut(key({ key: '1', ctrlKey: true }))).toEqual({
      type: 'select-tab',
      index: 0,
    })
    expect(resolveShortcut(key({ key: '3', ctrlKey: true }))).toEqual({
      type: 'select-tab',
      index: 2,
    })
    expect(resolveShortcut(key({ key: '9', ctrlKey: true }))).toEqual({
      type: 'select-tab',
      index: -1,
    })
  })

  it('maps Alt + arrows to history navigation', () => {
    expect(resolveShortcut(key({ key: 'ArrowLeft', altKey: true }))).toEqual({ type: 'back' })
    expect(resolveShortcut(key({ key: 'ArrowRight', altKey: true }))).toEqual({ type: 'forward' })
  })

  it('ignores unrelated and ambiguous combos', () => {
    expect(resolveShortcut(key({ key: 'a' }))).toBeNull()
    expect(resolveShortcut(key({ key: 't' }))).toBeNull()
    expect(resolveShortcut(key({ key: 't', ctrlKey: true, shiftKey: true }))).toBeNull()
    expect(resolveShortcut(key({ key: 'ArrowLeft', ctrlKey: true }))).toBeNull()
  })
})
