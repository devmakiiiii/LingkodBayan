import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyRequest } from '@/lib/request-security'
import { logger } from '@/lib/logger'

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

const createAuditLogSchema = z.object({
  action: z.string().trim().min(1, 'Action is required').max(100),
  resourceType: z.string().trim().min(1, 'Resource type is required').max(100),
  resourceId: z.string().trim().max(200).optional(),
  oldValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
})

async function getAdminFromRequest(request: NextRequest) {
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

  const isAdmin = !!user && (
    user.user_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'super_admin' ||
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.role === 'super_admin'
  )

  return isAdmin ? user : null
}

export async function GET(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const user = await getAdminFromRequest(request)

  if (!user) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const resourceType = url.searchParams.get('resourceType')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limitParam = parseInt(url.searchParams.get('limit') || '', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : DEFAULT_LIMIT

    const adminClient = createAdminClient()

    let query = adminClient
      .from('audit_logs')
      .select('id, admin_id, admin_email, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (action) {
      query = query.eq('action', action)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) {
        query = query.gte('created_at', fromDate.toISOString())
      }
    }

    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) {
        toDate.setDate(toDate.getDate() + 1)
        query = query.lt('created_at', toDate.toISOString())
      }
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error fetching audit logs', error, { context: 'api/admin/audit-logs' })
      return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 })
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error: unknown) {
    logger.error('Error in GET /api/admin/audit-logs', error, { context: 'api/admin/audit-logs' })
    const message = error instanceof Error ? error.message : 'Failed to fetch audit logs.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const validated = createAuditLogSchema.parse(body)

    const adminClient = createAdminClient()

    const { error } = await adminClient.from('audit_logs').insert({
      admin_id: user.id,
      admin_email: user.email ?? null,
      action: validated.action,
      resource_type: validated.resourceType,
      resource_id: validated.resourceId ?? null,
      old_values: validated.oldValues ?? null,
      new_values: validated.newValues ?? null,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    })

    if (error) {
      logger.error('Error writing audit log', error, { context: 'api/admin/audit-logs' })
      return NextResponse.json({ error: error.message || 'Failed to write audit log' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error in POST /api/admin/audit-logs', error, { context: 'api/admin/audit-logs' })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to write audit log.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
