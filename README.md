# Browser

Десктопный браузер на Tauri, использующий системные веб-вью (WebView2/V8 на Windows, WebKit на macOS/Linux). UI — Vue 3.6 (частично vue-vapor) + Reka UI + Tailwind CSS.

Полная документация по архитектуре и функционалу — в [docs/](./docs/README.md).

## Быстрый старт

```bash
pnpm install
pnpm dev
```

Открывает фронтенд в обычном браузере (без Tauri-рантайма — вкладки не показывают реальные страницы, окно не прозрачное). Это ожидаемо: Rust не устанавливается локально, полная сборка происходит только на GitHub Actions. Подробности и почему — [docs/setup-and-build.md](./docs/setup-and-build.md).

## Выпуск сборки

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions соберёт и опубликует установочные файлы под Windows/macOS/Linux как черновой Release.

## Структура

- `src/` — Vue-фронтенд (chrome UI: сайдбар, тулбар, внутренние страницы)
- `src-tauri/` — Rust-часть Tauri (управление дочерними веб-вью вкладок, блюр окна)
- `docs/` — архитектура и спецификации функционала
- `.github/workflows/build.yml` — CI-сборка
