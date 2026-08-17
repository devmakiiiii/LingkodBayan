import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

export function verifyOrigin(request: NextRequest): { valid: boolean; origin: string | null } {
  const origin = request.headers.get('origin') || request.headers.get('referer')?.split('?')[0] || null

  if (!origin) {
    return { valid: true, origin: null }
  }

  const allowed = ALLOWED_ORIGINS.some((allowedOrigin) => {
    if (!allowedOrigin) return false
    try {
      const allowedUrl = new URL(allowedOrigin)
      const requestUrl = new URL(origin)
      return allowedUrl.hostname === requestUrl.hostname && allowedUrl.protocol === requestUrl.protocol
    } catch {
      return false
    }
  })

  if (!allowed) {
    logger.warn('Origin verification failed', {
      context: 'security',
      origin,
      path: request.nextUrl.pathname,
    })
  }

  return { valid: allowed, origin }
}

export function verifyContentType(request: NextRequest, allowedTypes: string[] = ['application/json']): boolean {
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
