'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Loader2, MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { formatDate } from '@/lib/format-date'
import {
  feedbackCategories,
  feedbackStatusLabels,
  feedbackStatusSla,
  generateFeedbackTrackingNumber,
  getFeedbackCategoryLabel,
  type FeedbackEntry,
} from '@/lib/feedback'
import { feedbackStatusMachine, normalizeFeedbackLifecycleStatus } from '@/lib/status-machine'

const pipeline = feedbackStatusMachine.states

function FeedbackPipeline({ status }: { status: string }) {
  const canonical = normalizeFeedbackLifecycleStatus(status)
  const currentIndex = pipeline.indexOf(canonical)

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`Feedback progress: ${feedbackStatusLabels[canonical]}`}>
      {pipeline.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <span key={step} className="flex items-center gap-1">
            {index > 0 && <span className={`h-px w-3 ${isDone || isCurrent ? 'bg-[#28A745]' : 'bg-border'}`} aria-hidden="true" />}
            <span
              className={`flex items-center gap-1 text-[11px] ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none ${
                  isDone
                    ? 'border-[#28A745] bg-[#28A745] text-white'
                    : isCurrent
                      ? 'border-[#28A745] text-[#228039]'
                      : 'border-border'
                }`}
              >
                {isDone ? <Check className="h-2.5 w-2.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{feedbackStatusLabels[step]}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

export default function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState('suggestion')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    loadFeedback()
  }, [])

  async function loadFeedback() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const resident = await getOrCreateResidentProfile(supabase, user)
      if (!resident) return

      const { data } = await supabase
        .from('feedback')
        .select('*')
        .eq('resident_id', resident.id)
        .order('created_at', { ascending: false })

      setEntries(data || [])
    } catch (error) {
      console.error('Error loading feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    if (subject.trim().length < 5) {
      toast.error('Please provide a subject (at least 5 characters).')
      return
    }
    if (message.trim().length < 10) {
      toast.error('Please provide more details (at least 10 characters).')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be signed in to submit feedback.')

      const resident = await getOrCreateResidentProfile(supabase, user)
      if (!resident) throw new Error('Resident profile not found.')

      const { error } = await supabase.from('feedback').insert({
        tracking_number: generateFeedbackTrackingNumber(),
        resident_id: resident.id,
        is_anonymous: isAnonymous,
        category,
        subject: subject.trim(),
        message: message.trim(),
        contact_name: isAnonymous ? null : contactName.trim() || null,
        contact_info: contactInfo.trim() || null,
        status: 'submitted',
      })

      if (error) throw error

      toast.success('Feedback submitted. The barangay will acknowledge it within 2 working days.')
      setSubject('')
      setMessage('')
      setContactName('')
      setContactInfo('')
      setIsAnonymous(false)
      setCategory('suggestion')
      await loadFeedback()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted">
      <main className="w-full">
        <div className="min-h-screen p-6 md:p-8 space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-2">
              Feedback
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground">
              Share feedback with the barangay. Per the Citizen&apos;s Charter, feedback is acknowledged
              within 2 working days, evaluated within 3–5 working days, and answered within 7–10 working days.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* Submission form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-[#28A745]" aria-hidden="true" />
                  Submit Feedback
                </CardTitle>
                <CardDescription>
                  Suggestions, commendations, concerns, and inquiries are all welcome.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="feedback-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {feedbackCategories.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feedback-subject">Subject</Label>
                    <Input
                      id="feedback-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary of your feedback"
                      maxLength={120}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feedback-message">Details</Label>
                    <Textarea
                      id="feedback-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your feedback…"
                      rows={5}
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-border p-3">
                    <div>
                      <Label htmlFor="feedback-anonymous" className="font-medium">Submit anonymously</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your name will be hidden from barangay staff.
                      </p>
                    </div>
                    <Switch
                      id="feedback-anonymous"
                      checked={isAnonymous}
                      onCheckedChange={setIsAnonymous}
                    />
                  </div>

                  {!isAnonymous && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="feedback-contact-name">Contact Name (optional)</Label>
                        <Input
                          id="feedback-contact-name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Your name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="feedback-contact-info">Contact Info (optional)</Label>
                        <Input
                          id="feedback-contact-info"
                          value={contactInfo}
                          onChange={(e) => setContactInfo(e.target.value)}
                          placeholder="Mobile number or email"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Feedback'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* My feedback list */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">My Feedback</h2>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading feedback…
                </div>
              ) : entries.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    You haven&apos;t submitted any feedback yet.
                  </CardContent>
                </Card>
              ) : (
                entries.map((entry) => {
                  const canonical = normalizeFeedbackLifecycleStatus(entry.status)
                  return (
                    <Card key={entry.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{entry.subject}</CardTitle>
                            <CardDescription className="mt-1">
                              {entry.tracking_number ?? 'No tracking number'} &middot; {formatDate(entry.created_at)}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <Badge variant="secondary">{getFeedbackCategoryLabel(entry.category)}</Badge>
                            {entry.is_anonymous && <Badge variant="outline">Anonymous</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-gray-700 dark:text-muted-foreground whitespace-pre-wrap">
                          {entry.message}
                        </p>
                        <FeedbackPipeline status={entry.status} />
                        <p className="text-xs text-muted-foreground italic">
                          {feedbackStatusSla[canonical]}
                        </p>
                        {entry.admin_response && (
                          <div className="rounded-lg bg-[#28A745]/5 border border-[#28A745]/20 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#228039] mb-1">
                              Barangay Response
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{entry.admin_response}</p>
                            {entry.responded_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Responded on {formatDate(entry.responded_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


