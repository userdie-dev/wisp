import { describe, it, expect } from 'vitest'
import { faviconFor } from './favicon'

describe('faviconFor', () => {
  it('points at /favicon.ico on the page origin', () => {
    expect(faviconFor('https://example.com/some/deep/page?q=1')).toBe(
      'https://example.com/favicon.ico',
    )
  })

  it('keeps a non-default port in the origin', () => {
    expect(faviconFor('http://localhost:5173/app')).toBe('http://localhost:5173/favicon.ico')
  })

  it('returns null for non-http(s) schemes', () => {
    expect(faviconFor('about:blank')).toBeNull()
    expect(faviconFor('file:///C:/page.html')).toBeNull()
  })

  it('returns null for an unparseable url', () => {
    expect(faviconFor('')).toBeNull()
    expect(faviconFor('not a url')).toBeNull()
  })
})
