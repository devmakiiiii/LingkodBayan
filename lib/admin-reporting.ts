import { requestTypes, getRequestTypeTitle, type RequestType } from './request-types'
import { getDesignationCategoryShortLabel, getDesignationCategoryLabel, getOfficialTermDuration, normalizeBadgeColor } from './governance'

export const adminReportTypes = ['requests', 'residents', 'officials'] as const
export type AdminReportType = (typeof adminReportTypes)[number]

export const analyticsTrendViews = ['daily', 'weekly', 'monthly'] as const
export type AnalyticsTrendView = (typeof analyticsTrendViews)[number]

export const complaintCategories = ['noise', 'dispute', 'theft', 'others'] as const
export type ComplaintCategory = (typeof complaintCategories)[number]

export const adminReportTypeLabels: Record<AdminReportType, string> = {
  requests: 'Requests Report',
  residents: 'Resident Reports',
  officials: 'Officials List',
}

export const analyticsTrendLabels: Record<AnalyticsTrendView, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  noise: 'Noise',
  dispute: 'Dispute',
  theft: 'Theft',
  others: 'Others',
}

export const complaintCategoryColors: Record<ComplaintCategory, string> = {
  noise: '#16a34a',
  dispute: '#22c55e',
  theft: '#65a30d',
  others: '#84cc16',
}

export const statusPalette = {
  pending: '#f59e0b',
  processing: '#0ea5e9',
  approved: '#16a34a',
  rejected: '#f43f5e',
  resolved: '#22c55e',
} as const

export type ReportStatusKey = keyof typeof statusPalette

export interface RequestReportRow {
  id: string
  request_type: string
  title: string | null
  description: string | null
  category: string | null
  status: string | null
  created_at: string
  residents?: {
    first_name: string | null
    last_name: string | null
    email?: string | null
    barangay?: string | null
  } | null
}

export interface ComplaintReportRow {
  id: string
  title: string | null
  description: string | null
  category: string | null
  status: string | null
  created_at: string
  residents?: {
    first_name: string | null
    last_name: string | null
    email?: string | null
    barangay?: string | null
  } | null
}

export interface OfficialReportRow {
  id: string
  full_name: string
  designation_id: string
  term_start: string | null
  term_end: string | null
  status: string
  created_at: string
  designations?: {
    id: string
    name: string
    category: string
    priority_order: number
    badge_color: string | null
  } | null
}

export type PrintableColumn = {
  key: string
  label: string
}

export type PrintableRow = string[]

export function getRequestTypeLabel(requestType?: string | null) {
  return getRequestTypeTitle(requestType, requestType)
}

export function getComplaintStatusLabel(status?: string | null) {
  if (!status) {
    return 'Pending'
  }

  const normalized = status.toLowerCase()
  if (normalized === 'open') return 'Pending'
  if (normalized === 'in-progress') return 'Processing'
  if (normalized === 'resolved') return 'Resolved'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function normalizeComplaintCategory(category?: string | null): ComplaintCategory {
  const normalized = (category || 'others').toLowerCase()
  if ((complaintCategories as readonly string[]).includes(normalized)) {
    return normalized as ComplaintCategory
  }

  return 'others'
}

export function normalizeRequestStatus(status?: string | null): ReportStatusKey {
  const normalized = (status || 'pending').toLowerCase()
  if (normalized === 'in-progress') return 'processing'
  if (normalized === 'resolved') return 'resolved'
  if (normalized === 'approved') return 'approved'
  if (normalized === 'rejected') return 'rejected'
  return 'pending'
}

export function getReportDateLabel(date?: string | null) {
  if (!date) {
    return 'N/A'
  }

  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getReportDateTimeLabel(date?: string | null) {
  if (!date) {
    return 'N/A'
  }

  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTermDuration(termStart?: string | null, termEnd?: string | null) {
  return getOfficialTermDuration(termStart, termEnd)
}

export function getOfficialName(row: OfficialReportRow) {
  return row.full_name
}

export function getOfficialDesignationLabel(row: OfficialReportRow) {
  return row.designations?.name || 'N/A'
}

export function getOfficialCategoryLabel(row: OfficialReportRow) {
  return getDesignationCategoryLabel(row.designations?.category)
}

export function getOfficialCategoryShortLabel(row: OfficialReportRow) {
  return getDesignationCategoryShortLabel(row.designations?.category)
}

export function getOfficialBadgeColor(row: OfficialReportRow) {
  return normalizeBadgeColor(row.designations?.badge_color)
}

export function buildCsv(rows: PrintableRow[], columns: PrintableColumn[]) {
  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
  const header = columns.map((column) => escapeCsv(column.label)).join(',')
  const body = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
  return [header, body].filter(Boolean).join('\n')
}

export function downloadCsvFile(fileName: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function openPrintableReport(options: {
  barangayName: string
  reportTitle: string
  dateRangeLabel: string
  columns: PrintableColumn[]
  rows: PrintableRow[]
  subtitle?: string
}) {
  const popup = window.open('', '_blank', 'width=1200,height=900')

  if (!popup) {
    return false
  }

  const generatedAt = getReportDateTimeLabel(new Date().toISOString())
  const tableHeader = options.columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join('')

  const tableRows = options.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('')

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(options.reportTitle)}</title>
        <style>
          @page { size: landscape; margin: 16mm; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
          .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 16px; margin-bottom: 20px; }
          .header img { width: 72px; height: 72px; object-fit: contain; }
          .meta { margin-bottom: 16px; }
          .meta h1 { margin: 0; font-size: 24px; color: #166534; }
          .meta p { margin: 4px 0; color: #475569; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #dcfce7; color: #14532d; }
          .footer { margin-top: 24px; display: grid; gap: 8px; color: #475569; font-size: 12px; }
          .signature { margin-top: 28px; display: flex; justify-content: flex-end; }
          .signature-box { width: 240px; border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/lingkod-logo.png" alt="Barangay Logo" />
          <div>
            <div style="font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;">${escapeHtml(options.barangayName)}</div>
            <h1>${escapeHtml(options.reportTitle)}</h1>
            <p style="margin: 4px 0 0 0; color: #475569;">${escapeHtml(options.dateRangeLabel)}</p>
            ${options.subtitle ? `<p style="margin: 4px 0 0 0; color: #475569;">${escapeHtml(options.subtitle)}</p>` : ''}
          </div>
        </div>

        <div class="meta">
          <p>Generated by system</p>
        </div>

        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>
            ${tableRows || `<tr><td colspan="${options.columns.length}">No records found</td></tr>`}
          </tbody>
        </table>

        <div class="footer">
          <div>Generated by system</div>
          <div>Date generated: ${escapeHtml(generatedAt)}</div>
          <div class="signature">
            <div class="signature-box">Signature over printed name</div>
          </div>
        </div>
      </body>
    </html>
  `)
  popup.document.close()
  popup.focus()
  setTimeout(() => popup.print(), 250)
  return true
}

