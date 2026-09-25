import { logger } from '@/lib/logger'

export interface ClientAuditLogEntry {
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}

/**
 * Browser-safe audit logging for client components.
 *
 * This module must stay free of server-only imports (it is bundled for the
 * browser). The acting admin's identity, IP address, and user agent are all
 * attached server-side by `POST /api/admin/audit-logs`, which also verifies the
 * admin session, so the client only supplies the event description.
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
