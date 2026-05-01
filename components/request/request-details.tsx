'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatRequestFieldValue,
  getRequestFieldEntries,
  getRequestStatusClassName,
  getRequestStatusLabel,
  getRequestSummaryValue,
  getRequestTypeTitle,
  type RequestPayload,
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

function isFileCollection(value: unknown): value is Array<{ name: string; content?: string }> {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'name' in item)
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
  const fieldEntries = getRequestFieldEntries(request.request_type, request.payload)
  const requestTypeTitle = getRequestTypeTitle(request.request_type, request.title)
  const summaryValue = getRequestSummaryValue(request.request_type, request.payload, request.description)

  return (
    <div className={className}>
      {showSystemMeta && (
        <Card className="border-emerald-200/60 bg-emerald-50/40 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-emerald-900">Request Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Request Type</p>
              <p className="mt-1 font-semibold text-emerald-950">{requestTypeTitle}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Status</p>
              <Badge variant="outline" className={`mt-1 ${getRequestStatusClassName(request.status)}`}>
                {getRequestStatusLabel(request.status)}
              </Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Submitted</p>
              <p className="mt-1 font-semibold text-emerald-950">
                {request.created_at ? new Date(request.created_at).toLocaleString('en-PH') : 'N/A'}
              </p>
            </div>
            {showPriority && (
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">Priority</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {request.priority ? request.priority.charAt(0).toUpperCase() + request.priority.slice(1) : 'Normal'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showRequester && (requesterName || requesterEmail || requesterBarangay) && (
        <Card className="border-emerald-200/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requester Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {requesterName && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
                <p className="mt-1 font-medium text-foreground">{requesterName}</p>
              </div>
            )}
            {requesterEmail && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="mt-1 font-medium text-foreground">{requesterEmail}</p>
              </div>
            )}
            {requesterBarangay && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Barangay</p>
                <p className="mt-1 font-medium text-foreground">{requesterBarangay}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-emerald-200/60 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{summaryValue}</p>
        </CardContent>
      </Card>

      <Card className="border-emerald-200/60 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Submitted Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No form details were stored with this request.</p>
          ) : (
            fieldEntries.map((field) => {
              if (isFileCollection(field.value)) {
                return (
                  <div key={field.key} className="space-y-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">{field.label}</p>
                    <div className="space-y-2">
                      {field.value.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No files uploaded</p>
                      ) : (
                        field.value.map((file) => (
                          <div key={`${field.key}-${file.name}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                            <span className="truncate font-medium text-foreground">{file.name}</span>
                            {file.content ? (
                              <a href={file.content} download={file.name} className="text-emerald-700 hover:underline">
                                View
                              </a>
                            ) : (
                              <span className="text-muted-foreground">Attached</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div key={field.key} className="grid gap-1 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</p>
                  <p className="whitespace-pre-wrap text-sm font-medium text-foreground">{formatRequestFieldValue(field.value)}</p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
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

  return (
    <div className="mx-auto max-w-4xl bg-white p-10 text-slate-900">
      <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
        <img src="/placeholder-logo.png" alt="Barangay logo" className="h-20 w-20 rounded-full border border-slate-200 object-cover" />
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
          <p className="mt-1 text-lg font-semibold">{request.created_at ? new Date(request.created_at).toLocaleDateString('en-PH') : 'N/A'}</p>
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
