/**
 * Unit tests for the bilingual (EN/TL) translation helper.
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/i18n.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { LOCALE_HTML_LANG, t } from './i18n.ts'

describe('t', () => {
  it('returns the key unchanged for the English locale', () => {
    assert.equal(t('Request Service', 'en'), 'Request Service')
  })

  it('translates known keys for the Tagalog locale', () => {
    assert.equal(t('Request Service', 'tl'), 'Humiling ng Serbisyo')
    assert.equal(t('Pending', 'tl'), 'Nakabinbin')
    assert.equal(t('Confirm Logout', 'tl'), 'Kumpirmahin ang Pag-log Out')
  })

  it('falls back to the English key for unknown keys in Tagalog', () => {
    assert.equal(t('Not In The Dictionary', 'tl'), 'Not In The Dictionary')
  })

  it('interpolates {name} params into the translated text', () => {
    assert.equal(
      t('Welcome back, {name}', 'tl', { name: 'Juan' }),
      'Welcome back, Juan',
    )
  })

  it('interpolates params for translated keys without breaking the translation', () => {
    assert.equal(
      t('Pending', 'tl', { name: 'x' }),
      'Nakabinbin',
    )
  })

  it('replaces every occurrence of a param', () => {
    assert.equal(
      t('{greeting}, {name}. Are you there, {name}?', 'en', {
        greeting: 'Hello',
        name: 'Maria',
      }),
      'Hello, Maria. Are you there, Maria?',
    )
  })

  it('accepts numbers as param values', () => {
    assert.equal(t('You have {count} requests', 'en', { count: 3 }), 'You have 3 requests')
  })
})

describe('LOCALE_HTML_LANG', () => {
  it('maps both locales to valid ISO lang codes', () => {
    assert.equal(LOCALE_HTML_LANG.en, 'en')
    assert.equal(LOCALE_HTML_LANG.tl, 'fil-PH')
  })
})
