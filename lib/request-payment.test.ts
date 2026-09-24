import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  PAYMENT_METHOD_LABELS,
  buildRequestPaymentSnapshot,
  computePerPageAmount,
  formatPeso,
  getDefaultPaymentAmount,
  getPaymentMethodLabel,
  getPaymentStatusClassName,
  getPaymentStatusLabel,
  getRequestPayment,
  requiresAmountEntry,
  requiresReferenceNumber,
  resolvePaymentStatus,
  toRequestPaymentRow,
  validateRequestPayment,
} from './request-payment.ts'

const fixedFee = { feeType: 'fixed', feeAmountMin: 50, feeAmountMax: null, feeDescription: '₱50' }
const rangeFee = { feeType: 'range', feeAmountMin: 100, feeAmountMax: 500, feeDescription: null }
const freeFee = { feeType: 'free', feeAmountMin: 0, feeAmountMax: null, feeDescription: null }
const unspecifiedFee = { feeType: 'unspecified', feeAmountMin: null, feeAmountMax: null, feeDescription: null }
const perPageFee = { feeType: 'per_page', feeAmountMin: 20, feeAmountMax: null, feeDescription: '₱20/page' }

describe('validateRequestPayment', () => {
  it('accepts free services without a method or amount', () => {
    assert.equal(validateRequestPayment(freeFee, { method: '', amount: '' }), null)
  })

  it('requires a payment method for paid services', () => {
    assert.match(validateRequestPayment(fixedFee, { method: '', amount: '' }) ?? '', /payment method/)
  })

  it('accepts counter payment for a fixed fee without an amount', () => {
    assert.equal(validateRequestPayment(fixedFee, { method: 'pay_at_counter', amount: '' }), null)
  })

  it('requires the amount for range fees', () => {
    assert.match(validateRequestPayment(rangeFee, { method: 'pay_at_counter', amount: '' }) ?? '', /amount to pay/)
  })

  it('rejects amounts below the charter range', () => {
    assert.match(validateRequestPayment(rangeFee, { method: 'pay_at_counter', amount: '50' }) ?? '', /starts at/)
  })

  it('rejects amounts above the charter range', () => {
    assert.match(validateRequestPayment(rangeFee, { method: 'pay_at_counter', amount: '900' }) ?? '', /must not exceed/)
  })

  it('accepts amounts inside the charter range', () => {
    assert.equal(validateRequestPayment(rangeFee, { method: 'pay_at_counter', amount: '250' }), null)
  })

  it('rejects malformed amounts', () => {
    assert.match(validateRequestPayment(rangeFee, { method: 'pay_at_counter', amount: 'abc' }) ?? '', /valid payment amount/)
  })

  it('requires a reference number for digital payments', () => {
    assert.match(validateRequestPayment(fixedFee, { method: 'gcash', amount: '', referenceNumber: '   ' }) ?? '', /reference/)
    assert.match(validateRequestPayment(unspecifiedFee, { method: 'maya', amount: '10' }) ?? '', /reference/)
  })

  it('requires a positive amount for digital payments with an unscoped fee', () => {
    assert.match(validateRequestPayment(unspecifiedFee, { method: 'gcash', amount: '', referenceNumber: 'REF1' }) ?? '', /amount you are paying/)
  })

  it('accepts a verified digital payment draft', () => {
    assert.equal(
      validateRequestPayment(fixedFee, { method: 'gcash', amount: '', referenceNumber: 'GCA-123' }),
      null,
    )
  })
})

describe('computePerPageAmount', () => {
  it('multiplies the charter rate by the page count', () => {
    assert.equal(computePerPageAmount(perPageFee, '5'), 100)
    assert.equal(computePerPageAmount(perPageFee, 3), 60)
  })

  it('returns null for missing or invalid page counts', () => {
    assert.equal(computePerPageAmount(perPageFee, ''), null)
    assert.equal(computePerPageAmount(perPageFee, 'abc'), null)
    assert.equal(computePerPageAmount(perPageFee, '2.5'), null)
    assert.equal(computePerPageAmount(perPageFee, '0'), null)
    assert.equal(computePerPageAmount(perPageFee, null), null)
  })

  it('returns null when the charter sets no per-page rate', () => {
    assert.equal(computePerPageAmount(unspecifiedFee, '5'), null)
  })
})

