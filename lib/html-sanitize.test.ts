/**
 * Unit tests for the rich-text sanitiser used by announcements.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/html-sanitize.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeRichText, stripHtml } from './html-sanitize.ts'

describe('sanitizeRichText', () => {
  it('removes executable elements entirely', () => {
    const result = sanitizeRichText('<p>Hello</p><script>alert(1)</script>')
    assert.ok(!result.includes('<script'))
    assert.ok(!result.includes('</script'))
    assert.ok(result.includes('<p>Hello</p>'))
  })

  it('drops event handler attributes', () => {
    const result = sanitizeRichText('<img src="https://example.com/a.png" onerror="alert(1)">')
    assert.ok(!result.includes('onerror'))
    assert.ok(result.includes('https://example.com/a.png'))
  })

  it('preserves the TinyMCE table markup the announcements editor produces', () => {
    const html = '<table><tbody><tr><td colspan="2">Hi</td></tr></tbody></table>'
    const result = sanitizeRichText(html)
    assert.ok(result.includes('<table>'))
    assert.ok(result.includes('<td colspan="2">'))
    assert.ok(result.includes('Hi'))
  })

  it('keeps ordinary links and formatting', () => {
    const result = sanitizeRichText('<p><strong>Bold</strong> <a href="https://gov.ph">link</a></p>')
    assert.ok(result.includes('<strong>Bold</strong>'))
    assert.ok(result.includes('href="https://gov.ph"'))
  })

  it('strips javascript: hrefs', () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">click</a>')
    assert.ok(!result.includes('javascript:'))
    assert.ok(result.includes('click'))
  })

  it('strips entity-obfuscated javascript: hrefs', () => {
    const result = sanitizeRichText('<a href="java&#115;cript:alert(1)">click</a>')
    assert.ok(!result.includes('javascript'))
    assert.ok(!result.toLowerCase().includes('script:'))
  })

  it('allows inline data:image sources but blocks other data: URLs', () => {
    const allowed = sanitizeRichText('<img src="data:image/png;base64,AAAA">')
    assert.ok(allowed.includes('data:image/png'))

    const blocked = sanitizeRichText('<img src="data:text/html;base64,PHNjcmlwdD4=">')
    assert.ok(!blocked.includes('data:text/html'))
  })

  it('keeps the target=_blank hardening on links', () => {
    const result = sanitizeRichText('<a href="https://gov.ph" target="_blank">link</a>')
    assert.ok(result.includes('rel="noopener noreferrer"'))
  })
})

describe('stripHtml', () => {
  it('flattens markup to plain text without leaving tags behind', () => {
    // Tags are replaced by a space (not collapsed), so assert the contract that
    // matters: no markup survives and the text content is preserved.
    const result = stripHtml('<p>Hello&nbsp;<strong>world</strong></p>')
    assert.ok(!result.includes('<'))
    assert.ok(result.includes('Hello'))
    assert.ok(result.includes('world'))
  })

  it('returns an empty string for markup with no text', () => {
    assert.equal(stripHtml('<p>&nbsp;</p>'), '')
  })
})
