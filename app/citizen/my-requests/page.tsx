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
  type RequestPayload,
} from '@/lib/request-types'
import { getSlaBadgeClassName, getSlaStatus } from '@/lib/sla'
import { useLocale } from '@/hooks/use-locale'

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
  payload?: RequestPayload | null
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const { t } = useLocale()

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
    <div className="space-y-8 p-8 max-w-5xl mx-auto w-full">
      <NoCloseDialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden border-emerald-100 bg-white p-0 dark:bg-card md:w-[92vw]">
          {selectedRequest && (
            <>
              <DialogHeader className="shrink-0 border-b border-border/60 px-5 pb-4 pt-5 md:px-8 md:pt-6">
                <DialogTitle className="break-words text-xl leading-snug md:text-2xl">{getRequestTypeTitle(selectedRequest.request_type, selectedRequest.title)}</DialogTitle>
                <DialogDescription className="break-words">
                  {t('Review the full request details submitted for processing.')}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-6">
              <RequestDetails
                request={selectedRequest}
                showRequester={false}
                showPriority
                showSystemMeta
              />
              </div>
            </>
          )}
        </DialogContent>
      </NoCloseDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('My Service Requests')}</h1>
          <p className="text-muted-foreground mt-2">{t('Track all your submitted service requests')}</p>
        </div>
        <Link href="/citizen/request-service">
          <Button className="bg-primary hover:bg-primary/90">
            {t('+ New Request')}
          </Button>
        </Link>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('Loading requests...')}</p>
        </div>
      ) : requests.length === 0 ? (
        <Empty
          title={t('No requests yet')}
          description={t('Submit your first service request to get started')}
          action={
            <Link href="/citizen/request-service">
              <Button className="bg-primary hover:bg-primary/90">
                {t('Create Request')}
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
                    {t('Priority:')} {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                  </Badge>
                  {(() => {
                    const sla = getSlaStatus(request)

                    return (
                      <Badge variant="outline" className={getSlaBadgeClassName(sla.tone)}>
                        {sla.label}
                      </Badge>
                    )
                  })()}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {t('Submitted')} {new Date(request.created_at).toLocaleDateString()}
                    {(() => {
                      const sla = getSlaStatus(request)

                      return sla.dueDate
                        ? ` · ${t('Expected completion')} ${sla.dueDate.toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : null
                    })()}
                  </span>
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {t('View Details')}
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
