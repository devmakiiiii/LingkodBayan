'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Archive,
  FileDown,
  FileText,
  Filter,
  Flag,
  Loader2,
  MapPinned,
  MessageSquareReply,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCircle2,
  UserPlus,
  Eye,
  RefreshCcw,
  Reply,
  Send,
  Clock3,
  GripVertical,
} from 'lucide-react'
import {
  buildCsv,
  downloadCsvFile,
  getReportDateLabel,
  getReportDateTimeLabel,
  openPrintableReport,
  type PrintableColumn,
} from '@/lib/admin-reporting'

type CanonicalStatus = 'pending' | 'under_review' | 'resolved' | 'rejected'
type CanonicalPriority = 'low' | 'medium' | 'high' | 'critical'

const unassignedOfficialValue = '__unassigned__'

type ResidentRow = {
  id: string
  user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  barangay?: string | null
  address?: string | null
  contact_number?: string | null
}

type OfficialOption = {
  id: string
  label: string
  designationLabel: string
}

type ComplaintMessageRow = {
  id: string
  complaint_id: string
  sender_id?: string | null
  recipient_user_id?: string | null
  message: string
  message_type?: string | null
  is_read?: boolean | null
  created_at: string
}

type ResidentReportRow = {
  id: string
  trackingNumber: string
  title: string
  description: string
  category: string
  categoryKey: string
  status: CanonicalStatus
  priority: CanonicalPriority
  residentId: string
  residentUserId: string
  residentName: string
  residentAddress: string
  residentBarangay: string
  residentEmail: string
  residentContact: string
  locationAddress: string
  latitude: number | null
  longitude: number | null
  submittedAt: string
  assignedOfficialId: string | null
  assignedOfficialLabel: string
  adminNotes: string
  archivedAt: string | null
  evidenceUrls: string[]
  messages: ComplaintMessageRow[]
}

type NotificationAlert = {
  id: string
  message: string
  createdAt: string
}

type CategoryDefinition = {
  key: string
  label: string
  badgeClass: string
  keywords: string[]
  fallbackPriority: CanonicalPriority
}

const categoryDefinitions: CategoryDefinition[] = [
  {
    key: 'noise-complaint',
    label: 'Noise Complaint',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    keywords: ['noise', 'loud', 'karaoke', 'music', 'party'],
    fallbackPriority: 'low',
  },
  {
    key: 'public-disturbance',
    label: 'Public Disturbance',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    keywords: ['disturbance', 'dispute', 'gulo', 'fight', 'altercation', 'corruption', 'abuse of power', 'mismanagement'],
    fallbackPriority: 'high',
  },
  {
    key: 'sanitation',
    label: 'Sanitation',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    keywords: ['sanitation', 'garbage', 'trash', 'waste', 'sewer', 'drain', 'odor', 'dirty', 'environment'],
    fallbackPriority: 'medium',
  },
  {
    key: 'infrastructure-issue',
    label: 'Infrastructure Issue',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    keywords: ['infrastructure', 'road', 'pothole', 'bridge', 'repair', 'drainage', 'unsafe conditions'],
    fallbackPriority: 'high',
  },
  {
    key: 'barangay-incident',
    label: 'Barangay Incident',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    keywords: ['incident', 'assault', 'theft', 'burglary', 'violence', 'crime', 'abuse'],
    fallbackPriority: 'critical',
  },
  {
    key: 'illegal-parking',
    label: 'Illegal Parking',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    keywords: ['parking', 'parked', 'obstruction'],
    fallbackPriority: 'low',
  },
  {
    key: 'street-light-problem',
    label: 'Street Light Problem',
    badgeClass: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    keywords: ['street light', 'light', 'lamp', 'dark'],
    fallbackPriority: 'medium',
  },
  {
    key: 'other-concerns',
    label: 'Other Concerns',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    keywords: [],
    fallbackPriority: 'low',
  },
]

const statusDefinitions: Record<CanonicalStatus, { label: string; badgeClass: string; rawValues: string[] }> = {
  pending: {
    label: 'Pending',
    badgeClass: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    rawValues: ['pending', 'open'],
  },
  under_review: {
    label: 'Under Review',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    rawValues: ['under_review', 'under-investigation', 'under_investigation', 'processing', 'in-progress'],
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rawValues: ['resolved'],
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    rawValues: ['rejected', 'dismissed'],
  },
}

