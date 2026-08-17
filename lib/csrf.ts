import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'

const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'csrf_token'
const CSRF_TOKEN_LENGTH = 32

function generateToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < CSRF_TOKEN_LENGTH; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createCsrfToken(): string {
  return generateToken()
}

export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER)
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value

  if (!headerToken || !cookieToken) {
    return false
  }

  if (headerToken.length !== CSRF_TOKEN_LENGTH || cookieToken.length !== CSRF_TOKEN_LENGTH) {
    return false
  }

  return headerToken === cookieToken
}

export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
  return response
}

export function csrfMiddleware(request: NextRequest, response: NextResponse): NextResponse | null {
  const method = request.method

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  if (!validateCsrfToken(request)) {
    logger.warn('CSRF validation failed', {
      context: 'csrf',
      path: request.nextUrl.pathname,
      method,
    })
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }

  return null
}
