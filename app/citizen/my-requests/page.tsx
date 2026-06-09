'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import Link from 'next/link'
import { Clock, Eye, CheckCircle2 } from 'lucide-react'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, NoCloseDialog } from '@/components/ui/dialog'
import {
  RequestDetails,
} from '@/components/request/request-details'
import {
  getRequestStatusClassName,
  getRequestStatusLabel,
  getRequestSummaryValue,
  getRequestTypeTitle,
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
  updated_at: string
  payload?: Record<string, unknown> | null
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)

  useEffect(() => {
    async function loadRequests() {
      try {
        const supabase = createClient()
        
        // Get user and resident
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const resident = await getOrCreateResidentProfile(supabase, user)

        if (resident) {
          const { data } = await supabase
            .from('requests')
            .select('id, request_type, title, description, category, status, priority, created_at, updated_at, payload')
            .eq('resident_id', resident.id)
            .order('created_at', { ascending: false })

          setRequests(data || [])
        }
      } catch (error) {
        console.error('Error loading requests:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRequests()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-primary" />
      case 'processing':
      case 'in-progress':
        return <Clock className="h-4 w-4 text-sky-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    return getRequestStatusClassName(status)
  }

return (
    <div className="space-y-8 p-8">
      <NoCloseDialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-emerald-100 bg-white">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{getRequestTypeTitle(selectedRequest.request_type, selectedRequest.title)}</DialogTitle>
                <DialogDescription>
                  Review the full request details submitted for processing.
                </DialogDescription>
              </DialogHeader>

              <RequestDetails
                request={selectedRequest}
                showRequester={false}
                showPriority
                showSystemMeta
              />
            </>
          )}
        </DialogContent>
      </NoCloseDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Service Requests</h1>
          <p className="text-muted-foreground mt-2">Track all your submitted service requests</p>
        </div>
        <Link href="/citizen/request-service">
          <Button className="bg-primary hover:bg-primary/90">
            + New Request
          </Button>
        </Link>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <Empty
          title="No requests yet"
          description="Submit your first service request to get started"
          action={
            <Link href="/citizen/request-service">
              <Button className="bg-primary hover:bg-primary/90">
                Create Request
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{getRequestTypeTitle(request.request_type, request.title)}</CardTitle>
                    <CardDescription className="mt-1">{getRequestSummaryValue(request.request_type, request.payload, request.description)}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {getStatusIcon(request.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-background">
                    {getRequestTypeTitle(request.request_type, request.title)}
                  </Badge>
                  <Badge variant="outline" className="bg-background">
                    {request.category}
                  </Badge>
                  <Badge className={getStatusColor(request.status)}>
                    {getRequestStatusLabel(request.status)}
                  </Badge>
                  <Badge variant="secondary">
                    Priority: {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Submitted {new Date(request.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
