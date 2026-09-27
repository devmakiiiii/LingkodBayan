import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatSmsMessage, normalizePhoneNumber } from './sms.ts'

describe('normalizePhoneNumber', () => {
  it('normalizes common Philippine mobile formats', () => {
    assert.equal(normalizePhoneNumber('09171234567'), '+639171234567')
    assert.equal(normalizePhoneNumber('639171234567'), '+639171234567')
    assert.equal(normalizePhoneNumber('+63 917 123 4567'), '+639171234567')
    assert.equal(normalizePhoneNumber('917 123 4567'), '+639171234567')
    assert.equal(normalizePhoneNumber('(917) 123-4567'), '+639171234567')
  })

  it('rejects invalid numbers', () => {
    assert.equal(normalizePhoneNumber(null), null)
    assert.equal(normalizePhoneNumber(''), null)
    assert.equal(normalizePhoneNumber('12345'), null)
    assert.equal(normalizePhoneNumber('0917123456'), null)
    assert.equal(normalizePhoneNumber('not-a-phone'), null)
  })
})

describe('formatSmsMessage', () => {
  it('prefixes the sender and joins title and body', () => {
    assert.equal(
      formatSmsMessage('Document ready', 'Present code PICKUP-AB12CD34.'),
      'LingkodBayan: Document ready. Present code PICKUP-AB12CD34.',
    )
  })

  it('truncates to a single SMS segment', () => {
    const message = formatSmsMessage('T'.repeat(200), 'B'.repeat(200))
    assert.ok(message.length <= 160)
    assert.ok(message.startsWith('LingkodBayan: '))
    assert.ok(message.endsWith('…'))
  })
})
