# Горячие клавиши

Часть [roadmap](./roadmap.md) → «Рекомендуемый порядок», пункт 1. Только фронтенд.

## Раскладка

| Клавиши                     | Действие                                             |
|-----------------------------|-----------------------------------------------------|
| `Ctrl/Cmd+T`                | новая (пустая) вкладка                               |
| `Ctrl/Cmd+W`                | закрыть активную вкладку (последнюю — заменить пустой) |
| `Ctrl/Cmd+L`                | выделить адресную строку                             |
| `Ctrl/Cmd+R`, `F5`          | обновить активную вкладку                            |
| `Ctrl+Tab`                  | следующая вкладка (по кругу)                         |
| `Ctrl+Shift+Tab`            | предыдущая вкладка (по кругу)                        |
| `Ctrl/Cmd+1`…`Ctrl/Cmd+8`   | перейти к N-й вкладке                                |
| `Ctrl/Cmd+9`                | перейти к последней вкладке                          |
| `Alt+←`                     | назад                                               |
| `Alt+→`                     | вперёд                                              |

## Реализация

- [`src/composables/useKeyboardShortcuts.ts`](../../src/composables/useKeyboardShortcuts.ts):
  чистая функция `resolveShortcut(e: KeyboardEvent): Shortcut | null` (маппинг клавиш →
  действие, покрыта юнит-тестами), плюс сам composable — вешает `keydown` на `window` в
  `onMounted`, снимает в `onBeforeUnmount`, диспатчит в `useTabsStore`. Подключён из
  [`App.vue`](../../src/App.vue).
- `Ctrl+L` не трогает стор напрямую: [`src/lib/omnibox-focus.ts`](../../src/lib/omnibox-focus.ts)
  экспортирует модульный синглтон-`ref` `omniboxFocusNonce` и `requestOmniboxFocus()`;
  [`Toolbar.vue`](../../src/components/chrome/Toolbar.vue) следит за nonce и делает
  `input.select()`.

## Ограничение фокуса

Пока фокус находится внутри webview вкладки (открыта веб-страница), события `keydown`
уходят этой странице, а не chrome-webview, поэтому composable их **не видит**. Горячие
клавиши срабатывают, когда фокус в chrome: стартовая страница, внутренние страницы
(история/закладки/настройки), адресная строка, и сразу после переключения вкладок.

Полноценный перехват (проброс клавиш из каждого tab-webview в бэкенд через
`initialization_script`) — возможное улучшение позже; требует Rust-части.
