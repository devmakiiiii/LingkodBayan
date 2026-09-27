'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, UserCheck, X } from 'lucide-react'

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
import { createClient } from '@/lib/supabase/client'
import { getOrCreateResidentProfile } from '@/lib/residents'
import {
  authorizationPartyName,
  grantAuthorization,
  listAuthorizationsGrantedToMe,
  listAuthorizationsIGranted,
  revokeAuthorization,
  type RepresentativeAuthorization,
} from '@/lib/representatives'

/**
 * Proxy filing management: a resident grants (or revokes) permission for
 * another registered resident to file service requests on their behalf.
 * The grant is recorded in representative_authorizations and enforced by
 * RLS — the representative can only file while the authorization is active.
 */

type Party = { first_name: string | null; last_name: string | null; email: string | null } | null

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium' })
  } catch {
    return value
  }
}

export default function ProxyFilingPage() {
  const [loading, setLoading] = useState(true)
  const [residentId, setResidentId] = useState<string | null>(null)
  const [granted, setGranted] = useState<Array<RepresentativeAuthorization & { representative?: Party }>>([])
  const [received, setReceived] = useState<Array<RepresentativeAuthorization & { represented?: Party }>>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadLists = useCallback(async (currentResidentId: string) => {
    const supabase = createClient()
    const [grantedResult, receivedResult] = await Promise.all([
      listAuthorizationsIGranted(supabase, currentResidentId),
      listAuthorizationsGrantedToMe(supabase, currentResidentId),
    ])
    setGranted(grantedResult)
    setReceived(receivedResult)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const resident = await getOrCreateResidentProfile(supabase, user)
        if (!resident || cancelled) return
        setResidentId(resident.id)
        await loadLists(resident.id)
      } catch (loadError) {
        console.error('Failed to load proxy authorizations:', loadError)
        setActionError('Could not load your authorizations. Please refresh the page.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadLists])

  async function handleGrant(event: React.FormEvent) {
    event.preventDefault()
    if (!residentId) return
    setActionError(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const result = await grantAuthorization(supabase, residentId, email, note)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      setSuccessMessage('They can now file service requests on your behalf while this authorization is active.')
      setEmail('')
      setNote('')
      await loadLists(residentId)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(authorizationId: string) {
    if (!residentId) return
    setActionError(null)
    setSuccessMessage(null)
    const supabase = createClient()
    const result = await revokeAuthorization(supabase, authorizationId)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setSuccessMessage('The authorization has been revoked.')
    await loadLists(residentId)
  }


  const activeCount = granted.filter((authorization) => authorization.status === 'active').length

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proxy Filing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Authorize a family member, neighbor, or purok leader to file service requests on your
          behalf — useful if you have no smartphone, no email, or live far from the barangay hall.
        </p>
      </div>

      {successMessage ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Authorize someone to file for you</CardTitle>
          <CardDescription>
            Enter the registered email of the person you trust. They must already have a
            LingkodBayan account. You can revoke this permission at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGrant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="representative-email">Their registered email</Label>
              <Input
                id="representative-email"
                type="email"
                placeholder="juan@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consent-note">Consent note (optional)</Label>
              <Input
                id="consent-note"
                placeholder="e.g., My parent who lives in the mountains"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
              />
            </div>
            <Button type="submit" disabled={submitting || !residentId}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Grant Authorization
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People authorized to file for you</CardTitle>
          <CardDescription>
            {activeCount > 0
              ? `${activeCount} active authorization${activeCount === 1 ? '' : 's'}.`
              : 'No one is currently authorized.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : granted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not authorized anyone yet. Use the form above to grant access.
            </p>
          ) : (
            granted.map((authorization) => (
              <div key={authorization.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {authorizationPartyName(authorization)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Granted {formatDate(authorization.granted_at)}
                    {authorization.consent_note ? ` · ${authorization.consent_note}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={authorization.status === 'active' ? 'default' : 'secondary'}>
                    {authorization.status === 'active' ? 'Active' : 'Revoked'}
                  </Badge>
                  {authorization.status === 'active' ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => handleRevoke(authorization.id)}>
                      <X className="mr-1 h-3 w-3" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Residents you can file for</CardTitle>
          <CardDescription>
            You can submit service requests on behalf of these residents from the{' '}
            <Link href="/citizen/request-service" className="underline hover:text-foreground">Request Service</Link>{' '}
            page while their authorization is active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : received.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one has authorized you yet. Ask your family or purok leader to grant you access from their account.
            </p>
          ) : (
            received.map((authorization) => (
              <div key={authorization.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {authorizationPartyName(authorization)}
                  </p>
                  <p className="text-xs text-muted-foreground">Granted {formatDate(authorization.granted_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={authorization.status === 'active' ? 'default' : 'secondary'}>
                    {authorization.status === 'active' ? 'Active' : 'Revoked'}
                  </Badge>
                  {authorization.status === 'active' ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => handleRevoke(authorization.id)}>
                      <X className="mr-1 h-3 w-3" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
