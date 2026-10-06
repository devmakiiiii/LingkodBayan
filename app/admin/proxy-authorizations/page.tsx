'use client'

import { useCallback, useEffect, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Admin view of proxy filing authorizations. Barangay staff can grant an
 * authorization on behalf of a resident who cannot operate the portal
 * themselves (no email/device) — e.g. a mountain resident standing at the
 * counter authorizing a relative with an account.
 */

type AuthorizationRow = {
  id: string
  status: 'active' | 'revoked'
  consent_note: string | null
  granted_at: string
  revoked_at: string | null
  represented?: { first_name: string | null; last_name: string | null; email: string | null } | null
  representative?: { first_name: string | null; last_name: string | null; email: string | null } | null
}

function personName(person?: { first_name: string | null; last_name: string | null; email: string | null } | null) {
  if (!person) return 'Unknown'
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
  return name || person.email || 'Unnamed resident'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium' })
  } catch {
    return value
  }
}

export default function ProxyAuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<AuthorizationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [representedEmail, setRepresentedEmail] = useState('')
  const [representativeEmail, setRepresentativeEmail] = useState('')
  const [consentNote, setConsentNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch('/api/citizen/proxy-authorizations')
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      setError(data?.error || 'Failed to load authorizations.')
      return
    }
    setAuthorizations(data.authorizations ?? [])
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function handleGrant(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/citizen/proxy-authorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          representedEmail: representedEmail.trim(),
          representativeEmail: representativeEmail.trim(),
          consentNote: consentNote.trim() || undefined,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'Failed to grant the authorization.')
        return
      }
      setSuccessMessage('Authorization granted. Both residents have been notified in the portal.')
      setRepresentedEmail('')
      setRepresentativeEmail('')
      setConsentNote('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(authorizationId: string) {
    setError(null)
    setSuccessMessage(null)
    const response = await fetch('/api/citizen/proxy-authorizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationId }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error || 'Failed to revoke the authorization.')
      return
    }
    setSuccessMessage('The authorization has been revoked.')
    await load()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proxy Authorizations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grant filing permission on behalf of residents who cannot use the portal themselves. The
          representative files requests from their own account, choosing &ldquo;File on behalf
          of&rdquo; in the request form.
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
          <CardTitle>Grant an authorization</CardTitle>
          <CardDescription>
            Both residents must already have LingkodBayan accounts with registered emails. The
            represented resident should be present at the counter and give verbal consent; record it
            in the note.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGrant} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="represented-email">Represented resident&apos;s email</Label>
              <Input
                id="represented-email"
                type="email"
                placeholder="maria@example.com"
                value={representedEmail}
                onChange={(event) => setRepresentedEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representative-email">Representative&apos;s email</Label>
              <Input
                id="representative-email"
                type="email"
                placeholder="juan@example.com"
                value={representativeEmail}
                onChange={(event) => setRepresentativeEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="consent-note">Consent note (optional)</Label>
              <Input
                id="consent-note"
                placeholder="e.g., Verbal consent given at the barangay hall, 2026-09-27"
                value={consentNote}
                onChange={(event) => setConsentNote(event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                Grant Authorization
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All authorizations</CardTitle>
          <CardDescription>Newest first. Revoke to immediately stop proxy filing.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : authorizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No authorizations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Represented resident</TableHead>
                    <TableHead>Representative</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authorizations.map((authorization) => (
                    <TableRow key={authorization.id}>
                      <TableCell className="font-medium">{personName(authorization.represented)}</TableCell>
                      <TableCell>{personName(authorization.representative)}</TableCell>
                      <TableCell>
                        <Badge variant={authorization.status === 'active' ? 'default' : 'secondary'}>
                          {authorization.status === 'active' ? 'Active' : 'Revoked'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(authorization.granted_at)}
                        {authorization.revoked_at ? ` → ${formatDate(authorization.revoked_at)}` : ''}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">
                        {authorization.consent_note ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {authorization.status === 'active' ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleRevoke(authorization.id)}>
                            <X className="mr-1 h-3 w-3" />
                            Revoke
                          </Button>
                        ) : null}
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
