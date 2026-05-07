'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const searchParams = useSearchParams()

  const activeSection = normalizeSectionFilter(searchParams.get('status'))

  useEffect(() => {
    loadRequests()
  }, [])

  const visibleRequests = useMemo(() => {
    const allowedStatuses = getSectionStatuses(activeSection)

    return requests.filter((request) => allowedStatuses.includes(normalizeRequestStatus(request.status)))
  }, [activeSection, requests])

  const sectionCounts = useMemo(() => ({
    pending: requests.filter((request) => normalizeRequestStatus(request.status) === 'pending').length,
    in_progress: requests.filter((request) => normalizeRequestStatus(request.status) === 'in_progress').length,
    resolved: requests.filter((request) => normalizeRequestStatus(request.status) === 'resolved').length,
  }), [requests])

  async function loadRequests() {
    try {
      setLoadError(null)
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setRequests([])
        return
      }

      const supabase = createClient()

      // Use wildcard select so page still works even when local DB is behind some migrations.
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error?.message || 'Failed to load requests')
        setRequests([])
        return
      }

      const residentIds = Array.from(new Set((data || []).map((row: any) => row.resident_id).filter(Boolean)))
      let residentsById: Record<string, { first_name: string; last_name: string; email: string; barangay: string }> = {}

      if (residentIds.length > 0) {
        const { data: residents, error: residentsError } = await supabase
          .from('residents')
          .select('id, first_name, last_name, email, barangay')
          .in('id', residentIds)

        if (!residentsError) {
          residentsById = Object.fromEntries(
            (residents || []).map((resident: any) => [resident.id, {
              first_name: resident.first_name,
              last_name: resident.last_name,
              email: resident.email,
              barangay: resident.barangay,
            }]),
          )
        }
      }

      const mappedRequests: Request[] = (data || []).map((row: any) => ({
        ...row,
        residents: residentsById[row.resident_id] || null,
      }))

      setRequests(mappedRequests)
    } catch (error: any) {
      setLoadError(error?.message || 'Failed to load requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function updateRequestStatus(requestId: string, newStatus: RequestStatus) {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', requestId)

      if (error) throw error

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

      // Refresh list
      loadRequests()
    } catch (error) {
      console.error('Error updating request:', error)
    }
  }

  return (
    <div className="space-y-8 p-8">
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
          { key: 'all', href: '/admin/requests', count: requests.length, label: 'All Requests' },
          { key: 'pending', href: '/admin/requests?status=pending', count: sectionCounts.pending, label: 'Pending' },
          { key: 'in_progress', href: '/admin/requests?status=in_progress', count: sectionCounts.in_progress, label: 'In Progress' },
          { key: 'resolved', href: '/admin/requests?status=resolved', count: sectionCounts.resolved, label: 'Resolved' },
        ] as const).map((section) => {
          const isActive = activeSection === section.key || (section.key === 'all' && activeSection === 'all')

          return (
            <Link key={section.key} href={section.href}>
              <div
                className={`rounded-2xl border p-4 transition-all ${isActive
                  ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                  : 'border-emerald-100 bg-white hover:border-emerald-200 hover:shadow-sm'
                }`}
              >
                <p className="text-sm font-medium text-muted-foreground">{section.label}</p>
                <div className="mt-2 text-3xl font-bold text-foreground">{section.count}</div>
                <p className="mt-1 text-xs text-muted-foreground">
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
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      ) : visibleRequests.length === 0 ? (
        <Empty
          title={configError ? 'Supabase not configured' : loadError ? 'Requests table unavailable' : `No ${requestSectionLabels[activeSection].toLowerCase()}`}
          description={configError || loadError || `No service requests found in the ${requestSectionLabels[activeSection].toLowerCase()} section yet`}
        />
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Request Type</TableHead>
                <TableHead>Date Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRequests.map((request) => (
                <TableRow key={request.id}>
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
                      onClick={() => {
                        setSelectedRequest(request)
                        setIsDetailOpen(true)
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
