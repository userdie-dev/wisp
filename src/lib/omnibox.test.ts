import { describe, it, expect } from 'vitest'
import { resolveInput } from './omnibox'
import { BUILT_IN_SEARCH_ENGINES } from './search-engines'

const google = BUILT_IN_SEARCH_ENGINES.find((e) => e.id === 'google')!

describe('resolveInput', () => {
  it('returns empty string for blank input', () => {
    expect(resolveInput('   ', google)).toBe('')
  })

  it('passes through input that already has a scheme', () => {
    expect(resolveInput('http://example.com', google)).toBe('http://example.com')
  })

  it('adds https:// to a bare domain with a known TLD', () => {
    expect(resolveInput('example.com', google)).toBe('https://example.com')
  })

  it('adds https:// to a domain with a path', () => {
    expect(resolveInput('example.com/foo/bar', google)).toBe('https://example.com/foo/bar')
  })

  it('recognizes localhost with a port', () => {
    expect(resolveInput('localhost:1420', google)).toBe('https://localhost:1420')
  })

  it('recognizes bare IPv4 addresses', () => {
    expect(resolveInput('127.0.0.1:8080', google)).toBe('https://127.0.0.1:8080')
  })

  it('treats a domain-like string containing whitespace as a search query', () => {
    expect(resolveInput('example.com is cool', google)).toBe(
      'https://www.google.com/search?q=example.com%20is%20cool',
    )
  })

  it('treats plain text as a search query against the active engine', () => {
    expect(resolveInput('how to make tea', google)).toBe(
      'https://www.google.com/search?q=how%20to%20make%20tea',
    )
  })

  it('treats an unknown TLD as a search query', () => {
    expect(resolveInput('foo.bar', google)).toBe('https://www.google.com/search?q=foo.bar')
  })
})