const priorityDefinitions: Record<CanonicalPriority, { label: string; badgeClass: string; icon?: typeof TriangleAlert }> = {
  low: {
    label: 'Low',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  medium: {
    label: 'Medium',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  high: {
    label: 'High',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
  },
  critical: {
    label: 'Critical',
    badgeClass: 'border-red-900 bg-red-950 text-white',
    icon: TriangleAlert,
  },
}

const statusToDatabaseValue: Record<CanonicalStatus, string> = {
  pending: 'open',
  under_review: 'under_investigation',
  resolved: 'resolved',
  rejected: 'dismissed',
}

function fullNameOf(resident?: ResidentRow | null) {
  const firstName = resident?.first_name || ''
  const lastName = resident?.last_name || ''
  return `${firstName} ${lastName}`.trim() || 'N/A'
}

function normalizeTrackingNumber(id: string) {
  return `RPT-${id.slice(0, 8).toUpperCase()}`
}

function normalizeStatus(raw?: string | null): CanonicalStatus {
  const normalized = (raw || 'pending').toLowerCase()
  const match = Object.entries(statusDefinitions).find(([, definition]) => definition.rawValues.includes(normalized))
  return (match?.[0] as CanonicalStatus) || 'pending'
}

function normalizeCategory(row: any): CategoryDefinition {
  const rawText = `${row.category || ''} ${row.title || ''} ${row.description || ''}`.toLowerCase()

  for (const definition of categoryDefinitions) {
    if (definition.key === rawText || definition.label.toLowerCase() === (row.category || '').toLowerCase()) {
      return definition
    }

    if (definition.key === 'other-concerns') {
      continue
    }

    if (definition.key === 'street-light-problem') {
      if (definition.key.includes('street') && (rawText.includes('street light') || rawText.includes('lamp') || rawText.includes('light'))) {
        return definition
      }
    }

    if (definition.key === 'barangay-incident') {
      if (rawText.includes('incident') || rawText.includes('theft') || rawText.includes('violence') || rawText.includes('assault') || rawText.includes('crime') || rawText.includes('abuse')) {
        return definition
      }
    }

    if (definition.key === 'public-disturbance') {
      if (rawText.includes('disturb') || rawText.includes('dispute') || rawText.includes('corruption') || rawText.includes('abuse of power') || rawText.includes('mismanagement')) {
        return definition
      }
    }

    if (definition.key === 'sanitation' && (rawText.includes('sanitation') || rawText.includes('garbage') || rawText.includes('trash') || rawText.includes('waste') || rawText.includes('drain') || rawText.includes('sewer'))) {
      return definition
    }

    if (definition.key === 'infrastructure-issue' && (rawText.includes('infrastructure') || rawText.includes('road') || rawText.includes('pothole') || rawText.includes('bridge') || rawText.includes('drainage') || rawText.includes('repair'))) {
      return definition
    }

    if (definition.key === 'illegal-parking' && (rawText.includes('parking') || rawText.includes('parked') || rawText.includes('obstruction'))) {
      return definition
    }

    if (definition.key === 'noise-complaint' && (rawText.includes('noise') || rawText.includes('loud') || rawText.includes('karaoke') || rawText.includes('music') || rawText.includes('party'))) {
      return definition
    }
  }

  return categoryDefinitions[categoryDefinitions.length - 1]
}

function normalizePriority(row: any, category: CategoryDefinition): CanonicalPriority {
  const explicit = String(row.priority_level || row.priority || '').toLowerCase().trim()

  if (explicit === 'low' || explicit === 'medium' || explicit === 'high' || explicit === 'critical') {
    return explicit
  }

  return category.fallbackPriority
}

function extractEvidenceUrls(row: any) {
  const candidates = [row.evidence_urls, row.evidence_images, row.attachments, row.evidence_url, row.attachment_url, row.photo]
  const values: string[] = []

  candidates.forEach((candidate) => {
    if (!candidate) return
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          values.push(item.trim())
        }
      })
      return
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      values.push(candidate.trim())
    }
  })

  return Array.from(new Set(values))
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildMapEmbedUrl(report: ResidentReportRow) {
  if (report.latitude != null && report.longitude != null) {
    return `https://www.google.com/maps?q=${report.latitude},${report.longitude}&z=17&output=embed`
  }

  if (report.locationAddress) {
    return `https://www.google.com/maps?q=${encodeURIComponent(report.locationAddress)}&z=15&output=embed`
  }

  return ''
}

