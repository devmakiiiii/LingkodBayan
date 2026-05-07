'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, FileDown, Printer, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequestDetails } from '@/components/request/request-details'
import {
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getRequestFieldValue(request: RequestRecord, fieldName: string) {
  const value = request.payload?.[fieldName]

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

function getPrintableStatement(request: RequestRecord) {
  const barangayName = request.residents?.barangay ?? 'Barangay [Barangay Name]'
  const requesterName = `${request.residents?.first_name ?? ''} ${request.residents?.last_name ?? ''}`.trim() || '[Full Name]'
  const fullName = getRequestFieldValue(request, 'fullName') || requesterName
  const purpose = getRequestFieldValue(request, 'purpose') || '[Purpose]'
  const businessName = getRequestFieldValue(request, 'businessName') || '[Business Name]'
  const ownerName = getRequestFieldValue(request, 'ownerName') || fullName
  const businessAddress = getRequestFieldValue(request, 'businessAddress') || '[Business Address]'
  const submittedDate = request.created_at ? new Date(request.created_at).toLocaleDateString('en-PH') : '[Date]'

  switch (request.request_type) {
    case 'barangay-clearance':
      return `
        <div class="statement-title">Barangay Clearance</div>
        <p class="statement-text">“This is to certify that Mr./Ms. ${escapeHtml(fullName)}, of legal age, and a bona fide resident of Barangay ${escapeHtml(barangayName)}, has no pending derogatory record or complaint filed in this barangay as of this date. This clearance is issued upon the request of the aforementioned person for whatever legal purpose it may serve.”</p>
      `
    case 'indigency':
      return `
        <div class="statement-title">Certificate of Indigency</div>
        <p class="statement-text">“This is to certify that Mr./Ms. ${escapeHtml(fullName)}, a resident of Barangay ${escapeHtml(barangayName)}, belongs to an indigent family and has insufficient financial capacity to sustain daily living expenses. This certification is issued upon the request of the concerned individual for ${escapeHtml(purpose)}.”</p>
      `
    case 'business-permit':
      return `
        <div class="statement-title">Business Clearance</div>
        <p class="statement-text">“This is to certify that the business establishment known as ${escapeHtml(businessName)}, owned and managed by ${escapeHtml(ownerName)}, located at ${escapeHtml(businessAddress)}, has complied with the requirements and regulations of Barangay ${escapeHtml(barangayName)}. Therefore, the barangay grants clearance for the operation of the said business.”</p>
      `
    case 'good-moral':
      return `
        <div class="statement-title">Good Moral Certificate</div>
        <p class="statement-text">“This is to certify that Mr./Ms. ${escapeHtml(fullName)}, a resident of Barangay ${escapeHtml(barangayName)}, is known to be a person of good moral character and has no known derogatory or criminal record in this barangay as of this date.”</p>
      `
    case 'certificate-residency':
      return `
        <div class="statement-title">Certificate of Residency</div>
        <p class="statement-text">“This is to certify that Mr./Ms. ${escapeHtml(fullName)} is a bona fide resident of Barangay ${escapeHtml(barangayName)}. This certification is issued upon request for ${escapeHtml(purpose)}.”</p>
      `
    default:
      return `
        <div class="statement-title">Service Request</div>
        <p class="statement-text">“This certificate is issued to Mr./Ms. ${escapeHtml(fullName)} of Barangay ${escapeHtml(barangayName)} in connection with the submitted request.”</p>
      `
  }
}

function buildPrintMarkup(request: RequestRecord) {
  const requestTypeTitle = getRequestTypeTitle(request.request_type, request.title)
  const requesterName = `${request.residents?.first_name ?? ''} ${request.residents?.last_name ?? ''}`.trim() || 'N/A'
  const requesterBarangay = request.residents?.barangay ?? 'N/A'
  const submittedDate = request.created_at ? new Date(request.created_at).toLocaleString('en-PH') : 'N/A'
  const footerDate = request.created_at ? new Date(request.created_at).toLocaleDateString('en-PH') : 'Date'

  const requestStatement = getPrintableStatement(request)

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
            padding: 16mm 18mm 18mm;
            background: white;
          }
          .header {
            display: grid;
            grid-template-columns: 72px 1fr 72px;
            align-items: center;
            gap: 16px;
            border-bottom: 3px double #047857;
            padding-bottom: 16px;
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
            font-size: 10px;
            font-weight: 700;
            color: #047857;
          }
          .title {
            text-align: center;
            font-size: 26px;
            font-weight: 800;
            margin: 6px 0 0;
          }
          .subtitle {
            text-align: center;
            color: #475569;
            margin-top: 6px;
            font-size: 13px;
          }
          .meta {
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
          .statement-title {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: #047857;
            margin-bottom: 12px;
            text-align: center;
          }
          .statement-text {
            font-size: 14px;
            line-height: 2;
            margin: 0;
            text-align: justify;
          }
          .certificate {
            margin-top: 18px;
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            padding: 20px 22px;
          }
          .certificate-inner {
            max-width: 720px;
            margin: 0 auto;
          }
          .footer-block {
            margin-top: 20px;
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            padding: 16px;
          }
          .footer-text {
            margin: 0;
            font-size: 14px;
            line-height: 1.8;
            text-align: center;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 22px 28px;
            margin-top: 26px;
          }
          .signature {
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            margin-top: 48px;
            font-size: 13px;
            color: #475569;
            min-height: 24px;
          }
          .signature-label {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
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
            <img src="/lingkod-logo.png" alt="LingkodBayan logo" class="logo" />
            <div>
              <div class="eyebrow">Official Barangay Request Form</div>
              <div class="title">Barangay LingkodBayan</div>
              <div class="subtitle">Request details and approval document</div>
            </div>
            <img src="/barangay.png" alt="Barangay logo" class="logo" />
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

          <div class="certificate">
            <div class="certificate-inner">
              ${requestStatement}
            </div>
          </div>

          <div class="footer-block">
            <p class="footer-text">Issued this ${escapeHtml(footerDate)} at Barangay ${escapeHtml(requesterBarangay)}, Olongapo City, Philippines.</p>
          </div>

          <div class="signature-grid">
            <div>
              <div class="signature-label">Prepared by:</div>
              <div class="signature"></div>
            </div>
            <div>
              <div class="signature-label">Verified by:</div>
              <div class="signature"></div>
            </div>
            <div>
              <div class="signature-label">Approved by:</div>
              <div class="signature"></div>
            </div>
            <div>
              <div class="signature-label">Punong Barangay:</div>
              <div class="signature"></div>
            </div>
            <div>
              <div class="signature-label">Barangay Secretary:</div>
              <div class="signature"></div>
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
