# Вкладки слева

## UX

Вертикальный список вкладок в левом сайдбаре (как Arc/Edge vertical tabs), а не горизонтальный ряд сверху:

- Каждая вкладка: favicon, заголовок (обрезается многоточием), кнопка закрытия (появляется по hover или если вкладка активна).
- Кнопка «+ Новая вкладка» вверху списка.
- Активная вкладка визуально выделена (фон/акцентная полоска слева).
- Drag-to-reorder — не в первом этапе (см. «Не входит в первый этап» ниже).
- Внизу сайдбара — три кнопки-иконки: История, Закладки, Настройки. Они переключают **внутреннюю страницу**, а не создают вкладку.

## Данные

```ts
interface Tab {
  id: string          // nanoid
  url: string
  title: string
  favicon: string | null
  loading: boolean
  createdAt: number
  pending: boolean    // true = нет ни URL, ни Rust-webview ещё — см. ниже
  canGoBack?: boolean    // из события tab-nav-state, см. navigation-state.md
  canGoForward?: boolean
}
```

Хранится в Pinia-сторе `src/stores/tabs.ts`, **не персистится** между запусками (закрытие приложения закрывает все вкладки — это ожидаемое поведение для этапа 1; открытые вкладки между сессиями — возможное улучшение позже).

## Поток создания вкладки

1. Пользователь жмёт «+» или Ctrl/Cmd+T → `tabsStore.createTab(url?)`.
2. Store вызывает `invoke('tabs_create', { url })`.
3. Rust (`webview_manager.rs`) создаёт дочерний `Webview` (`window.add_child`) с лейблом `tab-{id}`, изначально скрытый (`hide()`), с колбэками `on_page_load`/`on_document_title_changed` (см. ниже), возвращает `{ id, url, title }`.
4. Store добавляет вкладку в список и сразу вызывает `activateTab(id)`.

Если `url` не передан — вкладка создаётся с `pending: true` и без Rust-webview; вместо реальной страницы в ней показывается [стартовая страница](./start-page.md). Физический Webview создаётся лениво в `navigate()` только при первом переходе, чтобы не плодить пустые нативные веб-вью.

> **Важно: команды управления веб-вью обязаны быть `async`.** `Window::add_child` и методы `Webview::show/hide/set_position/set_size/navigate` **зависают намертво**, если их вызвать из **синхронной** `#[tauri::command]` на Windows/WebView2 — синхронная команда блокирует главный поток, а этим методам нужен главный поток для своей работы (tauri-apps/tauri#12032, #12521). Симптом: приложение полностью виснет при **первом** переходе из `pending`-вкладки (первый `add_child` за сессию — пустая стартовая вкладка его не вызывает). Поэтому все команды в `src-tauri/src/commands.rs`, которые трогают веб-вью, объявлены `async fn` — Tauri исполняет их в отдельном потоке. Тела не делают `.await`, пока держат `Mutex` реестра, так что не-`Send` guard'ы допустимы.

## Поток переключения вкладки (`activateTab`)

1. Если целевая вкладка **не** `pending` — `invoke('tabs_activate', { id })`. Rust: если была другая активная вкладка — `hide()` её Webview. Пересчитывает актуальный content-rect (сайдбар/тулбар могли изменить размер) и `set_bounds()` + `show()` для нового активного Webview.
2. Если целевая вкладка `pending`, либо переключаемся на «внутреннюю страницу» (история/закладки/настройки) — вызывается `invoke('show_internal_page')`, который просто скрывает webview текущей активной вкладки (если был). Дальше рендерит либо стартовую страницу, либо внутреннюю страницу сам chrome-webview — см. [architecture.md](../architecture.md) и [start-page.md](./start-page.md).

## Отслеживание title/url/loading (→ живёт и в истории)

При создании Webview регистрируются:

- `on_page_load` → `PageLoadEvent::Started` шлёт `emit("tab-updated", { id, loading: true })`,
  `Finished` — `emit("tab-updated", { id, url, loading: false })` плюс запись в историю
  (`plugin-store`, см. [history.md](./history.md)).
- `on_document_title_changed` → `emit("tab-updated", { id, title, url })`.
- `on_navigation` → ведёт модель истории вкладки и шлёт `tab-nav-state` — см.
  [navigation-state.md](./navigation-state.md).

Фронтенд слушает `tab-updated` (`listen` из `@tauri-apps/api/event`) в `stores/tabs.ts` и патчит соответствующую вкладку.

Favicon веб-вью не сообщает: он **угадывается** по адресу (`origin/favicon.ico`) на
фронтенде — см. [favicons.md](./favicons.md).

## Не входит в первый этап

- Drag-and-drop переупорядочивание вкладок.
- Группировка вкладок.
- Персистентность сессии (восстановление вкладок после перезапуска).
- Pinned-вкладки.
