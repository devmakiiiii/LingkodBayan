import { getRequestTypeTitle } from './request-types'
import { complaintCategories as canonicalComplaintCategories, type ComplaintCategory as CanonicalComplaintCategory } from './complaint-categories'
import { getDesignationCategoryShortLabel, getDesignationCategoryLabel, getOfficialTermDuration } from './governance'
import { BARANGAY_BARRETTO_BOUNDARY, BARANGAY_MAP_TILE_URL } from './barangay-map'

export const adminReportTypes = ['requests', 'residents', 'officials', 'audit'] as const
export type AdminReportType = (typeof adminReportTypes)[number]

export const analyticsTrendViews = ['daily', 'weekly', 'monthly'] as const
export type AnalyticsTrendView = (typeof analyticsTrendViews)[number]

export const complaintCategories = canonicalComplaintCategories
export type ComplaintCategory = CanonicalComplaintCategory

export const adminReportTypeLabels: Record<AdminReportType, string> = {
  requests: 'Requests Report',
  residents: 'Resident Reports',
  officials: 'Officials List',
  audit: 'Audit Trail Report',
}

export const analyticsTrendLabels: Record<AnalyticsTrendView, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const complaintCategoryLabels: Record<ComplaintCategory, string> = {
  'Noise Complaint': 'Noise Complaint',
  'Public Disturbance': 'Public Disturbance',
  'Sanitation': 'Sanitation',
  'Infrastructure Issue': 'Infrastructure Issue',
  'Barangay Incident': 'Barangay Incident',
  'Illegal Parking': 'Illegal Parking',
  'Street Light Problem': 'Street Light Problem',
  'Other Concerns': 'Other Concerns',
}

export const complaintCategoryColors: Record<ComplaintCategory, string> = {
  'Noise Complaint': '#16a34a',
  'Public Disturbance': '#f59e0b',
  'Sanitation': '#0ea5e9',
  'Infrastructure Issue': '#8b5cf6',
  'Barangay Incident': '#f43f5e',
  'Illegal Parking': '#f97316',
  'Street Light Problem': '#eab308',
  'Other Concerns': '#64748b',
}

export const complaintStatuses = ['open', 'under_investigation', 'resolved', 'dismissed', 'cancelled'] as const
export type ComplaintStatus = (typeof complaintStatuses)[number]

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
    rank: number
  } | null
}

export interface AuditLogReportRow {
  id: string
  admin_id: string | null
  admin_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type PrintableColumn = {
  key: string
  label: string
}

export type PrintableRow = string[]

export function getRequestTypeLabel(requestType?: string | null) {
  return getRequestTypeTitle(requestType, requestType)
}

export function normalizeComplaintStatus(status?: string | null): ComplaintStatus {
  const normalized = (status || 'open').toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'open' || normalized === 'pending') return 'open'
  if (normalized === 'under_investigation' || normalized === 'under_review' || normalized === 'processing' || normalized === 'in_progress' || normalized === 'in-progress') return 'under_investigation'
  if (normalized === 'resolved' || normalized === 'approved') return 'resolved'
  if (normalized === 'dismissed' || normalized === 'rejected') return 'dismissed'
  if (normalized === 'cancelled' || normalized === 'withdrawn') return 'cancelled'
  return 'open'
}

export function getComplaintStatusLabel(status?: string | null) {
  if (!status) {
    return 'Pending'
  }

  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'open' || normalized === 'pending') return 'Pending'
  if (normalized === 'under_investigation' || normalized === 'under_review' || normalized === 'processing' || normalized === 'in_progress' || normalized === 'in-progress') return 'Under Review'
  if (normalized === 'resolved' || normalized === 'approved') return 'Resolved'
  if (normalized === 'dismissed' || normalized === 'rejected') return 'Rejected'
  if (normalized === 'cancelled' || normalized === 'withdrawn') return 'Cancelled'
  if (normalized === 'archived') return 'Archived'
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function normalizeComplaintCategory(category?: string | null): ComplaintCategory {
  const normalized = (category || '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  const aliases: Record<string, ComplaintCategory> = {
    noise: 'Noise Complaint',
    'noise-complaint': 'Noise Complaint',
    dispute: 'Public Disturbance',
    'public-disturbance': 'Public Disturbance',
    sanitation: 'Sanitation',
    infrastructure: 'Infrastructure Issue',
    'infrastructure-issue': 'Infrastructure Issue',
    incident: 'Barangay Incident',
    theft: 'Barangay Incident',
    crime: 'Barangay Incident',
    'barangay-incident': 'Barangay Incident',
    parking: 'Illegal Parking',
    'illegal-parking': 'Illegal Parking',
    light: 'Street Light Problem',
    'street-light-problem': 'Street Light Problem',
    other: 'Other Concerns',
    others: 'Other Concerns',
    'other-concerns': 'Other Concerns',
  }

  return aliases[normalized] ?? 'Other Concerns'
}

