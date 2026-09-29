import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isAdminUser } from './roles'

/**
 * Resolves the caller of an `/api/admin/*` request to an authenticated admin.
 *
 * Middleware only guards page routes (`/admin/*`), never `/api/*`, so every
 * admin API handler must enforce the role itself before it touches the
 * service-role client (which bypasses RLS). The check reads `app_metadata`
 * only — `user_metadata` is writable by the signed-in user and must never be
 * treated as an authorization signal. Admins are provisioned with
 * `app_metadata.role` by `scripts/setup_admin_account.js`.
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

  const isAdmin = isAdminUser(user)

  return isAdmin ? user : null
}
