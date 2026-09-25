import 'server-only'

/**
 * Server-only audit logging.
 *
 * This module imports the Supabase service-role client, so it must never be
 * imported from a client component. Client components should use
 * `logAdminActionClient` from `@/lib/audit-log-client` instead, which posts to
 * `/api/admin/audit-logs` and lets the server attach the acting admin.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export interface AuditLogEntry {
  adminId: string
  adminEmail?: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditAction(entry: AuditLogEntry): Promise<void> {
  try {
    const adminClient = createAdminClient()

    await adminClient.from('audit_logs').insert({
      admin_id: entry.adminId,
      admin_email: entry.adminEmail ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    })
  } catch (error) {
    logger.error('Failed to write audit log', error, {
      context: 'audit',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    })
  }
}

