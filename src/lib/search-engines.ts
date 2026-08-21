export interface SearchEngine {
  id: string
  name: string
  /** `%s` is replaced with `encodeURIComponent(query)`. */
  urlTemplate: string
  builtIn: boolean
}

export const BUILT_IN_SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/search?q=%s',
    builtIn: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    urlTemplate: 'https://www.bing.com/search?q=%s',
    builtIn: true,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    urlTemplate: 'https://duckduckgo.com/?q=%s',
    builtIn: true,
  },
]

export function buildSearchUrl(engine: SearchEngine, query: string): string {
  return engine.urlTemplate.replace('%s', encodeURIComponent(query))
}

export function isValidSearchTemplate(template: string): boolean {
  return template.split('%s').length === 2 // exactly one occurrence
}
