# Менеджер загрузок

Часть [roadmap](./roadmap.md) → «Рекомендуемый порядок», пункт 2. Rust + фронтенд.

## Что делает

- Перехватывает загрузки во всех content-webview, кладёт файл в папку загрузок
  (по умолчанию — системная «Загрузки», можно выбрать другую).
- Страница **Загрузки** в сайдбаре (рядом с Историей/Закладками): список файлов,
  статус, открыть файл / показать в папке / убрать из списка / повторить.

## Rust

### Перехват (`webview_manager.rs`)

`WebviewBuilder::on_download` на каждом content-webview:

```rust
DownloadEvent::Requested { url, destination } => {
    // dir = override | app.path().download_dir() | "."
    *destination = unique_path(&dir, &file_name_from_url(&url)); // dir/name (n).ext при коллизии
    emit("download-started", { id, url, filename, path });
}
DownloadEvent::Finished { url, path, success } => {
    emit("download-finished", { url, path, success });
}
```

Wry отдаёт только «запрошено» и «завершено» — **прогресса по байтам нет**, поэтому
в UI загрузка это спиннер → готово/ошибка, без процентов. На macOS `path` в
`Finished` всегда пустой (ограничение API) — фронт оставляет путь из `Requested`.

`id` — монотонный счётчик (`AtomicU64` в `TabRegistry`). `Finished` его не несёт,
только `url`, поэтому фронт сопоставляет по `url` + статусу `in_progress`.

### Папка назначения

`TabRegistry.downloads_dir: Arc<Mutex<Option<PathBuf>>>`. `None` = системная
«Загрузки» (`app.path().download_dir()`).

| команда | назначение |
|---|---|
| `downloads_dir() -> String` | эффективная папка (для отображения) |
| `downloads_set_dir(path: Option<String>)` | задать / сбросить (`null`) override |

Выбор папки — `tauri-plugin-dialog` (`open({ directory: true })`) на фронте.
Открытие файла / показ в папке — `tauri-plugin-opener`
(`openPath` / `revealItemInDir`).

### Плагины и capabilities

`Cargo.toml`: `tauri-plugin-opener`, `tauri-plugin-dialog`,
`tauri-plugin-clipboard-manager` (последний — для контекстного меню, см.
[new-tab-and-context-menu.md](./new-tab-and-context-menu.md)).

`lib.rs`: `.plugin(tauri_plugin_opener::init())` и аналогично для dialog / clipboard-manager.

`capabilities/default.json`:

```jsonc
"dialog:allow-open",
{ "identifier": "opener:allow-open-path",        "allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$HOME/**" }] },
{ "identifier": "opener:allow-reveal-item-in-dir","allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$HOME/**" }] }
```

Файл, скачанный в папку вне `$HOME`, не откроется из UI — область видимости opener
намеренно ограничена (открытие произвольного пути системным приложением — та же
поверхность атаки, что и у обычного браузера, но сузить не мешает).

## Фронтенд

- **[stores/downloads.ts](../../src/stores/downloads.ts)** — Pinia-стор.
  Слушает `download-started` / `download-finished`, персистит в `downloads.json`
  (`@tauri-apps/plugin-store`, последние 200). При загрузке помечает «зависшие»
  `in_progress` из прошлого запуска как `failed` (докачать нельзя).
  Действия: `openFile` (только `done`), `showInFolder`, `remove`, `clearFinished`.
- **[components/downloads/DownloadsView.vue](../../src/components/downloads/DownloadsView.vue)** —
  внутренняя страница: строка «Папка загрузок» с «Изменить…» / «Сбросить»,
  список с иконкой статуса, hover-действиями.
- **[stores/settings.ts](../../src/stores/settings.ts)** — ключ `downloadsDir`
  (`string | null`), персистится в `settings.json`. `App.vue` на старте
  прокидывает сохранённое значение в Rust через `downloads_set_dir`.
- `InternalPage` в `stores/tabs.ts` расширен вариантом `'downloads'`;
  `ContentHost.vue` и `Sidebar.vue` — соответствующая кнопка/вью.

## Вне рамок этой итерации

- Прогресс-бар по байтам (Wry не даёт), пауза/возобновление, отмена активной загрузки.
- «Спрашивать, куда сохранять» перед каждой загрузкой.
- Открытие файла сразу после скачивания, оповещение по завершении.
- Проверка/карантин загруженных файлов.