function truncateText(value: string, length = 120) {
  if (value.length <= length) {
    return value
  }

  return `${value.slice(0, length).trim()}...`
}

function StatCard({ title, count, subtitle, icon: Icon, gradientClass }: { title: string; count: number; subtitle: string; icon: any; gradientClass: string }) {
  return (
    <Card className={`border-0 shadow-lg ${gradientClass}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-2 text-slate-700 shadow-sm backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{count}</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          Live sync
        </div>
      </CardContent>
    </Card>
  )
}

function ActionIconButton({
  label,
  children,
  onClick,
  className,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon-sm" className={className} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function residentReportColumns(): PrintableColumn[] {
  return [
    { key: 'tracking', label: 'Report ID' },
    { key: 'resident', label: 'Resident Name' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description Preview' },
    { key: 'date', label: 'Date Submitted' },
    { key: 'priority', label: 'Priority Level' },
    { key: 'status', label: 'Status' },
    { key: 'assigned', label: 'Assigned Official' },
  ]
}

export function ResidentReportsPage() {
  const [reports, setReports] = useState<ResidentReportRow[]>([])
  const [officials, setOfficials] = useState<OfficialOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CanonicalStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | CanonicalPriority>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(8)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [notificationAlerts, setNotificationAlerts] = useState<NotificationAlert[]>([])
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [profileUser, setProfileUser] = useState<{ name: string; email: string; id: string } | null>(null)
  const [selectedReport, setSelectedReport] = useState<ResidentReportRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'overview' | 'actions' | 'activity'>('overview')
  const [statusDraft, setStatusDraft] = useState<CanonicalStatus>('pending')
  const [assignedOfficialDraft, setAssignedOfficialDraft] = useState('')
  const [adminNotesDraft, setAdminNotesDraft] = useState('')
  const [replyDraft, setReplyDraft] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  useEffect(() => {
    loadReports()
  }, [])

  useEffect(() => {
    if (!selectedReport) return
    setStatusDraft(selectedReport.status)
    setAssignedOfficialDraft(selectedReport.assignedOfficialId || '')
    setAdminNotesDraft(selectedReport.adminNotes || '')
    setReplyDraft('')
  }, [selectedReport])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, categoryFilter, priorityFilter, dateFrom, dateTo])

  async function loadReports(showSpinner = true) {
    try {
      if (showSpinner) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setLoadError('')

      if (!hasSupabaseConfig()) {
        setLoadError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setReports([])
        return
      }

      const supabase = createClient()
      const [{ data: userData }, { data: complaintRows, error: complaintError }, { data: residentsData, error: residentsError }, { data: officialsData, error: officialsError }, { data: messagesData, error: messagesError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }),
        supabase.from('residents').select('*'),
        supabase.from('officials').select('id, full_name, designation_id, designations(id, name, category, priority_order, badge_color)').order('created_at', { ascending: false }),
        supabase.from('complaint_messages').select('*').order('created_at', { ascending: true }),
      ])

      if (userData?.user) {
        const name = [userData.user.user_metadata?.first_name, userData.user.user_metadata?.last_name].filter(Boolean).join(' ').trim() || userData.user.email || 'Admin'
        setProfileUser({ name, email: userData.user.email || 'admin@lingkodbayan.local', id: userData.user.id })
      }

      if (complaintError) throw complaintError
      if (residentsError) throw residentsError
      if (officialsError) throw officialsError
      if (messagesError) throw messagesError

      const residentsById = new Map<string, ResidentRow>((residentsData || []).map((resident: any) => [resident.id, resident]))

      const officialOptions = (officialsData || []).map((official: any) => ({
        id: official.id,
        label: `${official.full_name || 'Unassigned'}${official.designations?.name ? ` • ${official.designations.name}` : ''}`,
        designationLabel: official.designations?.name || 'Official',
      }))

      setOfficials(officialOptions)

      const messagesByComplaintId = new Map<string, ComplaintMessageRow[]>()
      ;(messagesData || []).forEach((message: any) => {
        const entry = messagesByComplaintId.get(message.complaint_id) || []
        entry.push(message)
        messagesByComplaintId.set(message.complaint_id, entry)
      })

      const mappedReports = (complaintRows || []).map((row: any) => {
        const resident = row.resident_id ? residentsById.get(row.resident_id) || null : null
        const categoryDefinition = normalizeCategory(row)
        const status = normalizeStatus(row.status)
        const priority = normalizePriority(row, categoryDefinition)
        const assignedOfficial = row.assigned_official_id ? officialOptions.find((official) => official.id === row.assigned_official_id) || null : null

        return {
          id: row.id,
          trackingNumber: row.tracking_number || normalizeTrackingNumber(row.id),
          title: row.title || 'Untitled report',
          description: row.description || 'No description provided.',
          category: categoryDefinition.label,
          categoryKey: categoryDefinition.key,
          status,
          priority,
          residentId: row.resident_id,
          residentUserId: resident?.user_id || '',
          residentName: fullNameOf(resident),
          residentAddress: resident?.address || '',
          residentBarangay: resident?.barangay || '',
          residentEmail: resident?.email || '',
          residentContact: resident?.contact_number || 'N/A',
          locationAddress: row.location_address || resident?.address || resident?.barangay || 'Unknown location',
          latitude: typeof row.latitude === 'number' ? row.latitude : row.latitude ? Number(row.latitude) : null,
          longitude: typeof row.longitude === 'number' ? row.longitude : row.longitude ? Number(row.longitude) : null,
          submittedAt: row.created_at,
          assignedOfficialId: row.assigned_official_id || null,
          assignedOfficialLabel: assignedOfficial?.label || 'Unassigned',
          adminNotes: row.admin_notes || '',
          archivedAt: row.archived_at || null,
          evidenceUrls: extractEvidenceUrls(row),
          messages: messagesByComplaintId.get(row.id) || [],
        } satisfies ResidentReportRow
      })

      setReports(mappedReports)
      setLastSyncedAt(new Date())
      setIsLive(true)
    } catch (error) {
      console.error('Failed to load resident reports:', error)
      setLoadError(error instanceof Error ? error.message : 'Failed to load resident reports')
      setReports([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel('resident-reports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const trackingNumber = normalizeTrackingNumber(String(payload.new?.id || ''))
          setNotificationAlerts((current) => [{ id: String(payload.new?.id || crypto.randomUUID()), message: `New resident report received: ${trackingNumber}`, createdAt: new Date().toISOString() }, ...current].slice(0, 5))
          setUnreadAlerts((current) => current + 1)
        }

        loadReports(false)
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase()

    return reports.filter((report) => {
      const matchesSearch =
        !query ||
        report.residentName.toLowerCase().includes(query) ||
        report.category.toLowerCase().includes(query) ||
        report.trackingNumber.toLowerCase().includes(query) ||
        report.id.toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'all' || report.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || report.categoryKey === categoryFilter
      const matchesPriority = priorityFilter === 'all' || report.priority === priorityFilter
      const matchesDateRange = (() => {
        const submitted = new Date(report.submittedAt)
        if (dateFrom && submitted < new Date(dateFrom)) {
          return false
        }
        if (dateTo) {
          const end = new Date(dateTo)
          end.setHours(23, 59, 59, 999)
          if (submitted > end) {
            return false
          }
        }
        return true
      })()

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority && matchesDateRange
    })
  }, [categoryFilter, dateFrom, dateTo, priorityFilter, reports, search, statusFilter])

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredReports.slice(start, start + pageSize)
  }, [currentPage, filteredReports, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const summary = useMemo(() => {
    const totalReports = reports.length
    const pendingReports = reports.filter((report) => report.status === 'pending').length
    const resolvedReports = reports.filter((report) => report.status === 'resolved').length
    const urgentCases = reports.filter((report) => report.priority === 'high' || report.priority === 'critical').length

    return { totalReports, pendingReports, resolvedReports, urgentCases }
  }, [reports])

  const tableColumns = residentReportColumns()

  function openReport(report: ResidentReportRow, tab: 'overview' | 'actions' | 'activity' = 'overview') {
    setSelectedReport(report)
    setModalTab(tab)
    setModalOpen(true)
  }

  async function updateReport(updates: Partial<ResidentReportRow>, systemMessage?: string) {
    if (!selectedReport) return

    setSavingAction(true)
    try {
      const supabase = createClient()
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if ('status' in updates) {
        const canonicalStatus = (updates.status as CanonicalStatus) || selectedReport.status
        const dbStatus = statusToDatabaseValue[canonicalStatus]
        if (dbStatus) {
          payload.status = dbStatus
        }
      }

      if ('assignedOfficialId' in updates) {
        payload.assigned_official_id = updates.assignedOfficialId || null
      }

      if ('adminNotes' in updates) {
        payload.admin_notes = updates.adminNotes ?? ''
      }

      if ('archivedAt' in updates) {
        payload.archived_at = updates.archivedAt || null
      }

      console.log('Updating complaint', selectedReport.id, 'with payload:', payload)

      const { error, data, count } = await supabase
        .from('complaints')
        .update(payload)
        .eq('id', selectedReport.id)
        .select()

      if (error) {
        console.error('Supabase update error:', error)
        throw new Error(error.message || 'Database update failed')
      }

      if (!data || data.length === 0) {
        console.warn('Update returned no rows – possible RLS policy blocking the update')
        throw new Error('Update was blocked. You may not have permission to update this report. Please check that your admin account has the correct role in the database.')
      }

      if (systemMessage && profileUser) {
        const { error: msgError } = await supabase.from('complaint_messages').insert([
          {
            complaint_id: selectedReport.id,
            recipient_user_id: selectedReport.residentUserId || profileUser.id,
            sender_id: profileUser.id,
            message: systemMessage,
            message_type: 'system',
            is_read: false,
          },
        ])
        if (msgError) {
          console.warn('System message insert failed (non-blocking):', msgError.message)
        }
      }

      await loadReports(false)
    } catch (error) {
      console.error('Failed to update report:', error)
      alert(error instanceof Error ? error.message : 'Failed to update report')
    } finally {
      setSavingAction(false)
    }
  }

  async function sendReply() {
    if (!selectedReport || !replyDraft.trim()) return

    if (!profileUser?.id) {
      alert('Unable to identify your admin account. Please refresh the page and try again.')
      return
    }

    const recipientId = selectedReport.residentUserId || null

    if (!recipientId) {
      alert('Unable to find the resident account linked to this report. The resident may not have a verified account yet.')
      return
    }

    setSavingAction(true)
    try {
      const supabase = createClient()

      console.log('Sending reply to complaint', selectedReport.id, {
        recipient_user_id: recipientId,
        sender_id: profileUser.id,
      })

      const { error } = await supabase.from('complaint_messages').insert([
        {
          complaint_id: selectedReport.id,
          recipient_user_id: recipientId,
          sender_id: profileUser.id,
          message: replyDraft.trim(),
          message_type: 'reply',
          is_read: false,
        },
      ])

      if (error) {
        console.error('Supabase insert error:', error)
        throw new Error(error.message || 'Database insert failed')
      }

      setReplyDraft('')
      await loadReports(false)
    } catch (error) {
      console.error('Failed to reply to report:', error)
      alert(error instanceof Error ? error.message : 'Failed to send reply')
    } finally {
      setSavingAction(false)
    }
  }

  async function archiveReport(report: ResidentReportRow) {
    const confirmed = window.confirm(`Archive ${report.trackingNumber}? This will mark the report as rejected and store it in the archive log.`)
    if (!confirmed) return

    setSelectedReport(report)
    await updateReport({ status: 'rejected', archivedAt: new Date().toISOString() }, `Report archived: ${report.trackingNumber}`)
  }

  function exportCsv() {
    const rows = filteredReports.map((report) => [
      report.trackingNumber,
      report.residentName,
      report.category,
      truncateText(report.description, 90),
      getReportDateLabel(report.submittedAt),
      priorityDefinitions[report.priority].label,
      statusDefinitions[report.status].label,
      report.assignedOfficialLabel,
    ])

    downloadCsvFile(`resident-reports-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(rows, tableColumns))
  }

  function exportPdf() {
    openPrintableReport({
      barangayName: 'LingkodBayan Barangay',
      reportTitle: 'Resident Reports',
      dateRangeLabel: dateFrom || dateTo ? `${dateFrom || '...'} to ${dateTo || '...'}` : 'All dates',
      columns: tableColumns,
      rows: filteredReports.map((report) => [
        report.trackingNumber,
        report.residentName,
        report.category,
        truncateText(report.description, 90),
        getReportDateLabel(report.submittedAt),
        priorityDefinitions[report.priority].label,
        statusDefinitions[report.status].label,
        report.assignedOfficialLabel,
      ]),
      subtitle: 'Resident-submitted reports and complaints',
    })
  }

  function printReports() {
    exportPdf()
  }

  const selectedReportTimeline = selectedReport?.messages || []

  return (
    <div className="space-y-8 bg-linear-to-br from-emerald-50 via-white to-lime-50 min-h-screen p-8">
      {loadError && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">Resident reports unavailable</CardTitle>
            <CardDescription className="text-amber-800">{loadError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>Recent resident report alerts and refresh events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {notificationAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No new alerts yet.</p>
            ) : (
              notificationAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
                  <p className="font-medium text-emerald-900">{alert.message}</p>
                  <p className="text-xs text-emerald-700">{formatDateTime(alert.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,84rem)] overflow-y-auto sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl">
              {selectedReport?.trackingNumber || 'Resident Report'}
              {selectedReport && <Badge className={statusDefinitions[selectedReport.status].badgeClass}>{statusDefinitions[selectedReport.status].label}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.title || 'Report details, admin actions, evidence, and history logs.'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <Tabs value={modalTab} onValueChange={(value) => setModalTab(value as 'overview' | 'actions' | 'activity')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="actions">Admin Actions</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="min-w-0 space-y-4">
                    <Card className="border-emerald-100">
                      <CardHeader>
                        <CardTitle>Resident Information</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Full Name</Label>
                          <p className="font-semibold">{selectedReport.residentName}</p>
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Resident ID</Label>
                          <p className="font-semibold">{selectedReport.residentId}</p>
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Contact Number</Label>
                          <p className="font-semibold">{selectedReport.residentContact}</p>
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Address</Label>
                          <p className="font-semibold">{selectedReport.residentAddress || selectedReport.residentBarangay || 'N/A'}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-100">
                      <CardHeader>
                        <CardTitle>Report Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Tracking Number</Label>
                            <p className="font-semibold">{selectedReport.trackingNumber}</p>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Date Submitted</Label>
                            <p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Incident Location</Label>
                            <p className="font-semibold">{selectedReport.locationAddress}</p>
                          </div>
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Assigned Official</Label>
                            <p className="font-semibold">{selectedReport.assignedOfficialLabel}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4">
                          <p className="text-sm font-semibold text-foreground">Full Complaint Description</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedReport.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <Card className="border-emerald-100">
                      <CardHeader>
                        <CardTitle>Evidence Images</CardTitle>
                        <CardDescription>Preview any attached images or available evidence links.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {selectedReport.evidenceUrls.length === 0 ? (
                          <Empty title="No evidence uploaded" description="The resident did not attach any previewable images for this report." />
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            {selectedReport.evidenceUrls.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                <img src={url} alt="Evidence preview" className="h-40 w-full object-cover transition-transform group-hover:scale-105" />
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-100">
                      <CardHeader>
                        <CardTitle>Location Map Preview</CardTitle>
                        <CardDescription>{selectedReport.locationAddress}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {buildMapEmbedUrl(selectedReport) ? (
                          <iframe
                            title="Report location preview"
                            src={buildMapEmbedUrl(selectedReport)}
                            className="h-64 w-full rounded-2xl border border-slate-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
                            No map coordinates available for this report.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="mt-6 space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="min-w-0 border-emerald-100">
                    <CardHeader>
                      <CardTitle>Admin Controls</CardTitle>
                      <CardDescription>Change the report status, assign an official, and save internal notes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as CanonicalStatus)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Change status" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusDefinitions).map(([key, definition]) => (
                                <SelectItem key={key} value={key}>
                                  {definition.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Assign Barangay Official</Label>
                          <Select
                            value={assignedOfficialDraft || unassignedOfficialValue}
                            onValueChange={(value) => setAssignedOfficialDraft(value === unassignedOfficialValue ? '' : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select official" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={unassignedOfficialValue}>Unassigned</SelectItem>
                              {officials.map((official) => (
                                <SelectItem key={official.id} value={official.id}>
                                  {official.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin-notes">Admin Notes</Label>
                        <Textarea
                          id="admin-notes"
                          value={adminNotesDraft}
                          onChange={(event) => setAdminNotesDraft(event.target.value)}
                          placeholder="Add private notes for the handling team..."
                          className="min-h-32"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => updateReport({ status: statusDraft, assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, `Admin updated the report status to ${statusDefinitions[statusDraft].label}.`)} disabled={savingAction}>
                          {savingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => updateReport({ archivedAt: new Date().toISOString(), status: 'rejected' }, `Report archived: ${selectedReport.trackingNumber}`)} disabled={savingAction}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive Report
                        </Button>
                        <Button variant="outline" onClick={exportPdf}>
                          <FileDown className="mr-2 h-4 w-4" />
                          Generate PDF Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="min-w-0 border-emerald-100">
                    <CardHeader>
                      <CardTitle>Send Response to Resident</CardTitle>
                      <CardDescription>Use this box to reply directly to the resident.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Type your response to the resident..."
                        className="min-h-48"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={sendReply} disabled={savingAction || !replyDraft.trim()}>
                          {savingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Send Response
                        </Button>
                        <Button variant="outline" onClick={() => setReplyDraft('')}>
                          Clear
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-6 space-y-6">
                <Card className="border-emerald-100">
                  <CardHeader>
                    <CardTitle>Timeline / History Logs</CardTitle>
                    <CardDescription>Review every update, reply, and internal action made for this report.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedReportTimeline.length === 0 ? (
                      <Empty title="No history yet" description="System updates and admin replies will appear here." />
                    ) : (
                      selectedReportTimeline.map((message) => (
                        <div key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                              {message.message_type === 'reply' ? <MessageSquareReply className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold capitalize">{message.message_type || 'system'}</p>
                                <Badge variant="outline">{formatDateTime(message.created_at)}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{message.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-emerald-100">
                  <CardHeader>
                    <CardTitle>Admin Activity Log</CardTitle>
                    <CardDescription>Latest activity is pulled from the same history stream for consistency.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {selectedReportTimeline.slice(-6).reverse().map((message) => (
                        <div key={message.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">{message.message_type || 'system'}</p>
                          <p className="mt-1 text-sm text-slate-600">{truncateText(message.message, 84)}</p>
                          <p className="mt-2 text-xs text-slate-500">{formatDateTime(message.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6 rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(16,185,129,0.12)] backdrop-blur xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <FileText className="h-3.5 w-3.5" />
            Resident Reports
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Resident Reports</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Monitor and manage resident-submitted reports and complaints.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${isLive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : isLive ? 'Realtime connected' : 'Syncing data'}
          </div>
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => loadReports(false)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Bell className="h-4 w-4" />
                {unreadAlerts > 0 && <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadAlerts}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notificationAlerts.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">No recent alerts.</div>
              ) : (
                notificationAlerts.map((alert) => (
                  <DropdownMenuItem key={alert.id} className="flex flex-col items-start gap-1 py-2" onSelect={() => setUnreadAlerts(0)}>
                    <span className="font-medium">{alert.message}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-emerald-200 bg-white text-slate-700 hover:bg-slate-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-emerald-600 text-white">{(profileUser?.name || 'AD').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-semibold">{profileUser?.name || 'Admin Profile'}</div>
                  <div className="text-xs text-muted-foreground">{profileUser?.email || 'Administrator'}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Admin Profile</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 text-sm">
                <p className="font-semibold">{profileUser?.name || 'Admin'}</p>
                <p className="text-muted-foreground">{profileUser?.email || 'No email available'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => loadReports(false)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh reports
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Reports" count={summary.totalReports} subtitle="All resident reports in the queue" icon={FileText} gradientClass="bg-gradient-to-br from-emerald-100 via-white to-lime-100" />
        <StatCard title="Pending Reports" count={summary.pendingReports} subtitle="Need immediate attention" icon={Clock3} gradientClass="bg-gradient-to-br from-amber-100 via-white to-yellow-100" />
        <StatCard title="Resolved Reports" count={summary.resolvedReports} subtitle="Cases already closed" icon={CheckCircle2} gradientClass="bg-gradient-to-br from-emerald-100 via-white to-teal-100" />
        <StatCard title="Urgent Cases" count={summary.urgentCases} subtitle="High and critical priority reports" icon={TriangleAlert} gradientClass="bg-gradient-to-br from-rose-100 via-white to-orange-100" />
      </div>

      <Card className="border-emerald-100 bg-white shadow-sm">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_0.7fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resident name, category, or report ID…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | CanonicalStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusDefinitions).map(([key, definition]) => (
                <SelectItem key={key} value={key}>
                  {definition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryDefinitions.map((definition) => (
                <SelectItem key={definition.key} value={definition.key}>
                  {definition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | CanonicalPriority)}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {Object.entries(priorityDefinitions).map(([key, definition]) => (
                <SelectItem key={key} value={key}>
                  {definition.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Reports Table</CardTitle>
            <CardDescription>
              {filteredReports.length} filtered report{filteredReports.length === 1 ? '' : 's'} visible out of {reports.length} total.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={printReports}>
              <Printer className="mr-2 h-4 w-4" />
              Print Reports
            </Button>
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={exportPdf}>
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading resident reports...</div>
          ) : filteredReports.length === 0 ? (
            <Empty title="No matching reports" description="Try changing the search text, date range, or filter dropdowns." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-emerald-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReports.map((report) => {
                    const priority = priorityDefinitions[report.priority]
                    const status = statusDefinitions[report.status]
                    const category = categoryDefinitions.find((definition) => definition.key === report.categoryKey) || categoryDefinitions[categoryDefinitions.length - 1]
                    const PriorityIcon = priority.icon || GripVertical

                    return (
                      <TableRow key={report.id} className={report.priority === 'critical' ? 'bg-rose-50/40' : ''}>
                        <TableCell className="font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {report.trackingNumber}
                            {report.priority === 'critical' && <TriangleAlert className="h-4 w-4 text-rose-700" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{report.residentName}</div>
                          <div className="text-xs text-muted-foreground">{report.residentBarangay || report.residentAddress || 'Resident profile'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={category.badgeClass}>{category.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span title={report.description}>{truncateText(report.description, 80)}</span>
                        </TableCell>
                        <TableCell>{getReportDateLabel(report.submittedAt)}</TableCell>
                        <TableCell>
                          <Badge className={priority.badgeClass}>
                            {priority.icon ? <PriorityIcon className="mr-1 h-3.5 w-3.5" /> : null}
                            {priority.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.badgeClass}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{report.assignedOfficialLabel}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <ActionIconButton label="View Details" onClick={() => openReport(report, 'overview')}>
                              <Eye className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton label="Assign Official" onClick={() => openReport(report, 'actions')}>
                              <UserPlus className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton label="Update Status" onClick={() => openReport(report, 'actions')}>
                              <RefreshCw className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton label="Reply to Resident" onClick={() => openReport(report, 'actions')}>
                              <MessageSquareReply className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton label="Archive Report" onClick={() => archiveReport(report)} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                              <Archive className="h-4 w-4" />
                            </ActionIconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedReports.length} of {filteredReports.length} filtered reports
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            Page {currentPage} of {totalPages}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Last refreshed {lastSyncedAt ? formatDateTime(lastSyncedAt.toISOString()) : 'just now'}
        </div>
      </div>
    </div>
  )
}

export default ResidentReportsPage