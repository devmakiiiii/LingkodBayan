'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, FileDown, Printer, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetails } from '@/components/request/request-details'
import {
  formatRequestFieldValue,
  getRequestFieldEntries,
  getRequestSummaryValue,
  getRequestTypeTitle,
  type RequestPayload,
  type RequestStatus,
} from '@/lib/request-types'

type RequestRecord = {
  id: string
  request_type?: string | null
  title?: string | null
  description?: string | null
  category?: string | null
  status?: string | null
  priority?: string | null
  created_at?: string | null
  payload?: RequestPayload | null
  residents?: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    barangay?: string | null
  } | null
}

interface RequestActionsProps {
  request: RequestRecord | null
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (requestId: string, status: RequestStatus) => Promise<void> | void
}

function buildPrintMarkup(request: RequestRecord) {
  const requestTypeTitle = getRequestTypeTitle(request.request_type, request.title)
  const summaryValue = getRequestSummaryValue(request.request_type, request.payload, request.description)
  const requesterName = `${request.residents?.first_name ?? ''} ${request.residents?.last_name ?? ''}`.trim() || 'N/A'
  const requesterBarangay = request.residents?.barangay ?? 'N/A'
  const submittedDate = request.created_at ? new Date(request.created_at).toLocaleString('en-PH') : 'N/A'

  const fieldRows = getRequestFieldEntries(request.request_type, request.payload).map((field) => {
    const displayValue = Array.isArray(field.value)
      ? field.value.map((item) => (item && typeof item === 'object' && 'name' in item ? String(item.name) : JSON.stringify(item))).join(', ')
      : formatRequestFieldValue(field.value)

    return `
      <div class="row">
        <div class="label">${field.label}</div>
        <div class="value">${displayValue}</div>
      </div>
    `
  }).join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${requestTypeTitle}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
            background: #f8fafc;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm;
            background: white;
          }
          .header {
            display: grid;
            grid-template-columns: 72px 1fr 72px;
            align-items: center;
            gap: 16px;
            border-bottom: 2px solid #d1fae5;
            padding-bottom: 18px;
          }
          .logo {
            width: 72px;
            height: 72px;
            border-radius: 999px;
            object-fit: cover;
            border: 1px solid #cbd5e1;
          }
          .eyebrow {
            text-align: center;
            text-transform: uppercase;
            letter-spacing: .25em;
            font-size: 11px;
            font-weight: 700;
            color: #047857;
          }
          .title {
            text-align: center;
            font-size: 28px;
            font-weight: 800;
            margin: 6px 0 0;
          }
          .subtitle {
            text-align: center;
            color: #475569;
            margin-top: 6px;
            font-size: 13px;
          }
          .meta,
          .panel {
            margin-top: 18px;
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            padding: 16px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .12em;
            color: #64748b;
            margin-bottom: 4px;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
            white-space: pre-wrap;
          }
          .summary {
            font-size: 14px;
            line-height: 1.8;
          }
          .row {
            padding: 10px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .row:last-child { border-bottom: 0; }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
            margin-top: 26px;
          }
          .signature {
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            margin-top: 56px;
            font-size: 13px;
            color: #475569;
          }
          @media print {
            body { background: white; }
            .page { width: auto; min-height: auto; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="/placeholder-logo.png" alt="Barangay logo" class="logo" />
            <div>
              <div class="eyebrow">Official Barangay Request Form</div>
              <div class="title">Barangay LingkodBayan</div>
              <div class="subtitle">Request details and approval document</div>
            </div>
            <div class="logo" style="background:#f8fafc;"></div>
          </div>

          <div class="meta">
            <div class="meta-grid">
              <div>
                <div class="label">Request Type</div>
                <div class="value">${requestTypeTitle}</div>
              </div>
              <div>
                <div class="label">Date Submitted</div>
                <div class="value">${submittedDate}</div>
              </div>
              <div>
                <div class="label">Requester</div>
                <div class="value">${requesterName}</div>
              </div>
              <div>
                <div class="label">Barangay</div>
                <div class="value">${requesterBarangay}</div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="label">Summary</div>
            <div class="summary">${summaryValue}</div>
          </div>

          <div class="panel">
            <div class="label">Request Details</div>
            ${fieldRows || '<div class="summary">No request fields were captured.</div>'}
          </div>

          <div class="signature-grid">
            <div>
              <div class="signature">Prepared By</div>
            </div>
            <div>
              <div class="signature">Approved By</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

function openPrintWindow(request: RequestRecord) {
  const printWindow = window.open('', '_blank', 'width=960,height=1200')

  if (!printWindow) {
    return
  }

  printWindow.document.open()
  printWindow.document.write(buildPrintMarkup(request))
  printWindow.document.close()
  printWindow.focus()

  const triggerPrint = () => {
    printWindow.print()
  }

  if (printWindow.document.readyState === 'complete') {
    triggerPrint()
  } else {
    printWindow.onload = triggerPrint
  }
}

export function RequestActions({ request, isOpen, onClose, onStatusChange }: RequestActionsProps) {
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setStatusMessage('')
    }
  }, [isOpen])

  if (!request) {
    return null
  }

  const requesterName = `${request.residents?.first_name ?? ''} ${request.residents?.last_name ?? ''}`.trim() || 'N/A'

  const handleStatusChange = async (status: RequestStatus) => {
    setStatusMessage('')
    await onStatusChange?.(request.id, status)
    setStatusMessage(`Request marked as ${status}.`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-emerald-100 bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl">Request Details</DialogTitle>
          <DialogDescription>
            Review all submitted fields, update the request status, or print the official document.
          </DialogDescription>
        </DialogHeader>

        {statusMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Requester</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{requesterName}</p>
            <p className="text-sm text-muted-foreground">{request.residents?.email ?? 'No email available'}</p>
          </div>

          <RequestDetails
            request={request}
            requesterName={requesterName}
            requesterEmail={request.residents?.email ?? undefined}
            requesterBarangay={request.residents?.barangay ?? undefined}
          />

          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/30 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Status actions</p>
              <p className="text-sm text-muted-foreground">Update the request review state or export the document.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => handleStatusChange('approved')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => handleStatusChange('processing')}
              >
                <Clock3 className="mr-2 h-4 w-4" />
                Mark as Processing
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => handleStatusChange('rejected')}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button variant="outline" onClick={() => openPrintWindow(request)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" onClick={() => openPrintWindow(request)}>
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
