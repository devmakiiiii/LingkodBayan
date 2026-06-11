'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Clock3, Loader2Icon, Printer, XCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  NoCloseDialog,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RequestDetails } from '@/components/request/request-details'
import { toast } from 'sonner'
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

function getStatusIcon(status: string) {
  const normalizedStatus = status?.toLowerCase() ?? 'pending'
  switch (normalizedStatus) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    case 'processing':
      return <Clock3 className="h-4 w-4 text-sky-600" />
    case 'rejected':
      return <XCircle className="h-4 w-4 text-rose-600" />
    default:
      return <Clock3 className="h-4 w-4 text-amber-600" />
  }
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
   const [isChangingStatus, setIsChangingStatus] = useState(false)
   const [showRejectConfirm, setShowRejectConfirm] = useState(false)

   useEffect(() => {
     if (!isOpen) {
       setIsChangingStatus(false)
     }
   }, [isOpen])

  if (!request) {
    return null
  }

  const requesterName = `${request.residents?.first_name ?? ''} ${request.residents?.last_name ?? ''}`.trim() || 'N/A'
  const currentStatus = request.status ?? 'pending'

  const handleStatusChange = async (status: RequestStatus) => {
    setIsChangingStatus(true)
    try {
      await onStatusChange?.(request.id, status)
      toast.success(`Request marked as ${status}`)
    } catch (error) {
      toast.error('Failed to update request status')
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleRejectClick = () => {
    setShowRejectConfirm(true)
  }

  const handleRejectConfirm = async () => {
    setShowRejectConfirm(false)
    await handleStatusChange('rejected')
  }

return (
    <NoCloseDialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl w-[95vw] overflow-y-auto border-emerald-100 bg-white p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl">Request Details</DialogTitle>
          <DialogDescription>
            Review all submitted fields, update the request status, or print the official document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-40 justify-between" disabled={isChangingStatus}>
                    <span className="flex items-center gap-2">
                      {isChangingStatus ? <Loader2Icon className="h-4 w-4 animate-spin" /> : getStatusIcon(currentStatus)}
                      <span>Change Status</span>
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('pending')}
                      disabled={currentStatus === 'pending' || isChangingStatus}
                      className="focus:bg-amber-50 focus:text-amber-900"
                    >
                      <Clock3 className="mr-2 h-4 w-4 text-amber-600" />
                      Pending
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('processing')}
                      disabled={currentStatus === 'processing' || isChangingStatus}
                      className="focus:bg-sky-50 focus:text-sky-900"
                    >
                      <Clock3 className="mr-2 h-4 w-4 text-sky-600" />
                      Processing
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('approved')}
                      disabled={currentStatus === 'approved' || isChangingStatus}
                      className="focus:bg-emerald-50 focus:text-emerald-900"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                      Approved
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleRejectClick}
                    disabled={currentStatus === 'rejected' || isChangingStatus}
                    variant="destructive"
                    className="focus:bg-rose-50 focus:text-rose-900"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => openPrintWindow(request)} disabled={isChangingStatus}>
                {isChangingStatus ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Print
              </Button>
            </div>
          </div>

          <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject Request</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the request as rejected. The requester will be notified and the request
                  cannot be processed further. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRejectConfirm}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  Reject Request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </NoCloseDialog>
  )
}


