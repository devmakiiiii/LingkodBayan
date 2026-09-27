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
 * it up to residents with no phone or internet. Each row shows the claim
 * code, the resident, and the document; the leader collects signatures on
 * release so the paper trail survives even where connectivity does not.
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

  const today = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="screen-only">
        <h1 className="text-2xl font-bold text-foreground">Purok Pickup Manifest</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Print this list for a purok leader to carry to residents with no phone or internet. The
          leader verifies each claim code on release and collects the recipient&apos;s signature.
        </p>
      </div>

      {error ? (
        <p className="screen-only rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="screen-only">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>{filtered.length} document(s) will appear on the manifest.</CardDescription>
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
              placeholder="e.g., Kalaklan, Barangay Clearance, Juan"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="screen-only">
        <Button type="button" onClick={() => window.print()} disabled={filtered.length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Print Manifest ({filtered.length})
        </Button>
      </div>

      {/* Print-only manifest sheet */}
      <div className="print-manifest" aria-hidden="true">
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>LINGKODBAYAN — DOCUMENT PICKUP MANIFEST</p>
          <p style={{ fontSize: 11, margin: '2px 0 0' }}>
            For purok distribution · Generated {today} · {filtered.length} document(s)
          </p>
        </div>
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th style={{ width: 90 }}>Claim code</th>
              <th>Resident</th>
              <th>Address</th>
              <th>Document</th>
              <th style={{ width: 150 }}>Received by (signature)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pickup, index) => (
              <tr key={pickup.id}>
                <td>{index + 1}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{pickup.pickup_code}</td>
                <td>{residentName(pickup)}</td>
                <td>{pickup.residents?.address || '—'}</td>
                <td>{documentName(pickup)}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 10, marginTop: 10 }}>
          Instructions for the purok leader: verify the resident&apos;s identity against the claim code,
          let the recipient sign on release, and return this sheet to the barangay hall. Items not
          released should be reported so the office can follow up.
        </p>
      </div>
    </div>
  )
}
