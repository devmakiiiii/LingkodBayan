import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  if (!hasSupabaseConfig()) {
    return response
  }
  
  // Get user from session to check role
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Redirect logic for role-based access
  if (user) {
    const userRole = user.user_metadata?.role || user.app_metadata?.role || 'citizen'
    
    // If admin tries to access citizen routes
    if (pathname.startsWith('/citizen') && (userRole === 'admin' || userRole === 'super_admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
    
    // If citizen tries to access admin routes
    if (pathname.startsWith('/admin') && userRole !== 'admin' && userRole !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/citizen'
      return NextResponse.redirect(url)
    }

    // Verification gate for citizen routes
    if (userRole === 'citizen' && pathname.startsWith('/citizen')) {
      // Allow access to these paths without verification check
      const allowedPaths = [
        '/citizen/verify-id',
        '/citizen/dashboard',
        '/citizen/announcements',
        '/citizen/notifications',
      ]
      const isAllowedPath = allowedPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))

      if (!isAllowedPath) {
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
    // Not logged in and trying to access protected routes
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
