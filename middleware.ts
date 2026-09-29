import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { createCsrfToken, setCsrfCookie } from '@/lib/csrf'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'
import { getUserRole, isAdminRole } from '@/lib/roles'

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  if (!hasSupabaseConfig()) {
    return response
  }

  const pathname = request.nextUrl.pathname

  // Set CSRF cookie for mutation API routes
  if (pathname.startsWith('/api/') && ['POST', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfToken = createCsrfToken()
    const csrfResponse = setCsrfCookie(response, csrfToken)

    const securityCheck = verifyRequest(request)
    if (!securityCheck.valid) {
      logger.warn('Security check failed', {
        context: 'middleware',
        path: pathname,
        error: securityCheck.error,
      })
      return NextResponse.json({ error: securityCheck.error || 'Security check failed' }, { status: 403 })
    }

    return csrfResponse
  }

  if (user) {
    // app_metadata only: `user_metadata.role` is writable by the account holder.
    const userRole = getUserRole(user) ?? 'citizen'

    if (pathname.startsWith('/citizen') && isAdminRole(userRole)) {
      const url = request.nextUrl.clone()
      // Must be a real route: there is no app/citizen/page.tsx or
      // app/admin/page.tsx index, so redirecting to '/admin' or '/citizen'
      // lands on a 404. Both portals expose a dashboard as their entry point.
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && !isAdminRole(userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = '/citizen/dashboard'
      return NextResponse.redirect(url)
    }

    // Identity verification: enforcement lives in the RLS policy
    // "Verified residents can create requests" (migration 36), because requests
    // are inserted straight from the browser client and a redirect alone can be
    // bypassed. This redirect is UX only — it keeps a pending resident off the
    // request form and points them at the recovery path instead of showing a
    // form that will fail on submit.
    //
    // Scoped to the surfaces that actually file a service request. It must NOT
    // cover all of /citizen: migration 36 deliberately leaves complaints ungated,
    // and redirecting a resident away from /citizen/file-complaint would both
    // contradict that decision and read as silencing a public-safety channel.
    // Announcements, tracking, pickups, and notifications stay reachable; the
    // dashboard banner (components/citizen/verification-banner.tsx) is the
    // non-blocking nudge toward verifying.
    if (pathname.startsWith('/citizen') && userRole === 'citizen') {
      const REQUEST_FILING_PATHS = [
        '/citizen/request-service',
        '/citizen/proxy-filing',
      ]
      const isRequestFilingPage = REQUEST_FILING_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      )
      const status = user.user_metadata?.verification_status as string | undefined

      // Allowlist, not denylist, and it must stay in sync with the IN (...) list
      // in migration 36. A denylist of the known-pending statuses silently drifts:
      // a status added later is blocked by the RLS policy but not redirected here,
      // so that resident meets a raw Postgres policy error on submit instead of
      // being sent to /citizen/verify-id. Inverting the check makes the two
      // agree by construction — anything not explicitly verified gets redirected.
      const VERIFIED_STATUSES = ['auto_verified', 'id_verified']
      const isVerified = VERIFIED_STATUSES.includes(status ?? '')

      // `status === undefined` is the legacy-account case below: treat unknown as
      // pass-through rather than locking the resident out of their own portal.
      const needsVerification = status !== undefined && !isVerified

      if (isRequestFilingPage && needsVerification) {
        const url = request.nextUrl.clone()
        url.pathname = '/citizen/verify-id'
        url.searchParams.set('reason', 'verification-required')
        return NextResponse.redirect(url)
      }
    }
  } else if (pathname.startsWith('/citizen') || pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    // Remember where the resident was headed so the sign-in form can send them
    // straight there instead of always dropping them on a dashboard. Only the
    // path is carried, and the sign-in form re-validates it before redirecting.
    url.search = ''
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Skip middleware for Next.js internals and all static assets — these never
  // need auth/CSRF handling, so they shouldn't pay the middleware cost.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|_next/webpack-hmr|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|webmanifest|woff|woff2|ttf|otf|map)$).*)',
  ],
}
