'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, PackageCheck, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { BARANGAY_CITY, BARANGAY_DISPLAY_NAME, BARANGAY_PROVINCE } from '@/lib/barangay'
import { buildRequestTrackingNumber } from '@/lib/tracking'
import { useLocale } from '@/hooks/use-locale'

/**
 * Citizen view of document pickups. Shows the claim code and status for each
 * document being processed; the code can be shown at the counter or quoted to
 * anyone picking the document up on the resident's behalf.
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
  requests?: { id: string; title: string | null; category: string | null } | null
}

const STATUS_BADGES: Record<string, string> = {
  preparing: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  ready: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  claimed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  preparing: 'Being prepared',
  ready: 'Ready for pickup',
  claimed: 'Claimed',
}

// These labels go through the dictionary at render time; the English strings
// above are the translation keys.

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium' })
  } catch {
    return value
  }
}

function formatDateTime(value: string | null) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

function escapeSlipText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Dedicated printable claim slip. Builds a standalone half-page document with
 * the barangay letterhead, the claim code in a prominent box, a QR deep link
 * back to /track, and pickup instructions — mirroring the print-window pattern
 * used by the admin certificate print.
 */
function buildClaimSlipMarkup(
  pickup: PickupRow,
  residentName: string,
  qrDataUrl: string | null,
) {
  const documentTitle = pickup.document_title ?? pickup.requests?.title ?? 'Document'
  const category = pickup.requests?.category
  const trackingCode = pickup.requests?.id ? buildRequestTrackingNumber(pickup.requests.id) : null
  const readyAt = formatDateTime(pickup.ready_at)
  const printedAt = formatDateTime(new Date().toISOString())
  const notes = pickup.notes?.trim()

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Document Claim Slip — ${escapeSlipText(pickup.pickup_code)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #f1f5f9; }
      .slip { width: 160mm; margin: 10mm auto; padding: 10mm 12mm; background: white; border: 1px solid #cbd5e1; }
      .header { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #047857; padding-bottom: 10px; }
      .logo { width: 56px; height: 56px; border-radius: 999px; object-fit: cover; border: 1px solid #cbd5e1; }
      .office { text-align: center; flex: 1; }
      .office-name { font-size: 15px; font-weight: 800; margin: 0; }
      .office-sub { font-size: 10px; color: #475569; margin: 2px 0 0; }
      .slip-title { text-align: center; letter-spacing: 0.25em; text-transform: uppercase; font-size: 11px; font-weight: 700; color: #047857; margin: 12px 0 0; }
      .claim-box { margin: 14px auto 0; width: fit-content; border: 2px dashed #047857; border-radius: 10px; padding: 10px 26px; text-align: center; }
      .claim-label { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #475569; margin: 0 0 4px; }
      .claim-code { font-family: 'Courier New', monospace; font-size: 30px; font-weight: 800; letter-spacing: 0.12em; margin: 0; color: #047857; }
      .details { margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
      .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin: 0 0 2px; }
      .value { font-size: 12px; font-weight: 600; margin: 0; white-space: pre-wrap; }
      .footer { margin-top: 16px; display: flex; align-items: center; gap: 16px; }
      .qr { width: 84px; height: 84px; flex: none; }
      .instructions { font-size: 11px; line-height: 1.6; color: #334155; margin: 0; }
      .signature-row { margin-top: 28px; display: flex; justify-content: space-between; gap: 32px; }
      .signature { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; color: #475569; }
      .signature-label { font-weight: 700; color: #0f172a; }
      .printed-note { margin-top: 14px; text-align: center; font-size: 9px; color: #94a3b8; }
      @media print { body { background: white; } .slip { width: auto; margin: 0; padding: 0; border: none; } }
    </style>
  </head>
  <body>
    <div class="slip">
      <div class="header">
        <img src="/lingkod-logo.png" alt="Barangay logo" class="logo" />
        <div class="office">
          <p class="office-name">Republic of the Philippines · ${escapeSlipText(BARANGAY_PROVINCE)}</p>
          <p class="office-sub"><strong>${escapeSlipText(BARANGAY_DISPLAY_NAME)}</strong> · ${escapeSlipText(BARANGAY_CITY)}<br />Office of the Punong Barangay</p>
        </div>
      </div>
      ${buildClaimSlipBody(pickup, residentName, documentTitle, category, trackingCode, readyAt, notes, qrDataUrl, printedAt)}
    </div>
  </body>
</html>`
}

function buildClaimSlipBody(
  pickup: PickupRow,
  residentName: string,
  documentTitle: string,
  category: string | null | undefined,
  trackingCode: string | null,
  readyAt: string | null,
  notes: string | undefined,
  qrDataUrl: string | null,
  printedAt: string | null,
) {
  return `
      <p class="slip-title">Document Claim Slip</p>

      <div class="claim-box">
        <p class="claim-label">Claim Code</p>
        <p class="claim-code">${escapeSlipText(pickup.pickup_code)}</p>
      </div>

      <div class="details">
        <div>
          <p class="label">Document</p>
          <p class="value">${escapeSlipText(documentTitle)}</p>
        </div>
        ${category ? `<div><p class="label">Category</p><p class="value">${escapeSlipText(category)}</p></div>` : ''}
        <div>
          <p class="label">Requesting Resident</p>
          <p class="value">${escapeSlipText(residentName || 'N/A')}</p>
        </div>
        ${trackingCode ? `<div><p class="label">Tracking Code</p><p class="value">${escapeSlipText(trackingCode)}</p></div>` : ''}
        <div>
          <p class="label">Marked Ready</p>
          <p class="value">${escapeSlipText(readyAt ?? '—')}</p>
        </div>
        ${notes ? `<div style="grid-column: 1 / -1;"><p class="label">Notes</p><p class="value">${escapeSlipText(notes)}</p></div>` : ''}
      </div>

      <div class="footer">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR code to track this pickup" class="qr" />` : ''}
        <p class="instructions">
          Present this slip with the claim code above at the barangay hall to release the document.
          The code may also be quoted to an authorized representative picking the document up on the
          resident's behalf; the representative must show one valid government-issued ID.
          ${qrDataUrl ? 'Scan the QR code anytime to check the status of this pickup without logging in.' : ''}
        </p>
      </div>

      <div class="signature-row">
        <div class="signature">
          <span class="signature-label">Released by (staff)</span><br />
          Signature over printed name / date &amp; time
        </div>
        <div class="signature">
          <span class="signature-label">Received by (claimant)</span><br />
          Signature over printed name / date &amp; time
        </div>
      </div>

      <p class="printed-note">Printed from LingkodBayan on ${escapeSlipText(printedAt ?? '—')} · Keep this slip until the document is claimed.</p>`
}

async function printClaimSlip(
  pickup: PickupRow,
  residentName: string,
  popupBlockedMessage: string,
) {
  // QR deep link is generated lazily on print so the `qrcode` bundle is never
  // part of the initial page load (same approach as the public track page).
  let qrDataUrl: string | null = null
  try {
    const QRCode = await import('qrcode')
    const trackCode = pickup.requests?.id ? buildRequestTrackingNumber(pickup.requests.id) : null
    if (trackCode) {
      qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/track?code=${encodeURIComponent(trackCode)}`, {
        width: 168,
        margin: 1,
      })
    }
  } catch {
    // The slip prints fine without the QR; never block printing on it.
  }

  const printWindow = window.open('', '_blank', 'width=760,height=980')
  if (!printWindow) {
    window.alert(popupBlockedMessage)
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildClaimSlipMarkup(pickup, residentName, qrDataUrl))
  printWindow.document.close()
  printWindow.focus()

  const triggerPrint = () => printWindow.print()
  if (printWindow.document.readyState === 'complete') {
    triggerPrint()
  } else {
    printWindow.onload = triggerPrint
  }
}

export default function DocumentPickupsPage() {
  const { t } = useLocale()
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [residentName, setResidentName] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const resident = await getOrCreateResidentProfile(supabase, user)
        if (!resident || cancelled) return
        setResidentName(`${resident.first_name ?? ''} ${resident.last_name ?? ''}`.trim())

        const { data, error: queryError } = await supabase
          .from('document_pickups')
          .select('id, status, pickup_code, document_title, scheduled_date, ready_at, claimed_at, notes, requests(id, title, category)')
          .eq('resident_id', resident.id)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (queryError) throw queryError
        setPickups((data ?? []) as unknown as PickupRow[])
      } catch (loadError: any) {
        if (!cancelled) {
          // Older deployments without migration 31 land here — show an empty
          // state instead of an error wall.
          if (!/document_pickups/i.test(loadError?.message ?? '')) {
            setError(t('Could not load your document pickups. Please refresh the page.'))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('Document Pickups')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Documents being processed for you. When a document is ready, present the claim code at the barangay hall — or share it with the person picking it up for you.')}
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : pickups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t('No document pickups yet. When barangay staff process one of your document requests, it will appear here.')}{' '}
              <Link href="/citizen/request-service" className="underline hover:text-foreground">
                {t('File one from Request Service')}
              </Link>.
            </p>
          </CardContent>
        </Card>
      ) : (
        pickups.map((pickup) => (
          <Card key={pickup.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {pickup.document_title ?? pickup.requests?.title ?? 'Document'}
                  </CardTitle>
                  <CardDescription className="font-mono text-sm">{pickup.pickup_code}</CardDescription>
                </div>
                <Badge variant="outline" className={STATUS_BADGES[pickup.status]}>
                  {t(STATUS_LABELS[pickup.status])}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('Expected ready')}</p>
                <p className="font-medium text-foreground">{formatDate(pickup.scheduled_date)}</p>
              </div>
              {pickup.status === 'ready' ? (
                <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-800 dark:text-sky-300">
                  {t('Present claim code {code} at the barangay hall to release your document.', {
                    code: pickup.pickup_code,
                  })}
                </p>
              ) : null}
              {pickup.status === 'claimed' ? (
                <p className="text-muted-foreground">
                  {t('Claimed on {date}', { date: formatDate(pickup.claimed_at) })}.
                </p>
              ) : null}
              {pickup.notes ? <p className="text-xs text-muted-foreground">{pickup.notes}</p> : null}
              {pickup.status === 'ready' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void printClaimSlip(
                      pickup,
                      residentName,
                      t('Your browser blocked the claim-slip window. Please allow pop-ups for this site and try again.'),
                    )
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {t('Print claim slip')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
