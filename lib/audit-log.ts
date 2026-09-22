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

export interface ClientAuditLogEntry {
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}

/**
 * Browser-safe variant of logAuditAction. Use this from client components:
 * it posts to the admin API route, which verifies the admin session and
 * attaches the acting admin's identity server-side.
 */
export async function logAdminActionClient(entry: ClientAuditLogEntry): Promise<void> {
  try {
    await fetch('/api/admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  } catch (error) {
    logger.error('Failed to submit audit log', error, {
      context: 'audit',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
    })
  }
}
