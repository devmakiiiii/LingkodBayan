'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Clock, User, FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface VerificationAttempt {
  id: string
  resident_id: string
  attempt_type: 'form_match' | 'id_ocr' | 'manual_review'
  input_data: Record<string, unknown> | null
  matched_pre_registered_id: string | null
  match_score: number | null
  confidence_breakdown: Record<string, number> | null
  ocr_extracted_data: Record<string, unknown> | null
  status: 'matched' | 'no_match' | 'needs_review' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  residents: {
    id: string
    first_name: string
    last_name: string
    email: string
    verification_status: string
  }
  pre_registered_residents: {
    id: string
    first_name: string
    last_name: string
    email: string
    national_id: string | null
  } | null
}

export default function AdminVerificationPage() {
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAttempt, setSelectedAttempt] = useState<VerificationAttempt | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchAttempts()
  }, [])

  async function fetchAttempts() {
    try {
      const res = await fetch('/api/admin/verification/attempts?status=needs_review')
      if (!res.ok) throw new Error('Failed to fetch attempts')
      const data = await res.json()
      setAttempts(data.attempts || [])
    } catch (err) {
      console.error('Error fetching attempts:', err)
      toast.error('Failed to load verification attempts')
    } finally {
      setLoading(false)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'matched':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'no_match':
        return <AlertCircle className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
      case 'needs_review':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  function getStatusBadge(status: string) {
    const variant = {
      matched: 'bg-green-100 text-green-800',
      no_match: 'bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground',
      needs_review: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
    }[status] || 'bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground'
    return <Badge className={variant}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading verification queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Identity Verification</h1>
            <p className="text-muted-foreground mt-1">
              Review residents requiring identity verification
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
          <CardDescription>
            {attempts.length} pending verification request(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending verification requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Match Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {attempt.residents?.first_name} {attempt.residents?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {attempt.residents?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{attempt.attempt_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {attempt.match_score !== null
                          ? `${Math.round(attempt.match_score)}%`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                      <TableCell>
                        {new Date(attempt.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedAttempt(attempt)}
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Verify Identity: {attempt.residents?.first_name} {attempt.residents?.last_name}</DialogTitle>
                              <DialogDescription>
                                Review the verification details and make a decision.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 max-h-96 overflow-y-auto">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Attempt Type</Label>
                                  <p>{attempt.attempt_type}</p>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Match Score</Label>
                                  <p>{attempt.match_score !== null ? `${Math.round(attempt.match_score)}%` : 'N/A'}</p>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Current Status</Label>
                                  <p>{attempt.residents?.verification_status}</p>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Matched Pre-Registered</Label>
                                  <p>
                                    {attempt.pre_registered_residents
                                      ? `${attempt.pre_registered_residents.first_name} ${attempt.pre_registered_residents.last_name} (${attempt.pre_registered_residents.email})`
                                      : 'None'}
                                  </p>
                                </div>
                              </div>

                              {attempt.confidence_breakdown && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Confidence Breakdown</Label>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    {Object.entries(attempt.confidence_breakdown).map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-sm">
                                        <span>{key}</span>
                                        <span>{Math.round(value * 100)}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {attempt.ocr_extracted_data && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">OCR Extracted Fields</Label>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    {Object.entries(attempt.ocr_extracted_data)
                                      .filter(([k]) => k !== 'ocrText')
                                      .map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                          <span>{key}</span>
                                          <span className="font-mono text-xs">{String(value)}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {attempt.input_data && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Submitted Data</Label>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    {Object.entries(attempt.input_data).map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-sm">
                                        <span>{key}</span>
                                        <span>{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Review Notes</Label>
                                <Textarea
                                  value={reviewNotes}
                                  onChange={(e) => setReviewNotes(e.target.value)}
                                  placeholder="Add notes about this verification decision..."
                                  className="mt-1"
                                  rows={3}
                                />
                              </div>
                            </div>

                            <DialogFooter>
                              <Button variant="outline" onClick={() => { setSelectedAttempt(null); setReviewNotes('') }}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={async () => {
                                  await handleReviewSubmit('rejected')
                                  setSelectedAttempt(null)
                                  setReviewNotes('')
                                }}
                              >
                                Reject
                              </Button>
                              <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={async () => {
                                  await handleReviewSubmit('matched')
                                  setSelectedAttempt(null)
                                  setReviewNotes('')
                                }}
                              >
                                Approve
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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

  async function handleReviewSubmit(status: 'matched' | 'rejected') {
    if (!selectedAttempt) return
    setIsUpdating(true)
    try {
      const verificationStatus =
        status === 'matched'
          ? selectedAttempt.match_score && selectedAttempt.match_score >= 75
            ? 'id_verified'
            : 'auto_verified'
          : 'rejected'

      const res = await fetch('/api/admin/verification/attempts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: selectedAttempt.id,
          status,
          residentId: selectedAttempt.resident_id,
          verificationStatus,
          verificationMethod: 'manual',
          verificationConfidence: selectedAttempt.match_score || 0,
          notes: reviewNotes,
        }),
      })

      if (!res.ok) throw new Error('Failed to update verification attempt')

      toast.success(`Verification ${status === 'matched' ? 'approved' : 'rejected'}`)
      fetchAttempts()
    } catch (err) {
      console.error('Error updating verification:', err)
      toast.error('Failed to update verification status')
    } finally {
      setIsUpdating(false)
    }
  }
}
