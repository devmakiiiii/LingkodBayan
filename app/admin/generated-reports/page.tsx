'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, FileText, FileUp, Printer, Table2 } from 'lucide-react'
import {
  adminReportTypeLabels,
  buildCsv,
  complaintCategoryLabels,
  downloadCsvFile,
  getComplaintStatusLabel,
  getOfficialCategoryShortLabel,
  getOfficialDesignationLabel,
  getOfficialName,
  formatTermDuration,
  getReportDateLabel,
  getRequestTypeLabel,
  normalizeComplaintCategory,
  normalizeRequestStatus,
  openPrintableReport,
  type AdminReportType,
  type ComplaintReportRow,
  type OfficialReportRow,
  type PrintableColumn,
  type RequestReportRow,
} from '@/lib/admin-reporting'
import { complaintCategories } from '@/lib/complaint-categories'
import { requestTypes } from '@/lib/request-types'

type ReportStatusOption = 'all' | string

function getResidentFullName(record: RequestReportRow | ComplaintReportRow) {
  const firstName = record.residents?.first_name || ''
  const lastName = record.residents?.last_name || ''
  return `${firstName} ${lastName}`.trim() || 'N/A'
}

type ResidentRecord = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  barangay: string | null
}

type DesignationRecord = {
  id: string
  name: string
  category: string
  priority_order: number
  badge_color: string | null
}

function parseDateValue(value: string) {
  return value ? new Date(value) : null
}

function isWithinRange(dateString: string, from: string, to: string) {
  const date = new Date(dateString)
  const start = parseDateValue(from)
  const end = parseDateValue(to)

  if (start && date < start) {
    return false
  }

  if (end) {
    const inclusiveEnd = new Date(end)
    inclusiveEnd.setHours(23, 59, 59, 999)
    if (date > inclusiveEnd) {
      return false
    }
  }

  return true
}

function buildPrintableDateRange(from: string, to: string) {
  if (!from && !to) {
    return 'All dates'
  }

  if (from && to) {
    return `${getReportDateLabel(from)} to ${getReportDateLabel(to)}`
  }

  if (from) {
    return `From ${getReportDateLabel(from)}`
  }

  return `Until ${getReportDateLabel(to)}`
}

