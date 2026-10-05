'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Copy } from 'lucide-react'
import { StatusTracker } from '@/components/citizen/status-tracker'
import { formatDate } from '@/lib/format-date'
import { formatServiceFee } from '@/lib/charter-services'
import { buildRequestTrackingNumber } from '@/lib/tracking'
import {
  formatPeso,
  getPaymentMethodLabel,
  getPaymentStatusClassName,
  getPaymentStatusLabel,
  getRequestPayment,
} from '@/lib/request-payment'
import {
  formatRequestFieldValue,
  getRequestFieldEntries,
  getRequestStatusClassName,
  getRequestStatusLabel,
  getRequestSummaryValue,
  getRequestTypeTitle,
  type RequestPayload,
  type RequestFileValue,
} from '@/lib/request-types'

type RequestLike = {
  id?: string
  request_type?: string | null
  title?: string | null
  description?: string | null
  category?: string | null
  status?: string | null
  priority?: string | null
  created_at?: string | null
  payload?: RequestPayload | null
}

interface RequestDetailsProps {
  request: RequestLike
  requesterName?: string
  requesterEmail?: string
  requesterBarangay?: string
  className?: string
  showRequester?: boolean
  showPriority?: boolean
  showSystemMeta?: boolean
}

function isFileCollection(value: unknown): value is RequestFileValue[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'name' in item && 'type' in item && 'content' in item)
}

