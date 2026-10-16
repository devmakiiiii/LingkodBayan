import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getEnvConfig } from '../../env.config'

function hasSupabaseConfig() {
  const config = getEnvConfig()
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

function hasSupabaseAuthCookies(request: NextRequest) {
  // @supabase/ssr stores the session in cookies named `sb-<project-ref>-auth-token`
  // (chunked versions use `sb-<project-ref>-auth-token.<n>`). If none are present,
  // there is no session and we can skip the getUser() network round-trip entirely.
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig() || !hasSupabaseAuthCookies(request)) {
    return { response: NextResponse.next({ request }), user: null }
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const config = getEnvConfig()

  const supabase = createServerClient(
    config.supabaseUrl!,
    config.supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    request.nextUrl.pathname.startsWith('/protected') &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return { response: NextResponse.redirect(url), user: null }
  }

  return { response: supabaseResponse, user }
}