export function normalizeRequestStatus(status?: string | null): ReportStatusKey {
  const normalized = (status || 'pending').toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'in_progress' || normalized === 'in-progress' || normalized === 'processing') return 'processing'
  if (normalized === 'resolved') return 'resolved'
  if (normalized === 'approved') return 'approved'
  if (normalized === 'rejected' || normalized === 'dismissed') return 'rejected'
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

// getOfficialBadgeColor() was removed in migration 43. It had no callers, and
// the stored badge_color it read is gone - colors now come from
// getDesignationBadgeColor(row.designations?.category).

export function buildCsv(rows: PrintableRow[], columns: PrintableColumn[]) {
  // Neutralize spreadsheet formula injection (OWASP): a cell starting with
  // =, +, @, tab, or CR would otherwise execute as a formula in Excel/Sheets.
  const escapeCsv = (value: string) => {
    const safe = /^[=+@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const header = columns.map((column) => escapeCsv(column.label)).join(',')
  const body = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
  return [header, body].filter(Boolean).join('\n')
}

export function downloadCsvFile(fileName: string, csvContent: string) {
  // UTF-8 BOM so Excel renders Filipino characters (ñ, é, etc.) correctly.
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function downloadXlsxFile(
  fileName: string,
  sheetName: string,
  columns: PrintableColumn[],
  rows: PrintableRow[],
) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31))

  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.max(14, Math.min(48, column.label.length + 8)),
  }))

  sheet.getRow(1).font = { bold: true, color: { argb: 'FF14532D' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
  sheet.getRow(1).height = 22

  for (const row of rows) {
    sheet.addRow(row)
  }

  for (let rowIndex = 2; rowIndex <= rows.length + 1; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= columns.length; columnIndex += 1) {
      const cell = sheet.getCell(rowIndex, columnIndex)
      // Render as text so leading =, +, @ cannot execute as formulas.
      cell.value = String(cell.value ?? '')
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
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
  /** Inline Leaflet setup script for the hotspot map, rendered in this popup. */
  mapScript?: string
  /**
   * One row per filtered report, rendered as a compact table under the map so
   * every report is accounted for on paper — including ones without a pinned
   * location, which cannot be drawn as markers.
   */
  mappedReports?: Array<{ label: string; status: string; address: string; plotted: boolean }>
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
        <link rel="stylesheet" href="/leaflet/leaflet.css" />
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
          .map-section { margin-top: 24px; page-break-inside: avoid; }
          .map-section h2 { margin: 0 0 10px 0; font-size: 18px; color: #166534; }
          #print-map { width: 100%; height: 640px; border: 1px solid #cbd5e1; border-radius: 6px; background: #e2e8f0; }
          #print-map .leaflet-tooltip {
            font: 11px/1.3 Arial, sans-serif;
            color: #0f172a;
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid #cbd5e1;
            box-shadow: none;
            padding: 2px 6px;
          }
          #print-map .leaflet-tooltip-right::before { border-right-color: #cbd5e1; }
          .mapped-table { margin-top: 12px; font-size: 12px; }
          .mapped-table td, .mapped-table th { padding: 6px 8px; }
          /* Browsers strip background colors and translucent fills (like the
             0.35-opacity hotspot circles) from print output unless this is
             set — without it the circles print invisible on white paper. */
          @media print {
            html, body, #print-map, #print-map * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
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

        ${options.mapScript ? `
        <div class="map-section">
          <h2>Complaints Hotspot Map</h2>
          <div id="print-map"></div>
          ${(() => {
            const mapped = options.mappedReports ?? []
            if (mapped.length === 0) return ''
            const plottedCount = mapped.filter((m) => m.plotted).length
            const rows = mapped
              .map(
                (m) =>
                  `<tr><td>${escapeHtml(m.label)}</td><td>${escapeHtml(m.status)}</td><td>${escapeHtml(m.address)}</td><td>${m.plotted ? 'Marked on map' : 'No pinned location'}</td></tr>`,
              )
              .join('')
            return `
          <p style="margin: 10px 0 6px 0; font-size: 12px; color: #475569;">
            ${plottedCount} of ${mapped.length} filtered report${mapped.length === 1 ? '' : 's'} ${plottedCount === 1 ? 'has' : 'have'} a pinned location and ${plottedCount === 1 ? 'is' : 'are'} marked on the map above. Reports filed at the same spot are drawn as separate, slightly offset markers.
          </p>
          <table class="mapped-table">
            <thead><tr><th>Tracking #</th><th>Status</th><th>Location</th><th>Map</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`
          })()}
        </div>` : ''}

        <div class="footer">
          <div>Generated by system</div>
          <div>Date generated: ${escapeHtml(generatedAt)}</div>
          <div class="signature">
            <div class="signature-box">Signature over printed name</div>
          </div>
        </div>

        <script src="/leaflet/leaflet.js"><\/script>
        ${options.mapScript ? `<script>${options.mapScript}<\/script>` : ''}
      </body>
    </html>
  `)
  popup.document.close()

  // Print once the map tiles have actually rendered (or after a generous
  // fallback delay) — not just when the popup fires `load`, which happens
  // before Leaflet fetches anything from the CDN and would print a blank map.
  let hasPrinted = false
  const printWhenReady = () => {
    if (hasPrinted || popup.closed) return
    hasPrinted = true
    popup.focus()
    popup.print()
  }
  popup.addEventListener('load', () => {
    if (!options.mapScript) {
      printWhenReady()
      return
    }
    // The map script (see buildComplaintsHotspotMapScript) sets
    // `window.__printMapReady = true` in the popup once every visible tile has
    // fetched (Leaflet's `load`) or failed (`tileerror`). Poll for that flag —
    // with a hard 15 s ceiling so the dialog always appears even if the tile
    // server hangs.
    const deadline = Date.now() + 15000
    const poll = () => {
      if (hasPrinted || popup.closed) return
      let ready = false
      try {
        ready = (popup as unknown as { __printMapReady?: boolean }).__printMapReady === true
      } catch {
        ready = false
      }
      if (ready || Date.now() > deadline) {
        // One paint after the last tile lands so Leaflet's canvases/SVG layers
        // are composited before the print snapshot.
        setTimeout(printWhenReady, 150)
        return
      }
      setTimeout(poll, 200)
    }
    poll()
  })
  return true
}

