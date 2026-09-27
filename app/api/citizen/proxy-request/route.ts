import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyResidentByUserId } from '@/lib/notify'
import { verifyRequest } from '@/lib/request-security'
import { z } from 'zod'

/**
 * Server-side filing of a service request on behalf of another resident.
 *
 * The route re-checks the active authorization server-side (defense in depth
 * on top of the requests RLS policy), inserts the request with the service
 * role, records the optional payment ledger row, and notifies the beneficiary
 * that a request was filed for them.
 */

const proxyRequestSchema = z.object({
  representedResidentId: z.string().uuid('Invalid represented resident'),
  requestType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  payload: z.record(z.string(), z.any()),
  payment: z.record(z.string(), z.any()).optional(),
})

export async function POST(request: NextRequest) {
  const securityCheck = verifyRequest(request)
  if (!securityCheck.valid) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = proxyRequestSchema.parse(await request.json())
    const adminClient = createAdminClient()

    // Resolve the acting resident.
    const { data: actingRows } = await adminClient
      .from('residents')
      .select('id, first_name, last_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const acting = (actingRows ?? [])[0]
    if (!acting) {
      return NextResponse.json({ error: 'Your resident profile was not found.' }, { status: 404 })
    }

    if (acting.id === body.representedResidentId) {
      return NextResponse.json({ error: 'Use the regular request flow to file for yourself.' }, { status: 400 })
    }

    // Defense in depth: re-verify the active authorization.
    const { count: activeCount, error: authError } = await adminClient
      .from('representative_authorizations')
      .select('id', { count: 'exact', head: true })
      .eq('represented_resident_id', body.representedResidentId)
      .eq('representative_resident_id', acting.id)
      .eq('status', 'active')

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }
    if (!activeCount) {
      return NextResponse.json({ error: 'You are not authorized to file for this resident.' }, { status: 403 })
    }

    const { data: created, error: insertError } = await adminClient
      .from('requests')
      .insert([
        {
          resident_id: body.representedResidentId,
          request_type: body.requestType,
          title: body.title,
          description: body.description,
          category: body.category,
          payload: body.payload,
          status: 'pending',
          priority: 'normal',
        },
      ])
      .select('id')
      .single()

    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create the request.' }, { status: 500 })
    }

    let paymentLedgerNote = ''
    if (body.payment) {
      const { error: paymentInsertError } = await adminClient.from('request_payments').insert([
        {
          request_id: created.id,
          resident_id: body.representedResidentId,
          ...body.payment,
        },
      ])
      if (paymentInsertError) {
        console.error('Failed to save proxy payment record:', paymentInsertError)
        paymentLedgerNote = ' Note: your payment details were saved with the request, but the payment ledger entry could not be recorded.'
      }
    }

    // Notify the beneficiary (best-effort).
    const { data: beneficiaryRows } = await adminClient
      .from('residents')
      .select('user_id')
      .eq('id', body.representedResidentId)
      .limit(1)
    const beneficiaryUserId = (beneficiaryRows ?? [])[0]?.user_id
    if (beneficiaryUserId) {
      const filerName = `${acting.first_name ?? ''} ${acting.last_name ?? ''}`.trim()
      await notifyResidentByUserId(beneficiaryUserId, {
        type: 'proxy_request_filed',
        title: 'A request was filed on your behalf',
        body: `${filerName || 'Your authorized representative'} submitted "${body.title}" for you. It is now pending review.`,
        link: '/citizen/my-requests',
      })
    }

    return NextResponse.json({ requestId: created.id, paymentLedgerNote })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation failed' }, { status: 400 })
    }
    console.error('Error in POST /api/citizen/proxy-request:', error)
    return NextResponse.json({ error: 'Failed to file the request on behalf of the resident.' }, { status: 500 })
  }
}
