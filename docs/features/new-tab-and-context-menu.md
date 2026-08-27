# Открытие ссылок в новых вкладках + контекстное меню

Часть [roadmap](./roadmap.md) → «Рекомендуемый порядок», пункт 2. Rust + фронтенд.

## Что делает

- **Новая вкладка по ссылке.** `target="_blank"` / `window.open()` открывают ссылку
  в новой вкладке Wisp (а не молча игнорируются, как раньше — отдельный webview для
  этого не создавался). `Ctrl`/`Cmd`+клик и клик средней кнопкой по обычной ссылке
  открывают её в **фоновой** вкладке (создаётся, но не активируется).
- **Нативное контекстное меню** по правому клику внутри страницы: для ссылки —
  открыть в новой/фоновой вкладке, копировать адрес; для изображения — открыть,
  копировать адрес; для выделенного текста — копировать, найти в поисковике;
  всегда — Назад / Вперёд / Обновить.

## Почему инъекция скрипта, а не нативные хуки

Системный webview владеет DOM страницы, а к удалённой странице нет IPC-канала
(capabilities для произвольных доменов сознательно не открываем). Плюс известные
баги Tauri: `on_navigation` **не срабатывает** для `target="_blank"` и submit форм
(tauri-apps/tauri#14090), а `on_new_window` появился только в 2.8 и по-разному
ведёт себя на WebView2 / WebKit для модифицированных кликов.

Поэтому в каждый content-webview через
`WebviewBuilder::initialization_script` инъектируется
[`src-tauri/src/content_script.js`](../../src-tauri/src/content_script.js). Он
запускается до скриптов страницы, в главном мире, и не подчиняется CSP страницы.

## Транспорт: sentinel-навигация `wisp://`

У content-webview нет способа позвать бэкенд, но у него есть навигация, которую
Rust видит в `on_navigation`. Скрипт «отправляет сообщение», присваивая
`window.location.href = 'wisp://ipc/?k=<kind>&p=<json>'`. Rust в
`webview_manager.rs::on_navigation`:

```rust
if url.scheme() == "wisp" {
    handle_bridge(&app, &tab_id, &menu_context, &window, url);
    return false; // отменяет навигацию до коммита — страница остаётся на месте
}
```

Отмена до коммита (`decidePolicyForNavigationAction(.cancel)` / `NavigationStarting
Cancel=true`) не трогает текущую страницу ни на WebKit, ни на WebView2.

`kind`:

| `k`           | `p` (JSON)                                              | действие Rust |
|---------------|--------------------------------------------------------|---------------|
| `newtab`      | `{ url, background }`                                   | `emit("tab-open-request", …)` |
| `contextmenu` | `{ linkUrl?, srcUrl?, selectionText?, pageUrl? }`       | сохранить контекст, собрать и показать нативное меню |

## Что перехватывает скрипт

- `window.open(url)` → переопределён: `send('newtab', { url, background: false })`,
  возвращает `null`. Ссылка на оригинал сохранена на случай сбоя.
- `click` / `auxclick` в фазе capture: если цель внутри `<a href^="http">` и
  (`target=_blank` **или** средняя кнопка / `Ctrl` / `Cmd`) → `preventDefault()` +
  `send('newtab', …)` с `background = средняя кнопка || Ctrl/Cmd`.
- `contextmenu` в фазе capture: `preventDefault()` (гасит меню движка), собирает
  ближайший `<a>`, `<img>`, `window.getSelection()` → `send('contextmenu', …)`.

## Контекстное меню (Rust)

HTML-меню отрисовать нельзя — область контента перекрыта дочерним webview
(см. [architecture.md](../architecture.md)). Поэтому меню **нативное**:
`webview_manager.rs::build_context_menu` собирает `tauri::menu::Menu`, показывается
через `Window::popup_menu` (у курсора) прямо из `on_navigation` (главный поток).

Контекст последнего клика лежит в `TabRegistry.menu_context: Arc<Mutex<Option<MenuContext>>>`.
Пункты меню имеют статичные id `wisp:<action>`; выбор обрабатывает
`lib.rs::handle_menu_event` (глобальный `Builder::on_menu_event`), который **только
эмитит события** — вся логика вкладок/омнибокса/буфера уже есть на фронте:

| id                    | событие / действие |
|-----------------------|--------------------|
| `wisp:open-new-tab`   | `emit("tab-open-request", { url: linkUrl, background: false })` |
| `wisp:open-background`| `emit("tab-open-request", { url: linkUrl, background: true })` |
| `wisp:open-image`     | `emit("tab-open-request", { url: srcUrl, background: false })` |
| `wisp:copy-link` / `wisp:copy-image` / `wisp:copy` | `clipboard().write_text(…)` (плагин clipboard-manager, Rust-side — фронт-webview в этот момент не в фокусе, `navigator.clipboard` бы отклонился) |
| `wisp:search`         | `emit("wisp-search", selectionText)` |
| `wisp:back` / `wisp:forward` / `wisp:reload` | `emit("wisp-tab-command", { id, command })` |

## Фронтенд

- **[stores/tabs.ts](../../src/stores/tabs.ts)** — слушает `tab-open-request`;
  `openFromContent(url, background)` создаёт вкладку **сразу после активной**
  (как в обычных браузерах), фоновой — не вызывает `activateTab` (нативный webview
  создаётся скрытым и таким и остаётся до клика).
- **[composables/useContentBridge.ts](../../src/composables/useContentBridge.ts)** —
  слушает `wisp-tab-command` (→ `tabs.goBack/goForward/reload`) и `wisp-search`
  (→ `buildSearchUrl` активного движка + `openFromContent`).

## Известные ограничения

- `<form target="_blank">` (особенно POST) — скрипт гасит submit только частично;
  переотправить форму в новую вкладку без потери данных нельзя. Пока не поддержано.
- Пункты «Сохранить ссылку/изображение как…» вынесены за рамки итерации — нужна
  выборка байтов на стороне Rust. Обычные download-ссылки работают через
  [менеджер загрузок](./downloads.md).
- Скрипт не инъектируется в about:/данные внутри iframe с изолированным origin —
  `initialization_script` только для главного фрейма.
- Вне Tauri (`pnpm dev`) моста нет: ссылки ведут себя как в обычном браузере.