/**
 * Builds the inline Leaflet script that renders the complaints hotspot map
 * into a `#print-map` div inside the printable report popup: barangay
 * boundary, ~200 m hotspot circles and status-colored pins for the given
 * complaints — mirroring the on-screen analytics map.
 *
 * The script runs directly in the popup (Leaflet is loaded there via CDN),
 * because printing embedded iframes is unreliable — browsers often render
 * them blank in print output.
 *
 * JSON.stringify output is safe to drop into a <script> block (it cannot emit
 * a closing script tag once `<` is escaped), so the boundary rides along in
 * the document instead of being fetched at print time.
 */
export function buildComplaintsHotspotMapScript(complaints: Array<{
  latitude: number
  longitude: number
  status: string
  subject: string
}>) {
  // Mirrors the on-screen hotspot map: same ~200 m grid, same status colors,
  // same barangay boundary source.
  const HOTSPOT_GRID_FACTOR = 500
  const statusColors: Record<string, string> = {
    // Canonical statuses used by the admin page (statusDefinitions), plus the
    // legacy raw DB values that normalizeStatus maps onto them.
    pending: '#ef4444',
    open: '#ef4444',
    under_review: '#eab308',
    under_investigation: '#eab308',
    processing: '#eab308',
    'in-progress': '#eab308',
    resolved: '#22c55e',
    rejected: '#64748b',
    dismissed: '#64748b',
    cancelled: '#94a3b8',
  }
  const escapeJsString = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      // Prevent `</script>` in user text from terminating the popup's script
      // block; `\\u003c` is a valid JS escape inside the string literal.
      .replace(/</g, '\\u003c')
  // Same `<` escaping applies to the boundary JSON below.
  const boundaryJson = JSON.stringify(BARANGAY_BARRETTO_BOUNDARY).replace(/</g, '\\u003c')

  // Complaints pinned at (nearly) the same spot stack into what looks like a
  // single marker. Offset each duplicate by ~35 m diagonal steps so every
  // report stays individually visible and identifiable on paper.
  const seenPins = new Map<string, number>()
  const plottedPins = complaints.map((complaint) => {
    const key = `${complaint.latitude.toFixed(4)}:${complaint.longitude.toFixed(4)}`
    const index = seenPins.get(key) ?? 0
    seenPins.set(key, index + 1)
    const offset = index * 0.00032
    return {
      complaint,
      latitude: complaint.latitude + offset,
      longitude: complaint.longitude + offset,
    }
  })

  const markerLabel = (subject: string) =>
    escapeJsString(subject.length > 32 ? `${subject.slice(0, 32)}\u2026` : subject)

  const markers = plottedPins
    .map(
      ({ complaint, latitude, longitude }) => `
  L.circleMarker([${latitude}, ${longitude}], {
    radius: 6,
    color: '${statusColors[complaint.status] ?? '#334155'}',
    weight: 1.5,
    fillColor: '${statusColors[complaint.status] ?? '#334155'}',
    fillOpacity: 0.9,
  })
    // Permanent label so each printed pin is identifiable without clicking.
    .bindTooltip('${markerLabel(complaint.subject)}', { permanent: true, direction: 'right', offset: [10, 0] })
    .addTo(map);`,
    )
    .join('')

  // Same ~200 m grid the on-screen hotspot view uses, so the printed
  // clusters match what officials see in the Map tab. Computed as data first
  // (centers + counts) so the fit-bounds step below can include hotspot
  // centers, then rendered as circles.
  const hotspotCells = (() => {
    const cells = new Map<string, { latSum: number; lngSum: number; count: number }>()
    for (const complaint of complaints) {
      const lat = Math.round(complaint.latitude * HOTSPOT_GRID_FACTOR) / HOTSPOT_GRID_FACTOR
      const lng = Math.round(complaint.longitude * HOTSPOT_GRID_FACTOR) / HOTSPOT_GRID_FACTOR
      const key = `${lat}:${lng}`
      const cell = cells.get(key) ?? { latSum: 0, lngSum: 0, count: 0 }
      cell.latSum += complaint.latitude
      cell.lngSum += complaint.longitude
      cell.count += 1
      cells.set(key, cell)
    }
    return Array.from(cells.entries())
      .filter(([, cell]) => cell.count >= 2)
      .map(([key, cell]) => ({
        key,
        latitude: cell.latSum / cell.count,
        longitude: cell.lngSum / cell.count,
        count: cell.count,
      }))
  })()

  const hotspots = hotspotCells
    .map(
      (cell) => `
  L.circleMarker([${cell.latitude}, ${cell.longitude}], {
    radius: ${Math.min(12 + cell.count * 3, 40)},
    color: '#dc2626',
    weight: 2,
    fillColor: '#f87171',
    fillOpacity: 0.5,
  }).addTo(map);`,
    )
    .join('')

  // Hotspot centers as coordinate pairs so the fit-bounds step in the popup
  // script can include them (see markerCoords/hotspotCoords concat below).
  const hotspotCoords = hotspotCells
    .map((cell) => `  [${cell.latitude}, ${cell.longitude}],`)
    .join('\n')

  return `
var map = L.map('print-map', {
  // Render vectors (hotspot circles, pins, boundary) into a <canvas> instead
  // of SVG: Chrome/Edge sometimes drop or wash out SVG paths when printing,
  // while a canvas prints deterministically like an image.
  preferCanvas: true,
  zoomControl: false,
  attributionControl: false,
  scrollWheelZoom: false,
  dragging: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  touchZoom: false,
});
var tileLayer = L.tileLayer('${BARANGAY_MAP_TILE_URL}').addTo(map);
var boundary = ${boundaryJson};
L.geoJSON(boundary, {
  interactive: false,
  style: { color: '#1d4ed8', weight: 2, opacity: 0.8, fillColor: '#3b82f6', fillOpacity: 0.05 },
}).addTo(map);
// Zoom to the reports themselves (not the whole barangay) so street names and
// landmarks are legible on paper. Hotspot centers join the fit so a cluster
// circle sitting outside the pin cloud is never cropped, and the pixel padding
// (>= the 40 px max hotspot radius) keeps the whole circle on the page — the
// old fractional pad + one-level zoom bump used to clip hotspot edges.
var markerCoords = [
${plottedPins.map((pin) => `  [${pin.latitude}, ${pin.longitude}],`).join('\n')}
];
var hotspotCoords = [
${hotspotCoords}
];
var fitCoords = markerCoords.concat(hotspotCoords);
var fitBounds = L.latLngBounds(fitCoords);
if (fitBounds.isValid()) {
  map.fitBounds(fitBounds, { padding: [48, 48], maxZoom: 18 });
} else {
  map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [12, 12] });
}
${markers}
// Hotspot density circles — drawn over the status pins, same as the on-screen
// analytics map, so clusters stay visible at the tighter report-level zoom.
${hotspots}
setTimeout(function () { map.invalidateSize(); }, 200);
// Signal print-readiness: resolved when every visible tile has fetched
// ('load'), or when any tile errors out (nothing more will paint), or after
// 8 s worst case. The opener polls window.__printMapReady before printing.
var printMapDone = false;
var markPrintMapReady = function () {
  if (printMapDone) return;
  printMapDone = true;
  window.__printMapReady = true;
};
tileLayer.on('load', markPrintMapReady);
tileLayer.on('tileerror', markPrintMapReady);
setTimeout(markPrintMapReady, 8000);
`
}


