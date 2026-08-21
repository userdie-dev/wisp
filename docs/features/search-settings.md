# Настройка поисковой системы

## Хранилище

`@tauri-apps/plugin-store`, файл `settings.json`, ключи `"searchEngineId"` и `"customSearchEngines"`.

```ts
interface SearchEngine {
  id: string          // 'google' | 'bing' | 'duckduckgo' | 'custom-<nanoid>'
  name: string
  urlTemplate: string // '%s' заменяется на encodeURIComponent(query)
  builtIn: boolean
}
```

Предустановленные (`src/lib/search-engines.ts`, `builtIn: true`, неудаляемые):

| id | name | urlTemplate |
|---|---|---|
| google | Google | `https://www.google.com/search?q=%s` |
| bing | Bing | `https://www.bing.com/search?q=%s` |
| duckduckgo | DuckDuckGo | `https://duckduckgo.com/?q=%s` |

Пользователь может добавить свои (`builtIn: false`) с произвольным `urlTemplate`, содержащим `%s`.

## Логика omnibox: URL или поисковый запрос?

`src/lib/omnibox.ts`, функция `resolveInput(input: string): string`:

1. Если строка похожа на URL (есть схема `http(s)://`, либо распознаётся как `host.tld[/path]` через регэксп с проверкой на известный TLD-паттерн, либо `localhost`/IP) → используется как есть (схема `https://` добавляется, если отсутствует).
2. Иначе — трактуется как поисковый запрос: `activeSearchEngine.urlTemplate.replace('%s', encodeURIComponent(input))`.

Это тот же эвристический подход, что и в обычных браузерах (Chrome/Firefox) — не претендует на 100% точность, разграничение полностью локальное, без внешних DNS-проверок в реальном времени в этапе 1.

## UI

Внутренняя страница «Настройки» → секция «Поиск» (`src/components/settings/SearchSettings.vue`):

- Select (Reka UI `Select`) с текущей системой поиска по умолчанию — список = `builtIn` + пользовательские.
- Список пользовательских систем поиска с возможностью добавить (форма: имя + URL-шаблон с `%s`) и удалить.
- Валидация формы: `urlTemplate` обязан содержать ровно одно вхождение `%s`.

## Не входит в первый этап

- Автоопределение поисковых систем через `<link rel="search" type="application/opensearchdescription+xml">` при посещении сайтов (как в Firefox).
- Подсказки автодополнения omnibox из истории/закладок (сейчас omnibox — просто текстовое поле без dropdown-подсказок).
