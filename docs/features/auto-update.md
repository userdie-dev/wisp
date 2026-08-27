# Автообновление

Проверка новых версий Wisp и установка их «на месте» через официальный
`tauri-plugin-updater` (Tauri v2). Обновления берутся из GitHub Releases этого же
репозитория (`github.com/userdie-dev/wisp`).

## Модель

- **Источник обновлений** — статический манифест `latest.json`, который
  `tauri-apps/tauri-action` генерирует и прикладывает к каждому релизу тега `v*`
  (job `release` в [.github/workflows/build.yml](../../.github/workflows/build.yml)).
  Nightly-релиз намеренно **не** участвует — обновляемся только на версионные релизы.
- **Endpoint** — `https://github.com/userdie-dev/wisp/releases/latest/download/latest.json`.
  GitHub всегда отдаёт ассеты последнего *не-draft, не-prerelease* релиза по пути
  `/releases/latest/download/<asset>`, поэтому URL фиксированный и не зависит от версии.
- **Подпись** — плагин проверяет минисайн-подпись `latest.json` публичным ключом,
  вшитым в конфиг. Приватный ключ и пароль живут только в секретах GitHub Actions.
- **Каналы** — один канал (stable). Draft-релизы и `nightly` (prerelease) невидимы
  для endpoint `/releases/latest`, так что пользователи на nightly вручную не
  «самообновятся» до тех пор, пока не выйдет обычный релиз.

## Rust-часть (`src-tauri/`)

- `Cargo.toml` — зависимости `tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`
  (последний нужен для перезапуска приложения после установки).
- `lib.rs` — регистрация:
  ```rust
  .plugin(tauri_plugin_updater::Builder::new().build())
  .plugin(tauri_plugin_process::init())
  ```
- `capabilities/default.json` — добавить `"updater:default"` и `"process:allow-restart"`.

## Конфиг (`tauri.conf.json`)

```jsonc
{
  "bundle": {
    "createUpdaterArtifacts": true          // включает .sig-артефакты и latest.json
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/userdie-dev/wisp/releases/latest/download/latest.json"
      ],
      "pubkey": "<содержимое ~/.tauri/wisp.key.pub>",
      "windows": { "installMode": "passive" }  // тихая установка, окно прогресса NSIS
    }
  }
}
```

`installMode: passive` — на Windows показывает только прогресс-бар инсталлятора без
вопросов. `basicUi` дало бы полный мастер, `quiet` вообще ничего (но не работает с
per-machine NSIS).

## CI (`.github/workflows/build.yml`)

В job `release` (и только в нём) в `tauri-apps/tauri-action` пробрасываются секреты:

```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

При наличии этих переменных tauri-action:
1. подписывает бандлы, кладёт рядом `*.sig`;
2. генерирует `latest.json` с версией, датой, `notes` (из тела релиза) и per-platform
   ссылками + подписями;
3. прикладывает `latest.json` к GitHub Release.

Job `nightly` секреты **не** получает — nightly-бандлы остаются неподписанными и в
manifest не попадают.

### Разовая настройка ключей (делает владелец репозитория)

```bash
pnpm tauri signer generate -w ~/.tauri/wisp.key
```

- `~/.tauri/wisp.key` (приватный) → секрет `TAURI_SIGNING_PRIVATE_KEY` (всё содержимое файла).
- Пароль, заданный при генерации → секрет `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  (пустая строка, если без пароля).
- `~/.tauri/wisp.key.pub` → значение `plugins.updater.pubkey` в `tauri.conf.json` (коммитим).

Приватный ключ в репозиторий не коммитить никогда.

## Фронтенд

### Стор `src/stores/updater.ts`

Pinia-стор, весь Tauri-специфичный код за динамическим импортом и гардом `isTauri()`
(в `pnpm dev` без рантайма — no-op, статус `unsupported`).

Состояние:

| поле | тип | смысл |
|---|---|---|
| `status` | `'idle' \| 'checking' \| 'available' \| 'downloading' \| 'ready' \| 'upToDate' \| 'error' \| 'unsupported'` | текущая фаза |
| `info` | `{ version: string; notes: string; date?: string } \| null` | данные найденного обновления |
| `downloaded` / `contentLength` | `number` | байты для прогресс-бара |
| `error` | `string \| null` | текст последней ошибки |
| `currentVersion` | `string` | из `@tauri-apps/api/app` `getVersion()`, в dev — `__APP_VERSION__` |

Действия:

- `check({ silent }?)` — `check()` из плагина. `silent: true` (авто-проверка при
  старте) не переводит статус в `error`/`upToDate` шумно — только `available` что-то
  меняет в UI.
- `downloadAndInstall()` — `update.downloadAndInstall(cb)`, `cb` пишет прогресс.
  По завершении статус `ready`.
- `relaunch()` — `relaunch()` из `@tauri-apps/plugin-process`.

### Настройка автопроверки

В `src/stores/settings.ts` — новый ключ `updatesAutoCheck: boolean` (default `true`),
персистится в `settings.json` тем же паттерном, что и остальные.

В `App.vue` `onMounted`: если `isTauri()` и `settings.updatesAutoCheck` — вызвать
`updater.check({ silent: true })` (с небольшой задержкой, чтобы не конкурировать со
стартовой отрисовкой).

### UI

- **`src/components/settings/UpdateSettings.vue`** — секция «Обновления» на странице
  настроек:
  - текущая версия;
  - кнопка «Проверить обновления» → `check()`;
  - строка статуса (`Актуальная версия` / `Доступна X.Y.Z` / текст ошибки);
  - при `available`/`ready` — кнопка «Установить и перезапустить»;
  - тумблер «Проверять автоматически» → `settings.updatesAutoCheck`.
- **`src/components/chrome/UpdateBanner.vue`** — тонкая полоса над `ContentHost`,
  видна при `status === 'available' | 'downloading' | 'ready'`:
  - `available` → «Доступно обновление X.Y.Z» + кнопка «Установить»;
  - `downloading` → прогресс `downloaded/contentLength`;
  - `ready` → «Обновление готово» + кнопка «Перезапустить»;
  - крестик «скрыть» — прячет баннер до следующей сессии/проверки.

## Поведение по платформам

- **Windows** (NSIS) — плагин качает новый инсталлятор, запускает его в режиме
  `passive`, текущий процесс завершается, инсталлятор ставит поверх и (если
  `relaunch`) запускает заново.
- **macОS** (`.app.tar.gz` в бандле) — плагин распаковывает и заменяет `.app`.
- **Linux** — работает только для AppImage; `.deb`/`.rpm` обновляются менеджером
  пакетов дистрибутива, не плагином.

## Вне рамок этой итерации

- Несколько каналов (stable / beta) через `plugins.updater.channels`.
- Дельта-обновления.
- Откат на предыдущую версию.
- Проверка по расписанию во время работы (сейчас — только при старте и вручную).
- Свой сервер обновлений вместо GitHub Releases.
