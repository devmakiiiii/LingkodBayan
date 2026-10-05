'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { Eye, FileSpreadsheet } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RequestActions } from '@/components/admin/request-actions'
import { canTransitionRequest } from '@/lib/status-machine'
import { getSlaBadgeClassName, getSlaStatus } from '@/lib/sla'
import { toast } from 'sonner'
import {
  getRequestStatusClassName,
  getRequestStatusLabel,
  getRequestSummaryValue,
  getRequestTypeTitle,
  type RequestPayload,
  type RequestStatus,
} from '@/lib/request-types'

interface Request {
  id: string
  resident_id: string
  request_type?: string | null
  title: string
  description: string
  category: string
  status: string
  priority: string
  created_at: string
  payload?: RequestPayload | null
  residents: {
    first_name: string
    last_name: string
    email: string
    barangay: string
  } | null
}

type RequestSectionFilter = 'all' | 'pending' | 'in_progress' | 'resolved'

const requestSectionLabels: Record<RequestSectionFilter, string> = {
  all: 'All Requests',
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

function normalizeSectionFilter(value: string | null): RequestSectionFilter {
  if (value === 'pending' || value === 'in_progress' || value === 'resolved') {
    return value
  }

  return 'all'
}

function normalizeRequestStatus(status?: string | null) {
  const normalized = (status ?? 'pending').toLowerCase()

  if (normalized === 'processing' || normalized === 'in-progress') {
    return 'in_progress'
  }

  if (normalized === 'approved' || normalized === 'rejected' || normalized === 'resolved') {
    return 'resolved'
  }

  return normalized
}

function getSectionStatuses(section: RequestSectionFilter) {
  switch (section) {
    case 'pending':
      return ['pending']
    case 'in_progress':
      return ['processing', 'in-progress']
    case 'resolved':
      return ['approved', 'rejected', 'resolved']
    default:
      return ['pending', 'processing', 'in-progress', 'approved', 'rejected', 'resolved']
  }
}

const PAGE_SIZE = 20

/**
 * Upper bound for the status-only fetch that backs the section counters. Those
 * counters describe the whole table, so they must not be derived from the
 * paginated `requests` slice (which holds only the loaded pages).
 */
const STATUS_ROW_LIMIT = 10000

const RequestRow = React.memo(function RequestRow({
  request,
  onView,
}: {
  request: Request
  onView: (request: Request) => void
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {request.residents
          ? `${request.residents.first_name} ${request.residents.last_name}`
          : 'Resident record unavailable'}
        <div className="text-xs text-muted-foreground">{request.residents?.email || 'No email available'}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-background">
          {getRequestTypeTitle(request.request_type, request.title)}
        </Badge>
        <div className="mt-2 text-xs text-muted-foreground">
          {getRequestSummaryValue(request.request_type, request.payload, request.description)}
        </div>
      </TableCell>
      <TableCell>{new Date(request.created_at).toLocaleDateString('en-PH')}</TableCell>
      <TableCell>
        <Badge className={getRequestStatusClassName(request.status)}>
          {getRequestStatusLabel(request.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => onView(request)}
        >
          <Eye className="mr-2 h-4 w-4" />
          View
        </Button>
      </TableCell>
      <TableCell>
        {(() => {
          const sla = getSlaStatus(request)

          return (
            <Badge variant="outline" className={getSlaBadgeClassName(sla.tone)}>
              <span className="sr-only">SLA: </span>
              {sla.label}
            </Badge>
          )
        })()}
      </TableCell>
    </TableRow>
  )
})

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [sectionCounts, setSectionCounts] = useState<Record<RequestSectionFilter, number>>({
    all: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  })
  const searchParams = useSearchParams()

  const activeSection = normalizeSectionFilter(searchParams.get('status'))

  const loadRequests = useCallback(async () => {
    try {
      setLoadError(null)
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setRequests([])
        setLoading(false)
        return
      }

      const supabase = createClient()
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from('requests')
        .select('*, residents(first_name, last_name, email, barangay)')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        setLoadError(error?.message || 'Failed to load requests')
        setRequests([])
        setLoading(false)
        return
      }

      const mappedRequests: Request[] = (data || []).map((row: any) => ({
        ...row,
        residents: row.residents || null,
      }))

      // Append on "Load More" so the pages already on screen stay put. Setting
      // state to just the newest page made the list look like it had jumped
      // elsewhere and left the section counters at one page's worth of rows.
      setRequests((current) => (page === 0 ? mappedRequests : [...current, ...mappedRequests]))
      setHasMore(mappedRequests.length === PAGE_SIZE)
    } catch (error: any) {
      setLoadError(error?.message || 'Failed to load requests')
      setRequests([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    setPage(0)
  }, [activeSection])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const visibleRequests = useMemo(() => {
    const allowedStatuses = getSectionStatuses(activeSection)

    return requests.filter((request) => allowedStatuses.includes(request.status?.toLowerCase() ?? 'pending'))
  }, [activeSection, requests])

  /**
   * Table-wide section counters, fetched separately from the paginated list so
   * "All Requests: 300" cannot be confused with "20 rows shown".
   */
  const loadSectionCounts = useCallback(async () => {
    if (!hasSupabaseConfig()) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('requests')
        .select('status')
        .limit(STATUS_ROW_LIMIT)

      if (error) return

      const rows: Array<{ status: string | null }> = data ?? []
      setSectionCounts({
        all: rows.length,
        pending: rows.filter((row) => normalizeRequestStatus(row.status) === 'pending').length,
        in_progress: rows.filter((row) => normalizeRequestStatus(row.status) === 'in_progress').length,
        resolved: rows.filter((row) => normalizeRequestStatus(row.status) === 'resolved').length,
      })
    } catch {
      // The counters are decorative; a failure must not blank the request list.
    }
  }, [])

  useEffect(() => {
    loadSectionCounts()
  }, [loadSectionCounts])

  async function updateRequestStatus(requestId: string, newStatus: RequestStatus) {
    try {
      const previousStatus = requests.find((request) => request.id === requestId)?.status ?? null

      // Enforce the request status finite state machine before sending
      if (!canTransitionRequest(previousStatus, newStatus)) {
        toast.error(
          previousStatus && previousStatus.toLowerCase() === newStatus.toLowerCase()
            ? `Request is already ${newStatus}.`
            : `That status change is not allowed from "${previousStatus ?? 'pending'}".`,
        )
        return
      }

      const res = await fetch('/api/admin/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: newStatus }),
      })

      const data = await res.json().catch(() => ({ error: 'Failed to parse response' }))

      if (!res.ok) {
        toast.error(data.error || 'Failed to update request status')
        return
      }

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === requestId ? { ...request, status: newStatus } : request,
        ),
      )

      setSelectedRequest((currentRequest) =>
        currentRequest && currentRequest.id === requestId
          ? { ...currentRequest, status: newStatus }
          : currentRequest,
      )

      toast.success(`Request status updated to ${newStatus}`)
      // A status change moves a row between sections, so refresh the counters.
      loadSectionCounts()
    } catch (error) {
      console.error('Error updating request:', error)
      toast.error('An unexpected error occurred while updating request')
    }
  }

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto w-full">
      <RequestActions
        request={selectedRequest}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedRequest(null)
        }}
        onStatusChange={updateRequestStatus}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Requests</h1>
          <p className="mt-2 text-muted-foreground">Manage all citizen service requests</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          <FileSpreadsheet className="h-4 w-4" />
          {requestSectionLabels[activeSection]}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { key: 'all', href: '/admin/requests', count: sectionCounts.all, label: 'All Requests' },
          { key: 'pending', href: '/admin/requests?status=pending', count: sectionCounts.pending, label: 'Pending' },
          { key: 'in_progress', href: '/admin/requests?status=in_progress', count: sectionCounts.in_progress, label: 'In Progress' },
          { key: 'resolved', href: '/admin/requests?status=resolved', count: sectionCounts.resolved, label: 'Resolved' },
        ] as const).map((section) => {
          const isActive = activeSection === section.key || (section.key === 'all' && activeSection === 'all')

          return (
            <Link key={section.key} href={section.href}>
              <div
                className={`rounded-2xl border p-4 transition-all ${isActive
                  ? 'border-emerald-500 bg-emerald-600 shadow-md dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-emerald-100 bg-white dark:border-emerald-900 dark:bg-card hover:border-emerald-200 hover:shadow-sm'
                }`}
              >
                <p className={`text-sm font-medium ${isActive ? 'text-emerald-50' : 'text-muted-foreground'}`}>{section.label}</p>
                <div className={`mt-2 text-3xl font-bold ${isActive ? 'text-white' : 'text-foreground'}`}>{section.count}</div>
                <p className={`mt-1 text-xs ${isActive ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                  {section.key === 'pending' && 'Waiting for admin review'}
                  {section.key === 'in_progress' && 'Currently being processed'}
                  {section.key === 'resolved' && 'Finished requests'}
                  {section.key === 'all' && 'All submitted service requests'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : visibleRequests.length === 0 ? (
        <Empty
          title={configError ? 'Supabase not configured' : loadError ? 'Requests table unavailable' : `No ${requestSectionLabels[activeSection].toLowerCase()}`}
          description={configError || loadError || `No service requests found in the ${requestSectionLabels[activeSection].toLowerCase()} section yet`}
        />
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-white dark:bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Request Type</TableHead>
                <TableHead>Date Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRequests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onView={(req) => {
                    setSelectedRequest(req)
                    setIsDetailOpen(true)
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
