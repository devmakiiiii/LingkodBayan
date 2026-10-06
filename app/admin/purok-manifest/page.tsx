'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Purok pickup manifest (print-only deliverable).
 *
 * Barangay staff print this list and hand it to a purok leader, who carries
 * it up to residents with no phone or internet. Printing builds a standalone
 * document in a popup (same approach as the admin reports), so the paper
 * output is a clean sheet rather than a capture of the admin screen.
 */

type PickupRow = {
  id: string
  status: 'preparing' | 'ready' | 'claimed'
  pickup_code: string
  document_title: string | null
  scheduled_date: string | null
  requests?: { title: string | null; category: string | null } | null
  residents?: {
    first_name: string | null
    last_name: string | null
    email: string | null
    address: string | null
    phone: string | null
  } | null
}

type StatusFilter = 'ready' | 'preparing' | 'claimed' | 'all'

function residentName(pickup: PickupRow) {
  const person = pickup.residents
  if (!person) return 'Unknown'
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.email || 'Unnamed resident'
}

function documentName(pickup: PickupRow) {
  return pickup.document_title ?? pickup.requests?.title ?? 'Document'
}

const STATUS_LABEL: Record<Exclude<StatusFilter, 'all'>, string> = {
  ready: 'Ready for pickup',
  preparing: 'Being prepared',
  claimed: 'Claimed',
}

/** Best-effort purok label pulled out of a stored address ("Purok 3", ...). */
function purokLabel(address: string | null | undefined) {
  const match = (address ?? '').match(/purok\s*[^,;]+/i)
  return match ? match[0].replace(/\s+/g, ' ').trim() : 'Unassigned purok'
}

