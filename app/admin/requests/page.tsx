'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  type RequestStatus,
} from '@/lib/request-types'

interface Request {
  id: string
  request_type?: string | null
  title: string
  description: string
  category: string
  status: string
  priority: string
  created_at: string
  payload?: Record<string, unknown> | null
  residents: {
    first_name: string
    last_name: string
    email: string
    barangay: string
  }
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      const supabase = createClient()
      
      const { data } = await supabase
        .from('requests')
        .select('id, request_type, title, description, category, status, priority, created_at, payload, residents(first_name, last_name, email, barangay)')
        .order('created_at', { ascending: false })

      setRequests(data || [])
    } catch (error) {
      console.error('Error loading requests:', error)
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Service Requests</h1>
          <p className="text-muted-foreground mt-2">Manage all citizen service requests</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          <FileSpreadsheet className="h-4 w-4" />
          Dynamic request details enabled
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <Empty title="No requests" description="No service requests have been submitted yet" />
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
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.residents.first_name} {request.residents.last_name}
                    <div className="text-xs text-muted-foreground">{request.residents.email}</div>
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
