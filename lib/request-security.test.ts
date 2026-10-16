/**
 * Unit tests for the shared request-security checks.
 *
 * Focus: origin verification must accept every same-origin request — whatever
 * host the app is actually served from (localhost, 127.0.0.1, LAN IP, tunnel,
 * deployment domain) — while still rejecting cross-origin requests, which is
 * the CSRF property the check exists for. Also covers the content-type gate
 * used by mutation routes (JSON + multipart uploads).
 *
 * Run with Node's built-in test runner (no extra dependencies):
 *   node --test lib/request-security.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { verifyContentType, verifyOrigin, verifyRequest } from './request-security.ts'

/** Structural stand-in for NextRequest — only the fields the checks read. */
type RequestLike = Parameters<typeof verifyOrigin>[0]

function makeRequest(
  headers: Record<string, string> = {},
  options: { url?: string; method?: string } = {},
): RequestLike {
  const url = options.url ?? 'http://localhost:3000/api/admin/pre-registered-residents'
  return {
    method: options.method ?? 'POST',
    headers: new Headers(headers),
    nextUrl: new URL(url),
  } as unknown as RequestLike
}

describe('verifyOrigin', () => {
  it('accepts requests with no Origin or Referer header', () => {
    assert.equal(verifyOrigin(makeRequest()).valid, true)
  })

  it('accepts same-origin localhost requests (the configured app URL)', () => {
    const result = verifyOrigin(
      makeRequest({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
    )
    assert.equal(result.valid, true)
    assert.equal(result.origin, 'http://localhost:3000')
  })

  it('accepts 127.0.0.1 even though it is not in the env allow-list', () => {
    // Regression: an Excel import from http://127.0.0.1:3000 was rejected with
    // 403 "Invalid origin" because only NEXT_PUBLIC_APP_URL / localhost were
    // allowed, regardless of the host the request was delivered to.
    const result = verifyOrigin(
      makeRequest({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }),
    )
    assert.equal(result.valid, true)
  })

  it('accepts any LAN IP / tunnel host as long as it matches the request host', () => {
    const result = verifyOrigin(
      makeRequest({ origin: 'http://192.168.1.10:3000', host: '192.168.1.10:3000' }),
    )
    assert.equal(result.valid, true)
  })

  it('accepts a deployment domain without NEXT_PUBLIC_APP_URL being configured', () => {
    const result = verifyOrigin(
      makeRequest({
        origin: 'https://lingkodbayan.vercel.app',
        host: 'lingkodbayan.vercel.app',
      }),
    )
    assert.equal(result.valid, true)
  })

  it('accepts https origins behind a TLS-terminating proxy (Host without port)', () => {
    const result = verifyOrigin(
      makeRequest({ origin: 'https://barangay.example.gov.ph', host: 'barangay.example.gov.ph' }),
    )
    assert.equal(result.valid, true)
  })

  it('prefers X-Forwarded-Host when a proxy rewrites the Host header', () => {
    const result = verifyOrigin(
      makeRequest({
        origin: 'https://lingkodbayan.vercel.app',
        host: 'localhost:3000',
        'x-forwarded-host': 'lingkodbayan.vercel.app',
      }),
    )
    assert.equal(result.valid, true)
  })

  it('uses the first value of a multi-value X-Forwarded-Host', () => {
    const result = verifyOrigin(
      makeRequest({
        origin: 'https://lingkodbayan.vercel.app',
        host: '127.0.0.1:3000',
        'x-forwarded-host': 'lingkodbayan.vercel.app, internal.local',
      }),
    )
    assert.equal(result.valid, true)
  })

  it('falls back to the env allow-list when the proxy rewrote Host', () => {
    // NEXT_PUBLIC_APP_URL=http://localhost:3000 comes from .env.local; the
    // hardcoded localhost entries make this deterministic either way.
    const result = verifyOrigin(
      makeRequest({ origin: 'http://localhost:3000', host: '127.0.0.1:3999' }),
    )
    assert.equal(result.valid, true)
  })

  it('rejects a cross-origin request from another site', () => {
    const result = verifyOrigin(
      makeRequest({ origin: 'https://evil.example.com', host: 'localhost:3000' }),
    )
    assert.equal(result.valid, false)
  })

  it('rejects a same-host origin served over a scheme the allow-list does not cover', () => {
    // origin host (localhost:3000) != request host (localhost:3001), and
    // https://localhost:3000 is not allow-listed (only http:// is).
    const result = verifyOrigin(
      makeRequest({ origin: 'https://localhost:3000', host: 'localhost:3001' }),
    )
    assert.equal(result.valid, false)
  })

  it('rejects the unparsable "Origin: null" literal', () => {
    const result = verifyOrigin(makeRequest({ origin: 'null', host: 'localhost:3000' }))
    assert.equal(result.valid, false)
  })

  it('validates the Referer fallback (query string stripped)', () => {
    const valid = verifyOrigin(
      makeRequest({ referer: 'http://localhost:3000/admin/pre-registered-residents?tab=1' }),
    )
    assert.equal(valid.valid, true)

    const invalid = verifyOrigin(
      makeRequest({ referer: 'https://evil.example.com/phish?next=http://localhost:3000' }),
    )
    assert.equal(invalid.valid, false)
  })
})

describe('verifyContentType', () => {
  it('accepts JSON bodies', () => {
    assert.equal(verifyContentType(makeRequest({ 'content-type': 'application/json' })), true)
  })

  it('accepts multipart/form-data (CSV/Excel file uploads)', () => {
    assert.equal(
      verifyContentType(makeRequest({ 'content-type': 'multipart/form-data; boundary=----abc' })),
      true,
    )
  })

  it('rejects unexpected content types', () => {
    assert.equal(verifyContentType(makeRequest({ 'content-type': 'text/plain' })), false)
  })
})

describe('verifyRequest', () => {
  it('passes a same-origin multipart upload', () => {
    const result = verifyRequest(
      makeRequest({
        origin: 'http://127.0.0.1:3000',
        host: '127.0.0.1:3000',
        'content-type': 'multipart/form-data; boundary=----abc',
      }),
    )
    assert.deepEqual(result, { valid: true })
  })

  it('passes safe GET requests without extra checks', () => {
    const result = verifyRequest(makeRequest({}, { method: 'GET' }))
    assert.deepEqual(result, { valid: true })
  })

  it('reports the origin error first when the origin is invalid', () => {
    const result = verifyRequest(
      makeRequest({
        origin: 'https://evil.example.com',
        host: 'localhost:3000',
        'content-type': 'application/json',
      }),
    )
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid origin')
  })

  it('reports a content-type error for mutations without an accepted type', () => {
    const result = verifyRequest(
      makeRequest(
        {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'content-type': 'text/plain',
        },
        { method: 'POST' },
      ),
    )
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid content type')
  })
})
