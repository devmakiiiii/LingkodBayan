import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createCsrfToken, setCsrfCookie, csrfMiddleware } from '@/lib/csrf'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'

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
    const userRole = user.user_metadata?.role || user.app_metadata?.role || 'citizen'

    if (pathname.startsWith('/citizen') && (userRole === 'admin' || userRole === 'super_admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && userRole !== 'admin' && userRole !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/citizen'
      return NextResponse.redirect(url)
    }

    if (userRole === 'citizen' && pathname.startsWith('/citizen')) {
      const allowedPaths = [
        '/citizen/verify-id',
        '/citizen/dashboard',
        '/citizen/announcements',
        '/citizen/notifications',
      ]
      const isAllowedPath = allowedPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))

      if (!isAllowedPath) {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return request.cookies.getAll()
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                  response.cookies.set(name, value, options),
                )
              },
            },
          },
        )

        const { data: resident } = await supabase
          .from('residents')
          .select('verification_status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const status = resident?.verification_status
        if (status && status !== 'auto_verified' && status !== 'id_verified') {
          const url = request.nextUrl.clone()
          url.pathname = '/citizen/verify-id'
          return NextResponse.redirect(url)
        }
      }
    }
  } else if (pathname.startsWith('/citizen') || pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
