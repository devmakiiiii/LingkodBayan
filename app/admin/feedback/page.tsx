'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquareText } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format-date'
import {
  feedbackStatusLabels,
  feedbackStatusSla,
  getFeedbackCategoryLabel,
  type FeedbackEntry,
} from '@/lib/feedback'
import {
  canTransitionFeedback,
  feedbackStatusMachine,
  getAllowedFeedbackTransitions,
  normalizeFeedbackLifecycleStatus,
} from '@/lib/status-machine'

type FeedbackRow = FeedbackEntry & {
  resident: { first_name: string | null; last_name: string | null } | null
}

const pipeline = feedbackStatusMachine.states
type CanonicalStatus = (typeof pipeline)[number]

function displayName(entry: FeedbackRow): string {
  if (entry.is_anonymous) return 'Anonymous Resident'
  if (entry.contact_name?.trim()) return entry.contact_name.trim()
  const residentName = [entry.resident?.first_name, entry.resident?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return residentName || 'Resident'
}

export default function AdminFeedbackPage() {
  const [entries, setEntries] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CanonicalStatus | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selected = entries.find((entry) => entry.id === selectedId) ?? null
  const isOpen = selected !== null

  useEffect(() => {
    loadFeedback()
  }, [])

  async function loadFeedback() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('feedback')
        .select('*, resident:residents(first_name, last_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setEntries((data as FeedbackRow[]) || [])
    } catch (error) {
      console.error('Error loading feedback:', error)
      toast.error('Failed to load feedback.')
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: entries.length }
    for (const state of pipeline) {
      map[state] = entries.filter(
        (entry) => normalizeFeedbackLifecycleStatus(entry.status) === state
      ).length
    }
    return map
  }, [entries])

  const visibleEntries =
    statusFilter === 'all'
      ? entries
      : entries.filter(
          (entry) => normalizeFeedbackLifecycleStatus(entry.status) === statusFilter
        )

  function openManage(entry: FeedbackRow) {
    setSelectedId(entry.id)
    setResponse(entry.admin_response ?? '')
  }

  async function handleTransition(to: CanonicalStatus) {
    if (!selected) return
    const from = normalizeFeedbackLifecycleStatus(selected.status)
    if (!canTransitionFeedback(from, to)) {
      toast.error('That status change is not allowed.')
      return
    }
    const trimmedResponse = response.trim()
    if (to === 'responded' && !trimmedResponse) {
      toast.error('Write the barangay response before marking as Response Sent.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      const payload: Record<string, unknown> = { status: to, updated_at: now }
      if (trimmedResponse) payload.admin_response = trimmedResponse
      if (to === 'responded' && !selected.responded_at) payload.responded_at = now

      const { error } = await supabase
        .from('feedback')
        .update(payload)
        .eq('id', selected.id)
      if (error) throw error

      toast.success(`Feedback marked as “${feedbackStatusLabels[to]}”.`)
      setSelectedId(null)
      setResponse('')
      await loadFeedback()
    } catch (error) {
      console.error('Error updating feedback:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted">
      <main className="w-full">
        <div className="min-h-screen p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-2">
              Feedback Management
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground">
              Citizen&apos;s Charter Section 18 — acknowledge within 2 working days, evaluate within
              3–5 working days, respond within 7–10 working days, then document in the Feedback Registry.
            </p>
          </div>

          {/* Status counts */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl border p-4 text-left transition ${
                statusFilter === 'all'
                  ? 'border-[#28A745] bg-[#28A745]/5'
                  : 'border-border bg-card hover:border-[#28A745]/40'
              }`}
            >
              <p className="text-2xl font-bold text-gray-900 dark:text-foreground">{counts.all}</p>
              <p className="text-xs font-medium text-gray-600 dark:text-muted-foreground">All</p>
            </button>
            {pipeline.map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => setStatusFilter(state)}
                className={`rounded-xl border p-4 text-left transition ${
                  statusFilter === state
                    ? 'border-[#28A745] bg-[#28A745]/5'
                    : 'border-border bg-card hover:border-[#28A745]/40'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground">
                  {counts[state] ?? 0}
                </p>
                <p className="text-xs font-medium text-gray-600 dark:text-muted-foreground">
                  {feedbackStatusLabels[state]}
                </p>
              </button>
            ))}
          </div>

          {/* Feedback list */}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading feedback…
            </div>
          ) : visibleEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No feedback with this status.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleEntries.map((entry) => {
                const canonical = normalizeFeedbackLifecycleStatus(entry.status)
                return (
                  <Card key={entry.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base leading-snug">{entry.subject}</CardTitle>
                        <Badge
                          className="shrink-0 bg-[#28A745]/10 text-[#228039] border-[#28A745]/30 hover:bg-[#28A745]/10"
                          variant="outline"
                        >
                          {feedbackStatusLabels[canonical]}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{displayName(entry)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{getFeedbackCategoryLabel(entry.category)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{formatDate(entry.created_at)}</span>
                        {entry.is_anonymous && (
                          <Badge variant="outline" className="text-[10px]">Anonymous</Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-700 dark:text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {entry.message}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {entry.tracking_number ?? 'No tracking number'}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => openManage(entry)}
                          className="bg-[#28A745] hover:bg-[#228039] text-white"
                        >
                          <MessageSquareText className="h-4 w-4 mr-1" /> Manage
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Manage dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setSelectedId(null); setResponse('') } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.subject}</DialogTitle>
                <DialogDescription>
                  {selected.tracking_number ?? 'No tracking number'} &middot;{' '}
                  {getFeedbackCategoryLabel(selected.category)} &middot; {formatDate(selected.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">From</p>
                    <p>{displayName(selected)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Contact</p>
                    <p>{selected.contact_info ?? 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Current Status</p>
                    <p>{feedbackStatusLabels[normalizeFeedbackLifecycleStatus(selected.status)]}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Charter SLA</p>
                    <p className="text-muted-foreground">
                      {feedbackStatusSla[normalizeFeedbackLifecycleStatus(selected.status)]}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-1">Message</p>
                  <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{selected.message}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-response">Barangay Response</Label>
                  <Textarea
                    id="admin-response"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write the official response to the resident…"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required before marking the feedback as &quot;Response Sent&quot;.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {getAllowedFeedbackTransitions(selected.status).map((transition) => (
                    <Button
                      key={transition.to}
                      onClick={() => handleTransition(transition.to)}
                      disabled={submitting}
                      title={transition.description}
                      className="bg-[#28A745] hover:bg-[#228039] text-white"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : transition.label}
                    </Button>
                  ))}
                  {getAllowedFeedbackTransitions(selected.status).length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      This feedback is documented and closed.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