export function RequestDetails({
  request,
  requesterName,
  requesterEmail,
  requesterBarangay,
  className,
  showRequester = true,
  showPriority = true,
  showSystemMeta = true,
}: RequestDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const fieldEntries = getRequestFieldEntries(request.request_type, request.payload)
  const requestTypeTitle = getRequestTypeTitle(request.request_type, request.title)
  const summaryValue = getRequestSummaryValue(request.request_type, request.payload, request.description)
  const payment = getRequestPayment(request.payload)
  const trackingNumber = request.id ? buildRequestTrackingNumber(request.id) : null
  const priorityLabel = request.priority
    ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1)
    : 'Normal'

  const copyToClipboard = async (text: string, fieldKey: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className={`w-full min-w-0 ${className ?? ''}`}>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        {/* Sidebar */}
        <aside className="min-w-0 space-y-5 lg:col-span-2">
          {showSystemMeta && (
            <Card className="min-w-0 overflow-hidden shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Request Overview</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tracking Code</p>
                  {trackingNumber ? (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(trackingNumber, 'tracking-code')}
                      className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground hover:text-primary"
                      title="Click to copy tracking code"
                    >
                      <span className="break-all">{trackingNumber}</span>
                      {copiedField === 'tracking-code' ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      )}
                    </button>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">N/A</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request Type</p>
                  <p className="mt-1 break-words text-sm font-medium text-foreground">{requestTypeTitle}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`mt-1 w-fit ${getRequestStatusClassName(request.status)}`}>
                    {getRequestStatusLabel(request.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {request.created_at ? new Date(request.created_at).toLocaleString('en-PH') : 'N/A'}
                  </p>
                </div>
                {showPriority && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{priorityLabel}</p>
                  </div>
                )}
                <div className="border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progress</p>
                  <div className="mt-2.5">
                    <StatusTracker kind="request" status={request.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {payment && (
            <Card className="min-w-0 overflow-hidden shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-4">
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`mt-1 w-fit max-w-full break-words ${getPaymentStatusClassName(payment.payment_status)}`}>
                      {getPaymentStatusLabel(payment.payment_status)}
                    </Badge>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="mt-1 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">{formatPeso(payment.amount_paid)}</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Method</p>
                  <p className="mt-1 break-words text-sm font-medium text-foreground">{getPaymentMethodLabel(payment.payment_method)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Charter Fee</p>
                  <p className="mt-1 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">{formatServiceFee(payment)}</p>
                </div>
                {payment.reference_number && (
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference Number</p>
                    <p className="mt-1 break-all text-sm font-medium text-foreground [overflow-wrap:anywhere]">{payment.reference_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showRequester && (requesterName || requesterEmail || requesterBarangay) && (
            <Card className="min-w-0 overflow-hidden shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Requester</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-4">
                {requesterName && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
                    <p className="mt-1 break-words text-sm font-medium text-foreground">{requesterName}</p>
                  </div>
                )}
                {requesterEmail && (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(requesterEmail, 'email')}
                        className="-mr-2 h-7 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className={`h-3.5 w-3.5 ${copiedField === 'email' ? 'text-primary' : ''}`} />
                      </Button>
                    </div>
                    <p className="mt-1 break-all text-sm font-medium text-foreground">{requesterEmail}</p>
                  </div>
                )}
                {requesterBarangay && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Barangay</p>
                    <p className="mt-1 break-words text-sm font-medium text-foreground">{requesterBarangay}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Main Content */}
        <main className="min-w-0 space-y-5 lg:col-span-3">
          <Card className="min-w-0 overflow-hidden shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <p className="break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{summaryValue}</p>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Submitted Fields</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              {fieldEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No form details were stored with this request.</p>
              ) : (
                <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  {fieldEntries.map((field) => {
                    if (isFileCollection(field.value)) {
                      return (
                        <div key={field.key} className="min-w-0 sm:col-span-2">
                          <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                          <div className="mt-2 space-y-2">
                            {field.value.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No files uploaded</p>
                            ) : (
                              field.value.map((file) => {
                                const isImage = file.type?.startsWith('image/')
                                return (
                                  <div key={`${field.key}-${file.name}`} className="rounded-lg border bg-background px-3 py-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{file.name}</span>
                                      {file.content && !isImage && (
                                        <a
                                          href={file.content}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 text-xs font-medium text-primary hover:underline"
                                        >
                                          View
                                        </a>
                                      )}
                                    </div>
                                    {file.content && isImage && (
                                      <img src={file.content} alt={file.name} className="mt-2 max-h-48 w-full rounded object-contain" />
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    }

                    const isLongText = field.type === 'textarea'
                    return (
                      <div key={field.key} className="min-w-0 overflow-hidden sm:col-span-1 data-[long=true]:sm:col-span-2" data-long={isLongText}>
                        <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                          {formatRequestFieldValue(field.value)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export function RequestPrintDocument({
  request,
  requesterName,
  requesterBarangay,
}: {
  request: RequestLike
  requesterName?: string
  requesterBarangay?: string
}) {
  const fieldEntries = getRequestFieldEntries(request.request_type, request.payload)
  const requestTypeTitle = getRequestTypeTitle(request.request_type, request.title)
  const summaryValue = getRequestSummaryValue(request.request_type, request.payload, request.description)
  const payment = getRequestPayment(request.payload)

  return (
    <div className="mx-auto max-w-4xl bg-white dark:bg-card p-10 text-slate-900">
      <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
        <img src="/lingkod-logo.png" alt="LingkodBayan logo" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
        <div className="flex-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Official Barangay Request Form</p>
          <h1 className="mt-2 text-3xl font-bold">Barangay LingkodBayan</h1>
          <p className="mt-1 text-sm text-slate-600">Request details and endorsement document</p>
        </div>
        <div className="h-20 w-20" />
      </div>

      <div className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Request Type</p>
          <p className="mt-1 text-lg font-semibold">{requestTypeTitle}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
          <p className="mt-1 text-lg font-semibold">{formatDate(request.created_at)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Requester</p>
          <p className="mt-1 text-lg font-semibold">{requesterName ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Barangay</p>
          <p className="mt-1 text-lg font-semibold">{requesterBarangay ?? 'N/A'}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 p-6">
        <p className="text-xs uppercase tracking-wide text-emerald-700">Summary</p>
        <p className="mt-2 text-base leading-7 text-slate-700">{summaryValue}</p>
      </div>

      {payment && (
        <div className="mt-6 rounded-2xl border border-slate-200 p-6">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Payment</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Charter Fee</p>
              <p className="mt-1 text-base font-semibold">{formatServiceFee(payment)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Amount Paid</p>
              <p className="mt-1 text-base font-semibold">{formatPeso(payment.amount_paid)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payment Method</p>
              <p className="mt-1 text-base font-semibold">{getPaymentMethodLabel(payment.payment_method)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payment Status</p>
              <p className="mt-1 text-base font-semibold">{getPaymentStatusLabel(payment.payment_status)}</p>
            </div>
            {payment.reference_number && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Reference Number</p>
                <p className="mt-1 text-base font-semibold">{payment.reference_number}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 p-6">
        <p className="text-xs uppercase tracking-wide text-emerald-700">Request Details</p>
        <div className="mt-4 space-y-4">
          {fieldEntries.map((field) => (
            <div key={field.key} className="grid gap-1 border-b border-dashed border-slate-200 pb-3 last:border-b-0 last:pb-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
              <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">
                {isFileCollection(field.value)
                  ? field.value.map((file) => file.name).join(', ')
                  : formatRequestFieldValue(field.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">Prepared By</p>
          <div className="mt-10 border-t border-slate-300 pt-2 text-sm text-slate-500">Signature over printed name</div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Approved By</p>
          <div className="mt-10 border-t border-slate-300 pt-2 text-sm text-slate-500">Signature over printed name</div>
        </div>
      </div>
    </div>
  )
}