/**
 * Unit tests for authorization role resolution.
 *
 * These lock the fix for a privilege-escalation bug: `user_metadata` is
 * writable by the signed-in user through `supabase.auth.updateUser()`, so it
 * must never be able to promote an account to admin.
 *
 * Run with Node's built-in test runner:
 *   node --test lib/roles.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { getUserRole, isAdminRole, isAdminUser } from './roles.ts'

/** Accepts arbitrary metadata bags, mirroring the real Supabase `User`. */
function asUser(metadata: Record<string, unknown>) {
  return metadata as { app_metadata?: Record<string, unknown> | null }
}

describe('getUserRole', () => {
  it('reads the role from app_metadata', () => {
    assert.equal(getUserRole({ app_metadata: { role: 'admin' } }), 'admin')
    assert.equal(getUserRole({ app_metadata: { role: 'super_admin' } }), 'super_admin')
    assert.equal(getUserRole({ app_metadata: { role: 'citizen' } }), 'citizen')
  })

  it('ignores user_metadata, which the account holder can rewrite', () => {
    const forged = asUser({ user_metadata: { role: 'admin' }, app_metadata: {} })

    assert.equal(getUserRole(forged), null)
    assert.equal(isAdminUser(forged), false)
  })

  it('prefers app_metadata when user_metadata claims a higher role', () => {
    const malicious = asUser({
      user_metadata: { role: 'super_admin' },
      app_metadata: { role: 'citizen' },
    })

    assert.equal(getUserRole(malicious), 'citizen')
    assert.equal(isAdminUser(malicious), false)
  })

  it('trims whitespace and rejects blank or non-string roles', () => {
    assert.equal(getUserRole({ app_metadata: { role: '  admin  ' } }), 'admin')
    assert.equal(getUserRole({ app_metadata: { role: '   ' } }), null)
    assert.equal(getUserRole({ app_metadata: { role: 42 } }), null)
    assert.equal(getUserRole({ app_metadata: { role: null } }), null)
  })

  it('treats a missing user or metadata as no role', () => {
    assert.equal(getUserRole(null), null)
    assert.equal(getUserRole(undefined), null)
    assert.equal(getUserRole({}), null)
    assert.equal(getUserRole({ app_metadata: null }), null)
  })
})

describe('isAdminRole', () => {
  it('accepts only the two privileged roles', () => {
    assert.equal(isAdminRole('admin'), true)
    assert.equal(isAdminRole('super_admin'), true)
    assert.equal(isAdminRole('citizen'), false)
    assert.equal(isAdminRole(''), false)
    assert.equal(isAdminRole(null), false)
    assert.equal(isAdminRole(undefined), false)
  })
})

describe('isAdminUser', () => {
  it('requires the privileged role to live in app_metadata', () => {
    assert.equal(isAdminUser({ app_metadata: { role: 'admin' } }), true)
    assert.equal(isAdminUser({ app_metadata: { role: 'citizen' } }), false)
    assert.equal(isAdminUser({}), false)
    assert.equal(isAdminUser(null), false)
  })
})
