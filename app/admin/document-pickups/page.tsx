'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, PackageCheck, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRelativeDate } from '@/lib/format-date'

/**
 * Document pickup management (clearance claiming). Staff register a pickup
 * for a processed document request, mark it ready (generates the claim code
 * and notifies the resident), and mark it claimed at the counter.
 */

type PickupRow = {
  id: string
  status: 'preparing' | 'ready' | 'claimed'
  pickup_code: string
  document_title: string | null
  scheduled_date: string | null
  ready_at: string | null
  claimed_at: string | null
  notes: string | null
  /** The payment ledger is 1:1 with requests and PostgREST always nests it
   *  under the `requests` embed; absent for legacy requests with no payment. */
  requests?:
    | {
        id: string
        title: string | null
        category: string | null
        /** request_id is UNIQUE, so PostgREST returns this embed as a single
         *  object (or null) — never an array. */
        request_payments?: PaymentInfo | null
      }
    | null
  residents?: { first_name: string | null; last_name: string | null; email: string | null } | null
}

type PaymentInfo = {
  payment_status: 'unpaid' | 'pending_verification' | 'paid' | 'free'
  payment_method: 'pay_at_counter' | 'gcash' | 'maya'
  amount_paid: number
  reference_number: string | null
  fee_description: string | null
}

const STATUS_BADGES: Record<string, string> = {
  preparing: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  ready: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  claimed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
}

function residentName(pickup: PickupRow) {
  const person = pickup.residents
  if (!person) return 'Unknown'
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.email || 'Unnamed resident'
}

const PAYMENT_BADGES: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  free: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  pending_verification: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  unpaid: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Paid',
  free: 'Free of Charge',
  pending_verification: 'Awaiting Verification',
  unpaid: 'To Pay at Counter',
}

/** The joined payment row arrives nested under the `requests` embed. Because
 *  `request_payments.request_id` is UNIQUE, PostgREST returns the embed as a
 *  single object (not an array); it is null when no payment row exists. */
function paymentOf(pickup: PickupRow): PaymentInfo | null {
  return pickup.requests?.request_payments ?? null
}

export default function DocumentPickupsPage() {
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [requestCode, setRequestCode] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/document-pickups')
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      setError(data?.error || 'Failed to load pickups.')
      return
    }
    setPickups(data.pickups ?? [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/document-pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestCode: requestCode.trim(),
          documentTitle: documentTitle.trim() || undefined,
          scheduledDate: scheduledDate || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'Failed to register the pickup.')
        return
      }
      setSuccessMessage('Pickup registered. Mark it "Ready" when the signed document is at the counter.')
      setRequestCode('')
      setDocumentTitle('')
      setScheduledDate('')
      setNotes('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(pickupId: string, status: 'ready' | 'claimed') {
    setError(null)
    setSuccessMessage(null)
    setUpdatingId(pickupId)
    try {
      const response = await fetch('/api/admin/document-pickups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupId, status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'Failed to update the pickup.')
        return
      }
      setSuccessMessage(
        status === 'ready'
          ? 'Marked ready — the resident has been notified with the claim code.'
          : 'Marked claimed.',
      )
      await load()
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Document Pickups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track signed documents from processing to counter release. Residents are notified when a
          document is ready and can present the claim code — printed on their stub or shown in the
          portal.
        </p>
      </div>

      {successMessage ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Register a pickup</CardTitle>
          <CardDescription>
            Use the tracking code from the resident&apos;s stub (e.g. REQ-1A2B3C4D).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="request-code">Tracking code</Label>
              <Input
                id="request-code"
                placeholder="REQ-1A2B3C4D"
                value={requestCode}
                onChange={(event) => setRequestCode(event.target.value)}
                autoCapitalize="characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Expected ready date (optional)</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-title">Document title (optional)</Label>
              <Input
                id="document-title"
                placeholder="e.g., Barangay Clearance"
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-notes">Notes (optional)</Label>
              <Input
                id="pickup-notes"
                placeholder="e.g., Waiting for signature"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Register Pickup
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All pickups</CardTitle>
          <CardDescription>Newest first. &ldquo;Ready&rdquo; notifies the resident with the claim code.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : pickups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pickups registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim code</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Resident</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickups.map((pickup) => (
                    <TableRow key={pickup.id}>
                      <TableCell className="font-mono font-semibold">{pickup.pickup_code}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {pickup.document_title ?? pickup.requests?.title ?? '—'}
                      </TableCell>
                      <TableCell>{residentName(pickup)}</TableCell>
                      {(() => {
                        const payment = paymentOf(pickup)
                        return (
                          <TableCell>
                            {payment ? (
                              <div className="space-y-1">
                                <Badge variant="outline" className={PAYMENT_BADGES[payment.payment_status]}>
                                  {PAYMENT_LABELS[payment.payment_status]}
                                </Badge>
                                {payment.payment_status === 'unpaid' && payment.amount_paid > 0 ? (
                                  <p className="text-xs font-medium text-amber-700">
                                    Collect &#8369;{payment.amount_paid.toLocaleString('en-PH', { maximumFractionDigits: 2 })} on release
                                  </p>
                                ) : null}
                                {payment.payment_status === 'pending_verification' && payment.reference_number ? (
                                  <p className="text-xs text-muted-foreground font-mono">Ref: {payment.reference_number}</p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No record</span>
                            )}
                          </TableCell>
                        )
                      })()}
                      <TableCell>{pickup.scheduled_date ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGES[pickup.status]}>
                          {pickup.status === 'preparing' ? 'Preparing' : pickup.status === 'ready' ? 'Ready' : 'Claimed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {pickup.status === 'preparing' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updatingId === pickup.id}
                            onClick={() => updateStatus(pickup.id, 'ready')}
                          >
                            {updatingId === pickup.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PackageCheck className="mr-1 h-3 w-3" />}
                            Mark Ready
                          </Button>
                        ) : pickup.status === 'ready' ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={updatingId === pickup.id}
                              onClick={() => updateStatus(pickup.id, 'claimed')}
                            >
                              {updatingId === pickup.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BadgeCheck className="mr-1 h-3 w-3" />}
                              Mark Claimed
                            </Button>
                            {(() => {
                              const payment = paymentOf(pickup)
                              if (payment && (payment.payment_status === 'unpaid' || payment.payment_status === 'pending_verification')) {
                                return (
                                  <span className="max-w-40 text-right text-[11px] leading-tight font-medium text-amber-700">
                                    {payment.payment_status === 'unpaid'
                                      ? `Unpaid — collect ₱${payment.amount_paid.toLocaleString('en-PH', { maximumFractionDigits: 2 })} first`
                                      : 'Payment not yet verified'}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Claimed {pickup.claimed_at ? formatRelativeDate(pickup.claimed_at) : ''}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
