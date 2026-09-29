/**
 * Authorization role resolution shared by middleware, API routes, and pages.
 *
 * Deliberately dependency-free (no Supabase clients, no `next/headers`) so the
 * same module can be imported from middleware, route handlers, and React
 * components without dragging server-only code into the edge bundle.
 */

/** Role values the app distinguishes. Residents have no explicit role. */
export type AppRole = 'citizen' | 'admin' | 'super_admin'

type RoleCarrier = { app_metadata?: Record<string, unknown> | null } | null | undefined

/**
 * Reads the caller's role from `app_metadata` ONLY.
 *
 * `user_metadata` must never drive authorization: Supabase lets the signed-in
 * user rewrite it from the browser (`supabase.auth.updateUser({ data: { role:
 * 'admin' } })`), so trusting it let any resident be treated as an admin.
 * `app_metadata` is writable only with the service-role key, which is how
 * admins are provisioned (`scripts/setup_admin_account.js` writes
 * `app_metadata.role` alongside the informational `user_metadata.role`).
 *
 * Returns `null` when no role is set, which callers treat as a plain resident.
 */
export function getUserRole(user: RoleCarrier): string | null {
  const role = user?.app_metadata?.role
  return typeof role === 'string' && role.trim() ? role.trim() : null
}

/** True only for the two privileged roles. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

/** Convenience guard for route handlers: `if (!isAdminUser(user)) → 403`. */
export function isAdminUser(user: RoleCarrier): boolean {
  return isAdminRole(getUserRole(user))
}
