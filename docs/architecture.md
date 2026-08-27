# Архитектура

## Движок рендеринга: V8 и WebKit

Приложение **не встраивает** отдельный движок браузера (Chromium/CEF/Servo). Это отдельный по масштабу проект (по сути форк/пересборка целого браузерного движка), требующий тяжёлого Rust/C++ тулчейна и гигабайты исходников — несовместимо с требованием «не качать Rust локально, билдить только на GitHub Actions» в разумные сроки.

Вместо этого используется **Tauri**, который на каждой ОС берёт системный веб-вью:

| ОС | Веб-вью | JS-движок | Рендеринг |
|---|---|---|---|
| Windows | WebView2 | **V8** (Chromium) | Blink |
| macOS | WKWebView | JavaScriptCore | **WebKit** |
| Linux | WebKitGTK | JavaScriptCore | **WebKit** |

Т.е. «V8 и WebKit» — это ровно то, что уже даёт Tauri из коробки, без единой строчки кода движка. Приложение работает как обычное приложение с двумя типами окон, см. ниже.

## Модель окон: chrome-веб-вью + дочерние content-веб-вью

Tauri v2 поддерживает **multiwebview**: в одно нативное окно можно добавлять несколько независимых дочерних `Webview`, каждый со своим позиционированием, размером и навигацией ([tauri::window::Window::add_child], фича `unstable`).

Используем это так:

```
┌─────────────────────────────────────────────┐
│ Window (transparent + blur)                  │
│ ┌────────┬──────────────────────────────────┤
│ │        │ Toolbar (chrome webview)          │
│ │Sidebar │ back/forward/reload + omnibox     │
│ │(chrome │──────────────────────────────────┤
│ │webview)│                                   │
│ │        │   Content area:                   │
│ │ tabs,  │   - активная вкладка → дочерний    │
│ │history,│     Webview.navigate(url)         │
│ │bookmarks│  - или "внутренняя" страница      │
│ │settings│    (History/Bookmarks/Settings) —  │
│ │        │    рендерится самим chrome-webview │
│ └────────┴──────────────────────────────────┘
└─────────────────────────────────────────────┘
```

- **Chrome webview** — это основной веб-вью Tauri (`index.html`, наше Vue-приложение). Он занимает **всё** окно, но визуально непрозрачны/размыты только сайдбар и тулбар (см. [window-transparency.md](./features/window-transparency.md)); область контента в чистом CSS остаётся прозрачной (`background: transparent`), чтобы через неё было видно дочерний веб-вью, наложенный поверх.
- **Content webview** — по одному дочернему `Webview` на каждую открытую вкладку, label `tab-{id}`. У активной вкладки он `show()` + `set_bounds()` в прямоугольник области контента; у неактивных — `hide()` (не уничтожается, чтобы сохранить состояние/scroll/формы).
- Внутренние страницы (История/Закладки/Настройки) — это **Vue-роуты внутри chrome webview**, не отдельные веб-вью. При открытии внутренней страницы активная вкладка временно `hide()`, а область контента chrome webview становится непрозрачной и рендерит соответствующий Vue-компонент.
- При ресайзе окна пересчитывается `bounds` активного content-веб-вью (событие `on_resized` на главном окне).

Подробности вкладок — [features/tabs.md](./features/tabs.md).

## Стек библиотек (максимальное переиспользование, минимум своего кода)

