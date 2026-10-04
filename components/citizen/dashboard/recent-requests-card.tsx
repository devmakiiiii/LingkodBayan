'use client'

import Link from 'next/link'

import { StatusTracker } from '@/components/citizen/status-tracker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocale } from '@/hooks/use-locale'
import { formatRelativeDate } from '@/lib/format-date'
import { getSlaBadgeClassName, getSlaStatus } from '@/lib/sla'
import {
  getRequestStatusClassName,
  getRequestStatusLabel,
  getRequestTypeTitle,
} from '@/lib/request-types'

export interface RecentRequest {
  id: string
  title: string
  category: string
  status: string
  created_at: string
  request_type?: string | null
}

interface RecentRequestsCardProps {
  requests: RecentRequest[]
  loading: boolean
}

export function RecentRequestsCard({ requests, loading }: RecentRequestsCardProps) {
  const { t } = useLocale()

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t('Recent Requests')}</CardTitle>
          <CardDescription>{t('Your latest service requests')}</CardDescription>
        </div>
        {requests.length > 0 ? (
          <Link href="/citizen/my-requests">
            <Button variant="ghost" size="sm">
              {t('View all')}
            </Button>
          </Link>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 border-b py-2 last:border-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        ) : requests.length === 0 ? (
          <Empty
            className="p-6 md:p-6"
            title={t('No requests yet')}
            description={t('Request a barangay clearance, certificate of residency, or any other service.')}
            action={
              <Link href="/citizen/request-service">
                <Button size="sm">{t('Request a Service')}</Button>
              </Link>
            }
          />
        ) : (
          <>
            {requests.map((request) => (
              <div
                key={request.id}
                className="space-y-2 border-b py-2 last:border-0"
              >
                {(() => {
                  const sla = getSlaStatus(request)

                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {getRequestTypeTitle(request.request_type, request.title)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.category} · {formatRelativeDate(request.created_at)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('Expected completion:')}{' '}
                            {sla.dueDate
                              ? sla.dueDate.toLocaleDateString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge
                            className={`text-xs ${getRequestStatusClassName(request.status)}`}
                          >
                            {getRequestStatusLabel(request.status)}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${getSlaBadgeClassName(sla.tone)}`}>
                            {sla.label}
                          </Badge>
                        </div>
                      </div>
                    </>
                  )
                })()}
                <StatusTracker kind="request" status={request.status} />
              </div>
            ))}
            <Link href="/citizen/my-requests" className="block pt-2">
              <Button variant="ghost" size="sm" className="w-full">
                {t('View All Requests')}
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
