import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { getAdminFromRequest } from '@/lib/admin-auth'
import { assertRequestTransition, IllegalStatusTransitionError } from '@/lib/status-machine'
import { logAuditAction } from '@/lib/audit-log'
import { logger } from '@/lib/logger'

const updateRequestStatusSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  status: z.string().min(1, 'Status is required'),
})

export async function PATCH(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getAdminFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = updateRequestStatusSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      )
    }

    const { requestId, status: targetStatus } = validated.data
    const adminClient = createAdminClient()

    // 1. Fetch current request status
    const { data: currentRequest, error: fetchError } = await adminClient
      .from('requests')
      .select('id, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const previousStatus = currentRequest.status

    // 2. Validate and assert transition via authoritative status machine
    let nextStatus: string
    try {
      nextStatus = assertRequestTransition(previousStatus, targetStatus)
    } catch (err: unknown) {
      if (err instanceof IllegalStatusTransitionError) {
        return NextResponse.json(
          {
            error:
              previousStatus && previousStatus.toLowerCase() === targetStatus.toLowerCase()
                ? `Request is already ${targetStatus}.`
                : `That status change is not allowed from "${previousStatus ?? 'pending'}".`,
          },
          { status: 422 },
        )
      }
      throw err
    }

    // 3. Update request status
    const { data: updatedRequest, error: updateError } = await adminClient
      .from('requests')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update request status', updateError, {
        context: 'api/admin/requests',
        requestId,
      })
      return NextResponse.json(
        { error: updateError.message || 'Failed to update request' },
        { status: 500 },
      )
    }

    // 4. Server-side audit log
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    await logAuditAction({
      adminId: user.id,
      adminEmail: user.email ?? undefined,
      action: 'request_status_updated',
      resourceType: 'request',
      resourceId: requestId,
      oldValues: previousStatus ? { status: previousStatus } : undefined,
      newValues: { status: nextStatus },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true, data: updatedRequest })
  } catch (error: unknown) {
    logger.error('Error in PATCH /api/admin/requests', error, {
      context: 'api/admin/requests',
    })
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
