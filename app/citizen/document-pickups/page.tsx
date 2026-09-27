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
  requests?: { title: string | null; category: string | null } | null
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

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium' })
  } catch {
    return value
  }
}

export default function DocumentPickupsPage() {
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const resident = await getOrCreateResidentProfile(supabase, user)
        if (!resident || cancelled) return

        const { data, error: queryError } = await supabase
          .from('document_pickups')
          .select('id, status, pickup_code, document_title, scheduled_date, ready_at, claimed_at, notes, requests(title, category)')
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
            setError('Could not load your document pickups. Please refresh the page.')
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Document Pickups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documents being processed for you. When a document is ready, present the claim code at the
          barangay hall — or share it with the person picking it up for you.
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
              No document pickups yet. When barangay staff process one of your document requests, it
              will appear here. You can file one from{' '}
              <Link href="/citizen/request-service" className="underline hover:text-foreground">Request Service</Link>.
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
                  {STATUS_LABELS[pickup.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected ready</p>
                <p className="font-medium text-foreground">{formatDate(pickup.scheduled_date)}</p>
              </div>
              {pickup.status === 'ready' ? (
                <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-800 dark:text-sky-300">
                  Present claim code <span className="font-mono font-semibold">{pickup.pickup_code}</span> at the
                  barangay hall to release your document.
                </p>
              ) : null}
              {pickup.status === 'claimed' ? (
                <p className="text-muted-foreground">Claimed on {formatDate(pickup.claimed_at)}.</p>
              ) : null}
              {pickup.notes ? <p className="text-xs text-muted-foreground">{pickup.notes}</p> : null}
              {pickup.status === 'ready' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print claim slip
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
