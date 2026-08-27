# Состояние навигации, индикатор загрузки и Stop

Часть [roadmap](./roadmap.md) → «Рекомендуемый порядок», пункт 1. Rust + фронтенд.

## Что делает

- Кнопки **Назад / Вперёд** в тулбаре блокируются, когда идти некуда — вместо того чтобы
  всегда быть активными и делать слепой `history.back()/forward()`.
- Пока страница активной вкладки грузится, во вкладке (сайдбар) крутится спиннер, а кнопка
  **Обновить** в тулбаре превращается в **Stop** (`window.stop()`).

## Модель истории (Rust)

Tauri v2 не даёт кросс-платформенного `can_go_back` / `can_go_forward`. Поэтому история
каждой вкладки моделируется на стороне Rust в `webview_manager.rs`:

```rust
struct NavHistory { entries: Vec<String>, index: usize }
```

Хранится в `TabRegistry.nav: Arc<Mutex<HashMap<String, NavHistory>>>` (`Arc` — потому что клон
захватывается в `'static`-замыкание `on_navigation`).

`WebviewBuilder::on_navigation(|url| …)` срабатывает на **реальные** навигации: клики по
ссылкам, редиректы, submit форм, вызванные страницей `history.back()/forward()`, а также наши
собственные `tabs_back/forward/reload` (они делают `eval`, т.е. настоящую навигацию — модель
остаётся согласованной). Чистый редьюсер `apply_navigation(&mut NavHistory, &str)`:

| условие                         | действие                                          |
|---------------------------------|--------------------------------------------------|
| `url == entries[index + 1]`     | forward: `index += 1`                             |
| `url == entries[index - 1]`     | back: `index -= 1`                                |
| `url == entries[index]`         | reload: без изменений                             |
| иначе                           | новая навигация: обрезать хвост, `push`, `index = len - 1` |

При создании webview `nav` засевается как `{ entries: vec![url], index: 0 }`.

После каждого изменения Rust шлёт во фронтенд событие:

```
emit("tab-nav-state", { id, canGoBack: index > 0, canGoForward: index + 1 < entries.len() })
```

`close_tab` удаляет запись из `nav`; повторный `create_tab` с тем же id (ленивое
восстановление сессии, см. [session-restore.md](./session-restore.md)) вставляет свежую.

## Индикатор загрузки

`WebviewBuilder::on_page_load` уже ловил `PageLoadEvent::Finished`. Добавлена ветка
`PageLoadEvent::Started`:

- `Started` → `emit("tab-updated", { id, loading: true })` — **без** `url`, чтобы
  [history.ts](../../src/stores/history.ts) (фильтрует по `payload.url`) не записал лишний визит.
- `Finished` → к прежнему emit добавлено `loading: false`.

Фронтенд ([stores/tabs.ts](../../src/stores/tabs.ts)) в обработчике `tab-updated` больше не
сбрасывает `loading` безусловно, а применяет `payload.loading`, если он есть.

## Кнопка Stop

Команда `tabs_stop(id)` → `webview.eval("window.stop()")` (по образцу `tabs_reload`).
В [Toolbar.vue](../../src/components/chrome/Toolbar.vue) кнопка показывает `X` и зовёт
`tabs.stop`, пока `activeTab.loading`, иначе — `RotateCw` и `tabs.reload`.

## Известные ограничения

- **SPA-навигация** (`history.pushState` без перезагрузки документа) не вызывает
  `on_navigation` — для таких сайтов `canGoBack/Forward` отражают только межстраничные
  переходы.
- **Редирект первого перехода**: если стартовый URL вкладки редиректит (`http:` → `https:`,
  `example.com` → `www.example.com`), редьюсер видит новый URL как отдельную запись и
  `canGoBack` станет `true` до следующей навигации.
- В некоторых движках fragment-навигация (`#anchor`) и часть history-traversal могут не
  доходить до `on_navigation` — модель деградирует до «примерно верно», что всё равно лучше
  прежнего слепого поведения.
- Вне Tauri (`pnpm dev`) событий нет — кнопки Назад/Вперёд всегда `disabled`.
