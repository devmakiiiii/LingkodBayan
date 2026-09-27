'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Printer, Search, ShieldCheck } from 'lucide-react'

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

// QR codes encode a deep link back to this page (?code=...) so a scanned stub
// re-opens the status lookup. The library is imported lazily inside the search
// handler so it never affects the initial page load.

/**
 * Public "Track my submission" page — no login required. Designed so a
 * resident, a family member, or barangay staff at a kiosk can check the
 * status of any submission using only the tracking code from the claim stub.
 */

type TrackResult = {
  kind: 'request' | 'complaint' | 'feedback'
  kindLabel: string
  code: string
  title: string | null
  category: string | null
  status: string | null
  statusLabel: string
  createdAt: string | null
  updatedAt: string | null
  pickup?: {
    status: 'preparing' | 'ready' | 'claimed' | string
    statusLabel: string
    pickupCode: string
    documentTitle: string | null
    scheduledDate: string | null
    readyAt: string | null
    claimedAt: string | null
  } | null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

const STATUS_TONES: Record<string, string> = {
  Pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Open: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Submitted: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  Processing: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'Under Review': 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  'Under Evaluation': 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  Acknowledged: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
  Approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  Resolved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'Response Sent': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  Rejected: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  Dismissed: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
}

type BarangayContact = {
  name: string | null
  address: string | null
  phone: string | null
  office_hours: string | null
}

export default function TrackPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TrackResult | null>(null)
  const [contact, setContact] = useState<BarangayContact | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Barangay contact details come from the same public settings endpoint the
  // landing page footer uses, so the printed stub shows accurate info.
  useEffect(() => {
    let cancelled = false
    fetch('/api/public/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.contact) setContact(data.contact as BarangayContact)
      })
      .catch(() => {
        // The stub still prints with the tracking code if settings are unavailable.
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runSearch(trimmed: string) {
    setError(null)
    setResult(null)
    setQrDataUrl(null)

    if (!trimmed) {
      setError('Please enter a tracking code.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/public/track?code=${encodeURIComponent(trimmed)}`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Lookup failed. Please try again.')
        return
      }
      setResult(data.result as TrackResult)

      // Generate the QR deep link only after a successful lookup so the stub
      // always points at a code that exists.
      try {
        const QRCode = await import('qrcode')
        const trackUrl = `${window.location.origin}/track?code=${encodeURIComponent(data.result.code)}`
        const dataUrl = await QRCode.toDataURL(trackUrl, { width: 160, margin: 1 })
        setQrDataUrl(dataUrl)
      } catch {
        // The stub prints fine without the QR; never block the lookup on it.
      }
    } catch {
      setError('Could not reach the tracking service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    await runSearch(code.trim())
  }

  // Deep link support: /track?code=REQ-... (e.g. scanned from a claim stub QR)
  // auto-runs the lookup instead of asking the citizen to type the code again.
  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code')
    if (urlCode) {
      setCode(urlCode)
      void runSearch(urlCode.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tone = result
    ? (STATUS_TONES[result.statusLabel] ?? 'bg-slate-500/10 text-slate-700 border-slate-500/20')
    : ''

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-background py-10 px-4">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">Track My Submission</h1>
          <p className="text-sm text-muted-foreground">
            Enter the tracking code from your claim stub to check the status of a service request,
            complaint, or feedback — no account needed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tracking Code</CardTitle>
            <CardDescription>
              Examples: REQ-1A2B3C4D (request), RPT-1A2B3C4D (complaint), FB-20260101-AB3K (feedback)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Tracking code</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="REQ-1A2B3C4D"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={40}
                />
              </div>
              {error ? (
                <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Looking up…
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Check Status
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{result.kindLabel}</CardTitle>
                  <CardDescription className="font-mono text-sm">{result.code}</CardDescription>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
                  {result.statusLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result.title ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Title</p>
                  <p className="font-medium text-foreground">{result.title}</p>
                </div>
              ) : null}
              {result.category ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{result.category}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="font-medium text-foreground">{formatDate(result.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
                <p className="font-medium text-foreground">{formatDate(result.updatedAt)}</p>
              </div>
              {result.pickup ? (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-sky-800 dark:text-sky-300">
                    Document Pickup — {result.pickup.statusLabel}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {result.pickup.documentTitle ?? 'Document'} · Claim code{' '}
                    <span className="font-mono font-semibold">{result.pickup.pickupCode}</span>
                  </p>
                  {result.pickup.scheduledDate ? (
                    <p className="text-xs text-muted-foreground">
                      Expected ready: {formatDate(result.pickup.scheduledDate)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {qrDataUrl ? (
                <div className="screen-only flex flex-col items-center gap-1 pt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR is a locally generated data URL, no optimization needed */}
                  <img src={qrDataUrl} alt={`QR code linking to the status of ${result.code}`} className="h-28 w-28" />
                  <p className="text-xs text-muted-foreground">Scan to check this status anytime</p>
                </div>
              ) : null}
              <div className="screen-only pt-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Claim Stub
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {result ? (
          <div className="print-stub" aria-hidden="true">
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>LINGKODBAYAN — BARANGAY SERVICES PORTAL</p>
              <p style={{ fontSize: 12, margin: '2px 0 0' }}>
                {contact?.name || 'Barangay Hall'}
                {contact?.address ? ` · ${contact.address}` : ''}
              </p>
            </div>
            <h2 style={{ fontSize: 13, margin: '12px 0 4px' }}>CLAIM / TRACKING STUB</h2>
            <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, margin: 0 }}>{result.code}</p>
            {qrDataUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR is a locally generated data URL, no optimization needed */}
                <img src={qrDataUrl} alt={`QR code linking to the status of ${result.code}`} style={{ width: 80, height: 80 }} />
              </div>
            ) : null}
            <table style={{ fontSize: 12, marginTop: 8, width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 0', width: 110 }}>Type</td>
                  <td>{result.kindLabel}</td>
                </tr>
                {result.title ? (
                  <tr>
                    <td style={{ padding: '2px 0' }}>Title</td>
                    <td>{result.title}</td>
                  </tr>
                ) : null}
                {result.category ? (
                  <tr>
                    <td style={{ padding: '2px 0' }}>Category</td>
                    <td>{result.category}</td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{ padding: '2px 0' }}>Status</td>
                  <td>{result.statusLabel}</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px 0' }}>Submitted</td>
                  <td>{formatDate(result.createdAt)}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 10, marginTop: 10, borderTop: '1px solid #000', paddingTop: 6 }}>
              Present this stub at the barangay hall, or check the status anytime at this portal under
              &ldquo;Track a Submission&rdquo; using the code above. Keep this stub until your request is
              completed.
              {contact?.phone ? ` Questions? Call ${contact.phone}.` : ''}
              {contact?.office_hours ? ` Office hours: ${contact.office_hours}.` : ''}
            </p>
          </div>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Only the status is shown — your personal details stay private.
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Lost your tracking code? Visit the barangay hall or{' '}
          <Link href="/" className="underline hover:text-foreground">
            go back to the homepage
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