function mapReportTypeToLabel(reportType: AdminReportType) {
  return adminReportTypeLabels[reportType]
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function mapRequestRow(row: any): RequestReportRow {
  return {
    id: row.id,
    request_type: row.request_type,
    title: row.title ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    status: row.status ?? null,
    created_at: row.created_at,
    residents: Array.isArray(row.residents) ? row.residents[0] ?? null : row.residents ?? null,
  }
}

function mapRequestWithResident(row: any, residentsById: Map<string, ResidentRecord>): RequestReportRow {
  return {
    ...mapRequestRow(row),
    residents: row.resident_id ? residentsById.get(row.resident_id) ?? null : null,
  }
}

function mapComplaintRow(row: any): ComplaintReportRow {
  return {
    id: row.id,
    title: row.title ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    status: row.status ?? null,
    created_at: row.created_at,
    residents: Array.isArray(row.residents) ? row.residents[0] ?? null : row.residents ?? null,
  }
}

function mapComplaintWithResident(row: any, residentsById: Map<string, ResidentRecord>): ComplaintReportRow {
  return {
    ...mapComplaintRow(row),
    residents: row.resident_id ? residentsById.get(row.resident_id) ?? null : null,
  }
}

function mapOfficialRow(row: any): OfficialReportRow {
  return {
    id: row.id,
    full_name: row.full_name,
    designation_id: row.designation_id,
    term_start: row.term_start ?? null,
    term_end: row.term_end ?? null,
    status: row.status,
    created_at: row.created_at,
    designations: Array.isArray(row.designations) ? row.designations[0] ?? null : row.designations ?? null,
  }
}

function mapOfficialWithDesignation(row: any, designationsById: Map<string, DesignationRecord>): OfficialReportRow {
  return {
    ...mapOfficialRow(row),
    designations: row.designation_id ? designationsById.get(row.designation_id) ?? null : null,
  }
}

export default function AdminGeneratedReportsPage() {
  const [reportType, setReportType] = useState<AdminReportType>('requests')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReportStatusOption>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [requestTypeFilter, setRequestTypeFilter] = useState('all')
  const [requests, setRequests] = useState<RequestReportRow[]>([])
  const [complaints, setComplaints] = useState<ComplaintReportRow[]>([])
  const [officials, setOfficials] = useState<OfficialReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setLoading(false)
        return
      }

      const supabase = createClient()

      const [{ data: requestsData, error: requestsError }, { data: complaintsData, error: complaintsError }, { data: officialsData, error: officialsError }] = await Promise.all([
        supabase
          .from('requests')
          .select('id, resident_id, request_type, title, description, category, status, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('complaints')
          .select('id, resident_id, title, description, category, status, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('officials')
          .select('id, full_name, designation_id, term_start, term_end, status, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (requestsError) {
        console.warn('Requests report query failed:', requestsError)
      }
      if (complaintsError) {
        console.warn('Complaints report query failed:', complaintsError)
      }
      if (officialsError) {
        console.warn('Officials report query failed:', officialsError)
      }

      const residentIds = [
        ...(requestsData || []).map((row: any) => row.resident_id).filter(Boolean),
        ...(complaintsData || []).map((row: any) => row.resident_id).filter(Boolean),
      ]
      const designationIds = (officialsData || []).map((row: any) => row.designation_id).filter(Boolean)

      const residentRows = residentIds.length
        ? (await supabase.from('residents').select('id, first_name, last_name, email, barangay').in('id', residentIds)).data || []
        : []
      const designationRows = designationIds.length
        ? (await supabase.from('designations').select('id, name, category, priority_order, badge_color').in('id', designationIds)).data || []
        : []

      const residentsById = new Map<string, ResidentRecord>((residentRows || []).map((resident) => [resident.id, resident]))
      const designationsById = new Map<string, DesignationRecord>((designationRows || []).map((designation) => [designation.id, designation]))

      setRequests((requestsData || []).map((row: any) => mapRequestWithResident(row, residentsById)))
      setComplaints((complaintsData || []).map((row: any) => mapComplaintWithResident(row, residentsById)))
      setOfficials((officialsData || []).map((row: any) => mapOfficialWithDesignation(row, designationsById)))
      setLoading(false)
    }

    loadData()
  }, [])

  useEffect(() => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setRequestTypeFilter('all')
  }, [reportType])

  const categoryOptions = useMemo(() => {
    if (reportType === 'requests') {
      return Array.from(new Set(requests.map((record) => record.category).filter(Boolean) as string[])).sort()
    }

    if (reportType === 'residents') {
      return complaintCategories
    }

    return Array.from(new Set(officials.map((record) => record.designations?.category).filter(Boolean) as string[])).sort()
  }, [officials, reportType, requests])

  const statusOptions = useMemo(() => {
    if (reportType === 'requests') {
      return ['pending', 'processing', 'approved', 'rejected']
    }

    if (reportType === 'residents') {
      return ['open', 'in-progress', 'resolved']
    }

    return ['active', 'inactive']
  }, [reportType])

  const preview = useMemo(() => {
    if (reportType === 'requests') {
      const rows = requests
        .filter((record) => isWithinRange(record.created_at, dateFrom, dateTo))
        .filter((record) => statusFilter === 'all' || normalizeRequestStatus(record.status) === statusFilter)
        .filter((record) => categoryFilter === 'all' || (record.category || '').toLowerCase() === categoryFilter.toLowerCase())
        .filter((record) => requestTypeFilter === 'all' || record.request_type === requestTypeFilter)
        .map((record) => ({
          columns: [
            getResidentFullName(record),
            getRequestTypeLabel(record.request_type),
            getReportDateLabel(record.created_at),
            formatLabel(normalizeRequestStatus(record.status)),
          ],
          printableStatus: formatLabel(normalizeRequestStatus(record.status)),
          printableCategory: record.category || 'N/A',
          printableDate: getReportDateLabel(record.created_at),
          printableName: getResidentFullName(record),
          printableType: getRequestTypeLabel(record.request_type),
        }))

      return {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'requestType', label: 'Request Type' },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' },
        ] satisfies PrintableColumn[],
        rows: rows.map((row) => [row.printableName, row.printableType, row.printableDate, row.printableStatus]),
        csvRows: rows.map((row) => [row.printableName, row.printableType, row.printableDate, row.printableStatus]),
        total: rows.length,
      }
    }

    if (reportType === 'residents') {
      const rows = complaints
        .filter((record) => isWithinRange(record.created_at, dateFrom, dateTo))
        .filter((record) => statusFilter === 'all' || (record.status || '').toLowerCase() === statusFilter)
        .filter((record) => categoryFilter === 'all' || normalizeComplaintCategory(record.category) === categoryFilter)
        .map((record) => ({
          printableName: getResidentFullName(record),
          printableCategory: complaintCategoryLabels[normalizeComplaintCategory(record.category)],
          printableDescription: record.description || 'N/A',
          printableStatus: getComplaintStatusLabel(record.status),
          printableDate: getReportDateLabel(record.created_at),
        }))

      return {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status' },
          { key: 'date', label: 'Date' },
        ] satisfies PrintableColumn[],
        rows: rows.map((row) => [row.printableName, row.printableCategory, row.printableDescription, row.printableStatus, row.printableDate]),
        csvRows: rows.map((row) => [row.printableName, row.printableCategory, row.printableDescription, row.printableStatus, row.printableDate]),
        total: rows.length,
      }
    }

    const rows = officials
      .filter((record) => isWithinRange(record.created_at, dateFrom, dateTo))
      .filter((record) => statusFilter === 'all' || record.status === statusFilter)
      .filter((record) => categoryFilter === 'all' || (record.designations?.category || '').toLowerCase() === categoryFilter.toLowerCase())
      .map((record) => ({
        printableName: getOfficialName(record),
        printableDesignation: getOfficialDesignationLabel(record),
        printableCategory: getOfficialCategoryShortLabel(record),
        printableTerm: formatTermDuration(record.term_start, record.term_end),
        printableStatus: formatLabel(record.status),
        printableDate: getReportDateLabel(record.created_at),
      }))

    return {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'designation', label: 'Designation' },
        { key: 'category', label: 'Category' },
        { key: 'term', label: 'Term Duration' },
      ] satisfies PrintableColumn[],
      rows: rows.map((row) => [row.printableName, row.printableDesignation, row.printableCategory, row.printableTerm]),
      csvRows: rows.map((row) => [row.printableName, row.printableDesignation, row.printableCategory, row.printableTerm]),
      total: rows.length,
    }
  }, [categoryFilter, complaints, dateFrom, dateTo, officials, requestTypeFilter, reportType, requests, statusFilter])

  function handlePrint() {
    openPrintableReport({
      barangayName: 'Lingkod Bayan Barangay',
      reportTitle: mapReportTypeToLabel(reportType),
      dateRangeLabel: buildPrintableDateRange(dateFrom, dateTo),
      columns: preview.columns,
      rows: preview.rows,
      subtitle: `Filtered by ${reportType === 'requests' ? 'request type / status / category' : reportType === 'residents' ? 'status / category' : 'status / category'}`,
    })
  }

  function handleExportCsv() {
    const fileName = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`
    const csv = buildCsv(preview.csvRows, preview.columns)
    downloadCsvFile(fileName, csv)
  }

  const requestTypeFilterEnabled = reportType === 'requests'

  return (
    <div className="space-y-8 bg-linear-to-br from-emerald-50 via-white to-lime-50 p-8">
      {configError && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">Supabase not configured</CardTitle>
            <CardDescription className="text-amber-800">{configError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
          <FileText className="h-3.5 w-3.5" />
          Generated Reports
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Generated Reports</h1>
        <p className="max-w-2xl text-sm text-slate-600">Select a report type, filter the data, preview the output, then print or export as CSV.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>Adjust the selected report and narrow the rows before export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as AdminReportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {['requests', 'residents', 'officials'].map((type) => (
                    <SelectItem key={type} value={type}>
                      {adminReportTypeLabels[type as AdminReportType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="from-date">Date From</Label>
                <Input id="from-date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">Date To</Label>
                <Input id="to-date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select value={requestTypeFilter} onValueChange={setRequestTypeFilter} disabled={!requestTypeFilterEnabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Request Types</SelectItem>
                  {requestTypes.map((requestType) => (
                    <SelectItem key={requestType} value={requestType}>
                      {getRequestTypeLabel(requestType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!requestTypeFilterEnabled && <p className="text-xs text-slate-500">Available for requests report only.</p>}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Report
              </Button>
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">Phase 2 export options</p>
              <p className="mt-1">PDF and Excel export buttons can be added later without changing the report preview contract.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{mapReportTypeToLabel(reportType)} Preview</CardTitle>
                <CardDescription>
                  {preview.total} record{preview.total === 1 ? '' : 's'} matched the current filters.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-50 text-emerald-700">{buildPrintableDateRange(dateFrom, dateTo)}</Badge>
                {statusFilter !== 'all' && <Badge className="bg-emerald-50 text-emerald-700">Status: {formatLabel(statusFilter)}</Badge>}
                {categoryFilter !== 'all' && <Badge className="bg-emerald-50 text-emerald-700">Category: {formatLabel(categoryFilter)}</Badge>}
                {requestTypeFilter !== 'all' && <Badge className="bg-emerald-50 text-emerald-700">Request Type: {getRequestTypeLabel(requestTypeFilter)}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-16 text-center text-slate-600">Loading reports...</div>
              ) : preview.total === 0 ? (
                <Empty title="No matching records" description="Try adjusting the date range or filter selections." />
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.columns.map((column) => (
                          <TableHead key={column.key}>{column.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={`${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader>
              <CardTitle>Export Actions</CardTitle>
              <CardDescription>Use the same filtered rows for printing or CSV export.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handlePrint}>
                <FileText className="mr-2 h-4 w-4" />
                Print Report
              </Button>
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
              </Button>
              <Button variant="outline" disabled className="border-slate-200 text-slate-400">
                <FileUp className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button variant="outline" disabled className="border-slate-200 text-slate-400">
                <Table2 className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
