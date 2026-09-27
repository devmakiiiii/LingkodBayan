import { NextRequest, NextResponse } from 'next/server'

import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildComplaintTrackingNumber,
  buildRequestTrackingNumber,
  getPublicStatusLabel,
  normalizeTrackingCode,
  parseTrackingCode,
  trackingCodeToIdPrefix,
  type TrackedKind,
} from '@/lib/tracking'

/**
 * Public, no-login status lookup. Anyone holding a tracking code can check
 * where their submission stands — designed for kiosks, proxies, printed
 * stubs, and residents without their own device.
 *
 * Only non-personal fields are returned: the resident's name, contact
 * details, and descriptions stay server-side.
 */

const CODE_QUERY_MAX_LENGTH = 40

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit({ interval: 60 * 1000, limit: 15 })(request)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many lookups. Please try again in a minute.' }, { status: 429 })
  }

  const code = request.nextUrl.searchParams.get('code') ?? ''
  if (code.length > CODE_QUERY_MAX_LENGTH) {
    return NextResponse.json({ error: 'Invalid tracking code.' }, { status: 400 })
  }

  const normalized = normalizeTrackingCode(code)
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid tracking code. Use a code like REQ-1A2B3C4D, RPT-1A2B3C4D, or FB-20260101-AB3K.' }, { status: 400 })
  }

  const kind = parseTrackingCode(normalized)
  if (!kind) {
    return NextResponse.json({ error: 'Invalid tracking code.' }, { status: 400 })
  }

  try {
    const result = await lookup(normalized, kind)
    if (!result) {
      return NextResponse.json({ error: 'No submission found for that tracking code.' }, { status: 404 })
    }
    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('Error in GET /api/public/track:', error)
    return NextResponse.json({ error: error.message || 'Failed to look up tracking code' }, { status: 500 })
  }
}

type TrackResult = {
  kind: TrackedKind
  kindLabel: string
  code: string
  title: string | null
  category: string | null
  status: string | null
  statusLabel: string
  createdAt: string | null
  updatedAt: string | null
  pickup?: {
    status: string
    statusLabel: string
    pickupCode: string
    documentTitle: string | null
    scheduledDate: string | null
    readyAt: string | null
    claimedAt: string | null
  } | null
}

const KIND_LABELS: Record<TrackedKind, string> = {
  request: 'Service Request',
  complaint: 'Complaint / Report',
  feedback: 'Feedback',
}

/**
 * Minimal id-prefix lookup. The tracking code embeds the first 8 hex chars of
 * the row's UUID; there can be at most a handful of collisions across the
 * whole table, so fetch all matches and disambiguate by created_at ordering.
 */
async function lookup(normalized: string, kind: TrackedKind): Promise<TrackResult | null> {
  const adminClient = createAdminClient()

  if (kind === 'feedback') {
    const { data, error } = await adminClient
      .from('feedback')
      .select('tracking_number, category, subject, status, created_at, updated_at')
      .eq('tracking_number', normalized)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) return null

    return {
      kind,
      kindLabel: KIND_LABELS[kind],
      code: row.tracking_number || normalized,
      title: row.subject ?? null,
      category: row.category ?? null,
      status: row.status ?? null,
      statusLabel: getPublicStatusLabel(kind, row.status),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    }
  }

  const idPrefix = trackingCodeToIdPrefix(normalized)
  if (!idPrefix) return null

  const table = kind === 'request' ? 'requests' : 'complaints'
  const columns =
    kind === 'request'
      ? 'id, title, category, status, created_at, updated_at, request_type'
      : 'id, tracking_number, title, category, status, created_at, updated_at'
  // startsWith emulation: gte(prefix) + lt(prefix + '\uffff') uses the primary
  // key index and avoids fragile SQL.
  const { data, error } = await adminClient
    .from(table)
    .select(columns)
    .gte('id', idPrefix)
    .lt('id', idPrefix + '\uffff')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)
  const row = data?.[0] as any
  if (!row) return null

  const code =
    kind === 'request' || !row.tracking_number
      ? kind === 'request'
        ? buildRequestTrackingNumber(row.id)
        : buildComplaintTrackingNumber(row.id)
      : row.tracking_number

  return {
    kind,
    kindLabel: KIND_LABELS[kind],
    code,
    title: row.title ?? null,
    category: row.category ?? null,
    status: row.status ?? null,
    statusLabel: getPublicStatusLabel(kind, row.status),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    pickup: kind === 'request' ? await lookupPickup(adminClient, row.id) : null,
  }
}

/**
 * Pickup info for a document request. Only status/codes are exposed — the
 * claim code is intentionally included because the whole point is that the
 * bearer of the tracking/claim stub can verify readiness at the counter.
 */
async function lookupPickup(adminClient: ReturnType<typeof createAdminClient>, requestId: string) {
  const { data, error } = await adminClient
    .from('document_pickups')
    .select('status, pickup_code, document_title, scheduled_date, ready_at, claimed_at')
    .eq('request_id', requestId)
    .limit(1)

  if (error || !data?.length) return null
  const pickup = data[0] as any
  const labels: Record<string, string> = {
    preparing: 'Being prepared',
    ready: 'Ready for pickup',
    claimed: 'Claimed',
  }
  return {
    status: pickup.status,
    statusLabel: labels[pickup.status] ?? pickup.status,
    pickupCode: pickup.pickup_code,
    documentTitle: pickup.document_title ?? null,
    scheduledDate: pickup.scheduled_date ?? null,
    readyAt: pickup.ready_at ?? null,
    claimedAt: pickup.claimed_at ?? null,
  }
}