function scheduledLabel(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function PurokManifestPage() {
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ready')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/document-pickups')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        if (!cancelled) setPickups(data.pickups ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load pickups. Please refresh the page.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return pickups.filter((pickup) => {
      if (statusFilter !== 'all' && pickup.status !== statusFilter) return false
      if (!needle) return true
      const person = pickup.residents
      const haystack = [
        residentName(pickup),
        person?.address ?? '',
        documentName(pickup),
        pickup.pickup_code,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [pickups, statusFilter, search])

  // Rows grouped by purok so a leader covering one purok can find their
  // section at a glance; groups sort alphabetically with unassigned last.
  const grouped = useMemo(() => {
    const map = new Map<string, PickupRow[]>()
    for (const pickup of filtered) {
      const purok = purokLabel(pickup.residents?.address)
      const bucket = map.get(purok)
      if (bucket) bucket.push(pickup)
      else map.set(purok, [pickup])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  /**
   * Builds a standalone printable document in a popup (same approach as
   * `openPrintableReport` in lib/admin-reporting.ts), so the paper output is
   * a clean manifest sheet — not a capture of the admin screen.
   */
  function handlePrint() {
    const opened = window.open('', '_blank', 'width=1200,height=900')
    if (!opened) {
      setError('The browser blocked the print window. Allow pop-ups for this site and try again.')
      return
    }

    const generated = new Date()
    const generatedLabel = `${generated.toLocaleDateString('en-PH', { dateStyle: 'long' })} at ${generated.toLocaleTimeString('en-PH', { timeStyle: 'short' })}`
    const statusLabel = statusFilter === 'all' ? 'All statuses' : STATUS_LABEL[statusFilter]

    // Continuous numbering across purok groups on the printed sheet.
    let rowNumber = 0
    const bodyRows = grouped
      .map(([purok, rows]) =>
        [
          `<tr class="purok-row"><td colspan="8">${escapeHtml(purok)} — ${rows.length} document(s)</td></tr>`,
          ...rows.map(
            (pickup) => `
        <tr>
          <td class="num">${++rowNumber}</td>
          <td class="code">${escapeHtml(pickup.pickup_code)}</td>
          <td>${escapeHtml(residentName(pickup))}${pickup.residents?.phone ? `<span class="phone">${escapeHtml(pickup.residents.phone)}</span>` : ''}</td>
          <td>${escapeHtml(pickup.residents?.address || '—')}</td>
          <td>${escapeHtml(documentName(pickup))}</td>
          <td>${escapeHtml(scheduledLabel(pickup.scheduled_date))}</td>
          <td></td>
          <td></td>
        </tr>`,
          ),
        ].join(''),
      )
      .join('')

    opened.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Purok Pickup Manifest</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 16px; }
      .letterhead { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; }
      .letterhead p { margin: 0; font-size: 11px; }
      .letterhead .barangay { font-size: 15px; font-weight: 700; letter-spacing: 0.06em; margin-top: 4px; }
      .title { text-align: center; margin: 10px 0 12px; }
      .title h1 { font-size: 14px; margin: 0; }
      .title p { font-size: 11px; color: #333; margin: 2px 0 0; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #000; padding: 6px 4px; text-align: left; vertical-align: top; }
      th { background: #eee; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .num { width: 24px; text-align: center; }
      .code { font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 0.04em; }
      .phone { display: block; font-size: 9px; color: #444; }
      .purok-row td { background: #eee; font-weight: 700; letter-spacing: 0.02em; }
      tbody td { height: 28px; }
      .instructions { font-size: 10px; margin: 14px 0 0; }
      .signoff { display: flex; gap: 48px; margin-top: 32px; font-size: 11px; }
      .signoff > div { flex: 1; }
      .signoff .line { border-top: 1px solid #000; width: 220px; }
      .signoff p { margin: 4px 0 0; }
    </style>
  </head>
  <body>
    <div class="letterhead">
      <p>Republic of the Philippines</p>
      <p>City of Olongapo · Province of Zambales</p>
      <p class="barangay">BARANGAY BARRETTO</p>
      <p>Office of the Punong Barangay — Document Release</p>
    </div>
    <div class="title">
      <h1>PUROK PICKUP MANIFEST</h1>
      <p>Generated ${escapeHtml(generatedLabel)} · ${escapeHtml(statusLabel)} · ${filtered.length} document(s) in ${grouped.length} purok group(s)</p>
    </div>
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Claim code</th>
          <th>Resident</th>
          <th>Address</th>
          <th>Document</th>
          <th>Schedule</th>
          <th style="width: 110px">Received by (signature)</th>
          <th style="width: 66px">Date &amp; time</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || '<tr><td colspan="8">No documents found</td></tr>'}
      </tbody>
    </table>
    <p class="instructions">
      Instructions for the purok leader: verify the resident's identity against the claim code before
      releasing a document, let the recipient sign in the "Received by" column and note the date and
      time, then return this sheet to the barangay hall. Items not released should be reported so the
      office can follow up.
    </p>
    <div class="signoff">
      <div>
        <div class="line"></div>
        <p>Purok leader — signature over printed name</p>
      </div>
      <div>
        <div class="line"></div>
        <p>Checked by (barangay staff) — signature &amp; date</p>
      </div>
    </div>
  </body>
</html>`)
    opened.document.close()

    // Print once the document has loaded; fall back to a short timeout in
    // case the load event already fired or never does.
    let hasPrinted = false
    const printWhenReady = () => {
      if (hasPrinted || opened.closed) return
      hasPrinted = true
      opened.focus()
      opened.print()
    }
    opened.addEventListener('load', printWhenReady, { once: true })
    setTimeout(() => {
      opened.removeEventListener('load', printWhenReady)
      printWhenReady()
    }, 800)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="screen-only">
        <h1 className="text-2xl font-bold text-foreground">Purok Pickup Manifest</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Print this list for a purok leader to carry to residents with no phone or internet. The
          leader verifies each claim code on release and collects the recipient&apos;s signature.
        </p>
      </div>

      {loading ? (
        <p className="screen-only flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pickups…
        </p>
      ) : null}

      {error ? (
        <p className="screen-only rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="screen-only">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            {filtered.length} document(s) across {grouped.length} purok group(s) will appear on the
            manifest, grouped by purok.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger id="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready for pickup</SelectItem>
                <SelectItem value="preparing">Being prepared</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manifest-search">Search (name, address, document, code)</Label>
            <Input
              id="manifest-search"
              placeholder="e.g., Ilo-Ilo Street, Barangay Clearance, Juan"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* On-screen preview of exactly what the printed manifest will show. */}
      <Card className="screen-only">
        <CardHeader>
          <CardTitle>Manifest preview</CardTitle>
          <CardDescription>
            This is what the printed sheet will contain, grouped by purok.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pickups match the current filter.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([purok, rows]) => (
                <div key={purok} className="space-y-2">
                  <p className="text-sm font-semibold">
                    {purok} · {rows.length} document(s)
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">Claim code</th>
                        <th className="py-2 pr-2 font-medium">Resident</th>
                        <th className="py-2 pr-2 font-medium">Address</th>
                        <th className="py-2 pr-2 font-medium">Document</th>
                        <th className="py-2 pr-2 font-medium">Schedule</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((pickup) => (
                        <tr key={pickup.id} className="border-b last:border-0">
                          <td className="py-2 pr-2 font-mono font-semibold">{pickup.pickup_code}</td>
                          <td className="py-2 pr-2">
                            {residentName(pickup)}
                            {pickup.residents?.phone ? (
                              <span className="block text-xs text-muted-foreground">{pickup.residents.phone}</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2">{pickup.residents?.address || '—'}</td>
                          <td className="py-2 pr-2">{documentName(pickup)}</td>
                          <td className="py-2 pr-2">{scheduledLabel(pickup.scheduled_date)}</td>
                          <td className="py-2 capitalize">{pickup.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="screen-only">
        <Button type="button" onClick={handlePrint} disabled={filtered.length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Print Manifest ({filtered.length})
        </Button>
      </div>
    </div>
  )
}