describe('payment snapshot', () => {
  it('resolves statuses per method', () => {
    assert.equal(resolvePaymentStatus(freeFee, 'pay_at_counter'), 'free')
    assert.equal(resolvePaymentStatus(fixedFee, 'pay_at_counter'), 'unpaid')
    assert.equal(resolvePaymentStatus(fixedFee, 'gcash'), 'pending_verification')
    assert.equal(resolvePaymentStatus(fixedFee, 'maya'), 'pending_verification')
  })

  it('knows which fees need amount entry and references', () => {
    assert.equal(requiresAmountEntry(freeFee), false)
    assert.equal(requiresAmountEntry(fixedFee), false)
    assert.equal(requiresAmountEntry(rangeFee), true)
    assert.equal(requiresAmountEntry(unspecifiedFee), true)
    assert.equal(requiresReferenceNumber('pay_at_counter'), false)
    assert.equal(requiresReferenceNumber('gcash'), true)
    assert.equal(requiresReferenceNumber('maya'), true)
  })

  it('preselects default amounts', () => {
    assert.equal(getDefaultPaymentAmount(freeFee), 0)
    assert.equal(getDefaultPaymentAmount(fixedFee), 50)
    assert.equal(getDefaultPaymentAmount(rangeFee), 100)
    assert.equal(getDefaultPaymentAmount(perPageFee), null)
    assert.equal(getDefaultPaymentAmount(unspecifiedFee), null)
  })

  it('builds a fixed-fee counter snapshot', () => {
    const snapshot = buildRequestPaymentSnapshot(fixedFee, { method: 'pay_at_counter', amount: '' }, '2026-01-01T00:00:00.000Z')
    assert.deepEqual(snapshot, {
      fee_type: 'fixed',
      fee_amount_min: 50,
      fee_amount_max: null,
      fee_description: '₱50',
      amount_paid: 50,
      payment_method: 'pay_at_counter',
      payment_status: 'unpaid',
      reference_number: null,
      recorded_at: '2026-01-01T00:00:00.000Z',
    })
  })

  it('builds a free snapshot with a zero amount', () => {
    const snapshot = buildRequestPaymentSnapshot(freeFee, { method: '', amount: '999' })
    assert.equal(snapshot.amount_paid, 0)
    assert.equal(snapshot.payment_status, 'free')
  })

  it('builds a digital snapshot with a trimmed reference', () => {
    const snapshot = buildRequestPaymentSnapshot(rangeFee, { method: 'gcash', amount: '300', referenceNumber: '  REF-9  ' })
    assert.equal(snapshot.amount_paid, 300)
    assert.equal(snapshot.payment_status, 'pending_verification')
    assert.equal(snapshot.reference_number, 'REF-9')
  })

  it('serializes to a request_payments row without recorded_at', () => {
    const snapshot = buildRequestPaymentSnapshot(fixedFee, { method: 'pay_at_counter', amount: '' })
    const row = toRequestPaymentRow(snapshot)
    assert.equal('recorded_at' in row, false)
    assert.equal(row.amount_paid, 50)
  })
})

describe('getRequestPayment', () => {
  it('returns null for missing or invalid payloads', () => {
    assert.equal(getRequestPayment(null), null)
    assert.equal(getRequestPayment({}), null)
    assert.equal(getRequestPayment({ payment: 'nope' }), null)
    assert.equal(getRequestPayment({ payment: { payment_method: 'wire', payment_status: 'paid', amount_paid: 1 } }), null)
    assert.equal(getRequestPayment({ payment: { payment_method: 'gcash', payment_status: 'paid', amount_paid: 'x' } }), null)
  })

  it('reads a stored snapshot back', () => {
    const snapshot = buildRequestPaymentSnapshot(fixedFee, { method: 'pay_at_counter', amount: '' }, '2026-01-01T00:00:00.000Z')
    assert.deepEqual(getRequestPayment({ payment: snapshot }), snapshot)
  })
})

describe('labels and formatting', () => {
  it('formats pesos', () => {
    assert.equal(formatPeso(50), '\u20B150')
  })

  it('labels methods and statuses with fallbacks', () => {
    assert.equal(getPaymentMethodLabel('gcash'), PAYMENT_METHOD_LABELS.gcash)
    assert.equal(getPaymentMethodLabel('wire'), 'wire')
    assert.equal(getPaymentMethodLabel(null), 'Not specified')
    assert.equal(getPaymentStatusLabel('paid'), 'Paid')
    assert.equal(getPaymentStatusLabel('other'), 'other')
    assert.equal(getPaymentStatusLabel(undefined), 'Not specified')
  })

  it('returns badge classes for statuses', () => {
    assert.match(getPaymentStatusClassName('paid'), /emerald/)
    assert.match(getPaymentStatusClassName('pending_verification'), /sky/)
    assert.match(getPaymentStatusClassName('unpaid'), /amber/)
    assert.match(getPaymentStatusClassName(undefined), /amber/)
  })
})
