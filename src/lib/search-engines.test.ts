import { describe, it, expect } from 'vitest'
import { buildSearchUrl, isValidSearchTemplate, BUILT_IN_SEARCH_ENGINES } from './search-engines'

describe('buildSearchUrl', () => {
  it('substitutes the query into the template', () => {
    const google = BUILT_IN_SEARCH_ENGINES.find((e) => e.id === 'google')!
    expect(buildSearchUrl(google, 'hello world')).toBe('https://www.google.com/search?q=hello%20world')
  })

  it('encodes special characters', () => {
    const engine = { id: 'x', name: 'X', urlTemplate: 'https://x.test/?q=%s', builtIn: false }
    expect(buildSearchUrl(engine, 'a&b=c')).toBe('https://x.test/?q=a%26b%3Dc')
  })
})

describe('isValidSearchTemplate', () => {
  it('accepts a template with exactly one %s', () => {
    expect(isValidSearchTemplate('https://example.com/search?q=%s')).toBe(true)
  })

  it('rejects a template with no %s', () => {
    expect(isValidSearchTemplate('https://example.com/search')).toBe(false)
  })

  it('rejects a template with more than one %s', () => {
    expect(isValidSearchTemplate('https://example.com/%s/search?q=%s')).toBe(false)
  })
})
