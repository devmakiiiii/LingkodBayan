'use client'

import { useEffect } from 'react'

function parseSessionCandidate(value: string) {
  try {
    return JSON.parse(value) as any
  } catch {
    return null
  }
}

function hasValidRefreshToken(candidate: any) {
  if (!candidate || typeof candidate !== 'object') {
    return false
  }

  const session = candidate.currentSession || candidate.session || candidate
  return Boolean(session && typeof session.refresh_token === 'string' && session.refresh_token.trim())
}

function clearInvalidSupabaseAuthStorage() {
  if (typeof window === 'undefined') {
    return
  }

  const storage = window.localStorage
  const keysToCheck = Object.keys(storage).filter((key) => key.includes('auth-token'))
  let cleared = false

  keysToCheck.forEach((key) => {
    const rawValue = storage.getItem(key)
    if (!rawValue) {
      return
    }

    const parsed = parseSessionCandidate(rawValue)
    if (!hasValidRefreshToken(parsed)) {
      storage.removeItem(key)
      cleared = true
    }
  })

  if (cleared) {
    window.dispatchEvent(new Event('storage'))
  }
}

export function SupabaseSessionGuard() {
  useEffect(() => {
    clearInvalidSupabaseAuthStorage()
  }, [])

  return null
}