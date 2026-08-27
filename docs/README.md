# Документация

Индекс документации проекта. Все решения по функционалу фиксируются здесь по мере реализации — этот каталог является source of truth для архитектуры, а не только описанием после факта.

- [architecture.md](./architecture.md) — общая архитектура: движок рендеринга, модель окон/веб-вью, стек библиотек
- [setup-and-build.md](./setup-and-build.md) — локальная разработка без Rust, сборка через GitHub Actions
- Функционал первого этапа:
  - [features/tabs.md](./features/tabs.md) — вкладки слева
  - [features/start-page.md](./features/start-page.md) — стартовая страница новой вкладки
  - [features/window-transparency.md](./features/window-transparency.md) — прозрачное окно и блюр
  - [features/history.md](./features/history.md) — история посещений
  - [features/bookmarks.md](./features/bookmarks.md) — закладки
  - [features/theme-settings.md](./features/theme-settings.md) — настройка темы
  - [features/search-settings.md](./features/search-settings.md) — настройка поисковой системы
- Следующие этапы:
  - [features/roadmap.md](./features/roadmap.md) — список кандидатов на реализацию
  - [features/auto-update.md](./features/auto-update.md) — автообновление через GitHub Releases
  - [features/session-restore.md](./features/session-restore.md) — восстановление вкладок при запуске

## Статус

Этап 1 (scaffold): структура проекта, конфигурация Tauri, CI-сборка на GitHub Actions, базовый UI. Требует `pnpm install` и первого прогона workflow в GitHub Actions для проверки, что Rust-часть компилируется (локально Rust не установлен и устанавливаться не должен — см. [setup-and-build.md](./setup-and-build.md)).
