// Type-only import: erased at build time, and it keeps this module loadable by
// the plain `node --test` runner (next/server has no direct Node export).
import type { NextRequest } from 'next/server'
// Relative import with an explicit extension instead of the `@/lib/...` alias
// for the same reason — Node's test runner resolves neither the tsconfig
// `paths` alias nor extensionless specifiers.
import { logger } from './logger.ts'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function verifyOrigin(request: NextRequest): { valid: boolean; origin: string | null } {
  const origin = request.headers.get('origin') || request.headers.get('referer')?.split('?')[0] || null

  if (!origin) {
    return { valid: true, origin: null }
  }

  const originUrl = parseUrl(origin)

  if (!originUrl) {
    // e.g. `Origin: null` from a sandboxed document — never treat as trusted.
    logger.warn('Origin verification failed', {
      context: 'security',
      origin,
      path: request.nextUrl.pathname,
    })
    return { valid: false, origin }
  }

  // Same-origin: the Origin/Referer host is the exact host the request was
  // delivered to (the Host / X-Forwarded-Host header, which the browser also
  // used to build the Origin). This accepts every host the app is legitimately
  // served from — localhost, 127.0.0.1, LAN IPs, tunnels, any deployment
  // domain — without requiring NEXT_PUBLIC_APP_URL to match, while still
  // rejecting cross-origin requests, which is the CSRF threat this check exists
  // for. Browsers cannot forge Host/X-Forwarded-Host on a cross-site request,
  // so an attacker can never satisfy this condition. The protocol is
  // deliberately not compared: TLS-terminating proxies rewrite https → http
  // upstream, and protocol alone carries no CSRF signal.
  const host = (
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    ''
  ).toLowerCase()

  const sameOrigin = Boolean(host) && originUrl.host === host

  // Env allow-list (NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL / localhost),
  // kept as a fallback for proxies that rewrite the Host header to an internal
  // address — there the public origin is only expressible via configuration.
  const allowedByConfig = ALLOWED_ORIGINS.some((allowedOrigin) => {
    if (!allowedOrigin) return false
    const allowedUrl = parseUrl(allowedOrigin)
    if (!allowedUrl) return false
    return allowedUrl.hostname === originUrl.hostname && allowedUrl.protocol === originUrl.protocol
  })

  const allowed = sameOrigin || allowedByConfig

  if (!allowed) {
    logger.warn('Origin verification failed', {
      context: 'security',
      origin,
      host,
      path: request.nextUrl.pathname,
    })
  }

  return { valid: allowed, origin }
}

export function verifyContentType(
  request: NextRequest,
  // Allow multipart/form-data so file uploads (e.g. official photos, announcement
  // images) can pass the security gate. Origin verification and the authenticated
  // session cookie still protect these routes from cross-origin/unauthorized use.
  allowedTypes: string[] = ['application/json', 'multipart/form-data'],
): boolean {
  const contentType = request.headers.get('content-type') || ''
  return allowedTypes.some((type) => contentType.includes(type))
}

export function verifyRequest(request: NextRequest, allowedContentTypes?: string[]): { valid: boolean; error?: string } {
  const { valid: originValid } = verifyOrigin(request)

  if (!originValid) {
    return { valid: false, error: 'Invalid origin' }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const contentTypeValid = verifyContentType(request, allowedContentTypes)
    if (!contentTypeValid) {
      return { valid: false, error: 'Invalid content type' }
    }
  }

  return { valid: true }
}
