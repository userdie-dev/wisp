import type { SearchEngine } from './search-engines'
import { buildSearchUrl } from './search-engines'

const KNOWN_TLDS =
  /\.(com|net|org|io|dev|app|co|ru|su|рф|uk|de|fr|jp|cn|edu|gov|info|biz|xyz|me|ai|to|so|page)$/i

function looksLikeUrl(input: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return true // explicit scheme
  if (/^localhost(:\d+)?(\/|$)/i.test(input)) return true
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(input)) return true // IPv4

  const [hostAndPort] = input.split(/[/?#]/, 1)
  const host = hostAndPort.split(':')[0]
  if (!host.includes('.')) return false
  return KNOWN_TLDS.test(host) && !/\s/.test(input)
}

/** Resolves omnibox input to a navigable URL — either the input itself (as a
 * URL) or a search query against the active search engine. Same heuristic
 * class as Chrome/Firefox; not a guarantee of correctness. */
export function resolveInput(input: string, activeEngine: SearchEngine): string {
  const trimmed = input.trim()
  if (trimmed.length === 0) return ''

  if (looksLikeUrl(trimmed)) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  return buildSearchUrl(activeEngine, trimmed)
}