| Область | Библиотека | Почему |
|---|---|---|
| Desktop shell | **Tauri v2** | системные веб-вью (см. выше), нативные окна, multiwebview |
| UI-фреймворк | **Vue 3.6** (RC) | нужен для vue-vapor |
| Компиляция без VDOM | **vue-vapor** (`<script setup vapor>`, компилятор из `@vitejs/plugin-vue@6`, опция `features.vapor`) | явное требование задачи; включено точечно на «листовых» компонентах (см. ниже) |
| Headless UI-примитивы | **Reka UI** | доступные, немаркированные стилями примитивы (Dropdown, Dialog, Tabs, Popover, Switch) — не тащит рантайм VDOM-рендеринга поверх, минимальный риск конфликта с vapor |
| Стили | **Tailwind CSS v4** | вся визуальная тема (в т.ч. light/dark) без ручного CSS |
| Иконки | **lucide-vue-next** | большой, tree-shakable набор SVG-иконок как Vue-компоненты |
| Состояние | **Pinia** | официальный state-менеджер Vue |
| Персистентность (история/закладки/настройки) | **@tauri-apps/plugin-store** (офиц. плагин Tauri) | JSON key-value хранилище с JS API — не пишем свой файловый I/O |
| Блюр/vibrancy окна | **window-vibrancy** (Rust crate) | готовая реализация acrylic/mica/vibrancy для Win/macOS |
| Уникальные id | **nanoid** | id вкладок/закладок/записей истории |

### Vapor mode: точечное включение, а не глобальное

Vue 3.6 всё ещё RC, и большинство UI-китов (включая Reka UI) официально не тестировались с vapor mode. Поэтому:

- `features.vapor: true` в `@vitejs/plugin-vue` **не включается глобально**.
- Vapor включается **по файлу** через `<script setup vapor>` только в простых листовых компонентах без внешних UI-либ внутри: `TabItem.vue`, `NewTabButton.vue`, значки/бейджи и т.п. — там, где выигрыш от отсутствия VDOM/реактивности-по-подписке максимален (частое перерисовывание списка вкладок).
- Компоненты, использующие Reka UI (диалоги настроек, dropdown-меню) остаются обычными VDOM-компонентами — Vue 3.6 поддерживает interop vapor ⇄ vdom компонентов «из коробки», так что смешение безопасно.

Если после апдейта Reka UI или стабилизации Vue 3.6 конфликтов не будет обнаружено — можно расширить vapor на большее число компонентов или включить `features.vapor: true` глобально.

## Rust-команды (`src-tauri`)

Персистентные данные (история/закладки/настройки) идут напрямую из Vue через `@tauri-apps/plugin-store` — отдельные Rust-команды для них не нужны. Свои `#[tauri::command]` нужны только там, где JS не имеет доступа: управление дочерними веб-вью.

| Команда | Назначение |
|---|---|
| `tabs_create(url)` | создать дочерний Webview для новой вкладки, вернуть `Tab` |
| `tabs_close(id)` | закрыть Webview вкладки |
| `tabs_activate(id)` | скрыть текущий активный webview, показать/переразместить указанный |
| `tabs_navigate(id, url)` | `Webview::navigate` |
| `tabs_back(id)` / `tabs_forward(id)` / `tabs_reload(id)` / `tabs_stop(id)` | через `Webview::eval("history.back()")`, `window.stop()` и т.п. |
| `show_internal_page()` / `hide_internal_page()` | скрыть активный content-webview, чтобы chrome отрисовал внутреннюю страницу, и обратно |

События из Rust во фронтенд (`emit`):

- `tab-updated` — `{ id, url?, title?, loading? }`. Ловится в Pinia-сторе вкладок и
  одновременно пишет запись в историю через `plugin-store` (по `url`). `loading` приходит
  из `PageLoadEvent::Started/Finished` — см. [features/navigation-state.md](./features/navigation-state.md).
- `tab-nav-state` — `{ id, canGoBack, canGoForward }`. Модель истории вкладки ведётся в
  Rust через `WebviewBuilder::on_navigation`; фронтенд по этому событию блокирует кнопки
  назад/вперёд.

Подробная схема — в исходниках `src-tauri/src/webview_manager.rs` и `src-tauri/src/commands.rs`.

[tauri::window::Window::add_child]: https://docs.rs/tauri/latest/tauri/window/struct.Window.html#method.add_child
