import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Resolves the caller of an `/api/admin/*` request to an authenticated admin.
 *
 * Middleware only guards page routes (`/admin/*`), never `/api/*`, so every
 * admin API handler must enforce the role itself before it touches the
 * service-role client (which bypasses RLS). Admins get `role: 'admin'` written
 * into both `user_metadata` and `app_metadata` by `scripts/setup_admin_account.js`,
 * so both are checked here for parity with `middleware.ts`.
 */
export async function getAdminFromRequest(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdmin =
    !!user &&
    (user.user_metadata?.role === 'admin' ||
      user.user_metadata?.role === 'super_admin' ||
      user.app_metadata?.role === 'admin' ||
      user.app_metadata?.role === 'super_admin')

  return isAdmin ? user : null
}
