'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyMedia } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Archive,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  MapPinned,
  MessageSquareReply,
  MoreHorizontal,
  Printer,
  RefreshCcw,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import {
  buildCsv,
  downloadCsvFile,
  getReportDateLabel,
  getReportDateTimeLabel,
  openPrintableReport,
  type PrintableColumn,
} from '@/lib/admin-reporting'
import { complaintCategories, complaintCategoryKeywords, complaintCategoryBadgeClasses, complaintCategoryFallbackPriorities, type ComplaintCategory, analyzeComplaintPriority } from '@/lib/complaint-categories'
import { logAdminActionClient } from '@/lib/audit-log-client'
import { canTransitionComplaint, getAllowedComplaintTransitions } from '@/lib/status-machine'
import { computeOfficialWorkloads, planEvenDistribution, suggestAssignee } from '@/lib/workload'

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
  name: string
  label: string
  designationLabel: string
  status?: string | null
}

type OfficialRow = {
  id: string
  full_name?: string | null
  designation_id?: string | null
  status?: string | null
  designations?: {
    name?: string | null
  } | null
}

type RealtimeReportPayload = {
  eventType: string
  new?: {
    id?: unknown
  } | null
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
  categoryBadgeClass: string
  status: CanonicalStatus
  priority: CanonicalPriority
  priorityConfidence: number
  priorityReasons: string[]
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

type ServiceCategory = {
  id: string
  slug: string
  title: string
  description: string | null
  is_active: boolean
}

type CategoryDefinition = {
  key: string
  label: string
  badgeClass: string
  keywords: string[]
  fallbackPriority: CanonicalPriority
}

/**
 * Status badge recipes.
 *
 * Light-theme tints are unchanged; every entry now appends a dark-theme
 * counterpart built from the same hue at low alpha so the four lifecycle
 * states stay instantly recognisable on the layered dark surfaces.
 */
const statusDefinitions: Record<CanonicalStatus, { label: string; badgeClass: string; rawValues: string[] }> = {
  pending: {
    label: 'Pending',
    badgeClass:
      'rounded-full border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300',
    rawValues: ['pending', 'open'],
  },
  under_review: {
    label: 'Under Review',
    badgeClass:
      'rounded-full border-blue-200 bg-blue-50 text-blue-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300',
    rawValues: ['under_review', 'under-investigation', 'under_investigation', 'processing', 'in-progress'],
  },
  resolved: {
    label: 'Resolved',
    badgeClass:
      'rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300',
    rawValues: ['resolved'],
  },
  rejected: {
    label: 'Rejected',
    badgeClass:
      'rounded-full border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300',
    rawValues: ['rejected', 'dismissed'],
  },
}

/**
 * Priority badge recipes — a warm ramp (slate -> orange -> red -> rose) that
 * keeps escalating urgency legible in both themes.
 */
const priorityDefinitions: Record<CanonicalPriority, { label: string; badgeClass: string; icon?: typeof TriangleAlert }> = {
  low: {
    label: 'Low',
    badgeClass:
      'rounded-full border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300',
  },
  medium: {
    label: 'Medium',
    badgeClass:
      'rounded-full border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300',
  },
  high: {
    label: 'High',
    badgeClass:
      'rounded-full border-red-200 bg-red-50 text-red-700 dark:border-red-400/35 dark:bg-red-400/10 dark:text-red-300',
  },
  critical: {
    label: 'Critical',
    badgeClass:
      'rounded-full border-red-900 bg-red-950 text-white dark:border-rose-400/50 dark:bg-rose-500/20 dark:text-rose-200',
    icon: TriangleAlert,
  },
}

/**
 * Quick-filter chip styling. Active chips use a controlled accent instead of
 * the hard `--primary` fill so the dark theme never flashes pure white.
 */
const activeChipClass =
  'border border-transparent bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30 dark:hover:bg-emerald-500/30 dark:hover:text-emerald-100'
const activeUrgentChipClass =
  'border border-transparent bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/35 dark:hover:bg-rose-500/30 dark:hover:text-rose-100'
const idleChipClass =
  'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-border dark:bg-transparent dark:text-muted-foreground dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200'

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

function normalizeCategory(row: any, dynamicCategories: ServiceCategory[]): CategoryDefinition {
  const rawCategory = (row.category || '').toLowerCase().trim()
  const rawText = `${row.title || ''} ${row.description || ''}`.toLowerCase()

  for (const cat of dynamicCategories) {
    if (cat.slug.toLowerCase() === rawCategory || cat.title.toLowerCase() === rawCategory) {
      const fallbackPriority = complaintCategoryFallbackPriorities[cat.title as ComplaintCategory] || 'low'
      const keywords = complaintCategoryKeywords[cat.title as ComplaintCategory] || []
      const badgeClass = complaintCategoryBadgeClasses[cat.title as ComplaintCategory] || ''
      return {
        key: cat.slug,
        label: cat.title,
        badgeClass,
        keywords,
        fallbackPriority,
      }
    }
  }

  for (const cat of dynamicCategories) {
    if (cat.title === 'Other Concerns') {
      continue
    }

    const keywords = complaintCategoryKeywords[cat.title as ComplaintCategory] || []
    if (keywords.some((kw) => rawText.includes(kw))) {
      const fallbackPriority = complaintCategoryFallbackPriorities[cat.title as ComplaintCategory] || 'low'
      const badgeClass = complaintCategoryBadgeClasses[cat.title as ComplaintCategory] || ''
      return {
        key: cat.slug,
        label: cat.title,
        badgeClass,
        keywords,
        fallbackPriority,
      }
    }
  }

  const defaultCat = dynamicCategories.find((c) => c.title === 'Other Concerns') || { slug: 'other-concerns', title: 'Other Concerns', description: null, is_active: true }
  return {
    key: defaultCat.slug,
    label: defaultCat.title,
    badgeClass: complaintCategoryBadgeClasses['Other Concerns'],
    keywords: [],
    fallbackPriority: 'low',
  }
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
  return formatDate(value, { month: 'short', day: 'numeric', year: 'numeric' })
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

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateTime(value)
}

function truncateText(value: string, length = 120) {
  if (value.length <= length) {
    return value
  }

  return `${value.slice(0, length).trim()}...`
}

function residentReportColumns(): PrintableColumn[] {
  return [
    { key: 'tracking', label: 'Report ID' },
    { key: 'resident', label: 'Resident Name' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description Preview' },
    { key: 'date', label: 'Date Submitted' },
    { key: 'statusInfo', label: 'Status Info' },
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
  const [archiveTarget, setArchiveTarget] = useState<ResidentReportRow | null>(null)
  const [savingAction, setSavingAction] = useState(false)
  const [dynamicCategories, setDynamicCategories] = useState<ServiceCategory[]>([])

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
      const [{ data: userData, error: userError }, { data: categoriesData, error: categoriesError }, { data: complaintRows, error: complaintError }, { data: residentsData, error: residentsError }, { data: officialsData, error: officialsError }, { data: messagesData, error: messagesError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('service_categories').select('id, slug, title, description, is_active').eq('category_type', 'incident').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }),
        supabase.from('residents').select('*'),
        supabase.from('officials').select('id, full_name, status, designation_id, designations(id, name, category, priority_order, badge_color)').order('created_at', { ascending: false }),
        supabase.from('complaint_messages').select('*').order('created_at', { ascending: true }),
      ])

      if (userData?.user) {
        const name = [userData.user.user_metadata?.first_name, userData.user.user_metadata?.last_name].filter(Boolean).join(' ').trim() || userData.user.email || 'Admin'
        setProfileUser({ name, email: userData.user.email || 'admin@lingkodbayan.local', id: userData.user.id })
      }

      if (userError) throw userError
      if (categoriesError) throw categoriesError
      if (complaintError) throw complaintError
      if (residentsError) throw residentsError
      if (officialsError) throw officialsError
      if (messagesError) throw messagesError

      const residentsById = new Map<string, ResidentRow>((residentsData || []).map((resident: any) => [resident.id, resident]))

      const officialOptions = (officialsData || []).map((official: OfficialRow) => ({
        id: official.id,
        name: official.full_name || 'Official',
        label: `${official.full_name || 'Unassigned'}${official.designations?.name ? ` • ${official.designations.name}` : ''}`,
        designationLabel: official.designations?.name || 'Official',
        status: official.status,
      }))

      setOfficials(officialOptions)

      const currentCategories = (categoriesData || []) as ServiceCategory[]
      setDynamicCategories(currentCategories)

      const messagesByComplaintId = new Map<string, ComplaintMessageRow[]>()
      ;(messagesData || []).forEach((message: ComplaintMessageRow) => {
        const complaintId = String(message.complaint_id)
        const entry = messagesByComplaintId.get(complaintId) || []
        entry.push(message)
        messagesByComplaintId.set(complaintId, entry)
      })

      const mappedReports = (complaintRows || []).map((row: any) => {
        const resident = row.resident_id ? residentsById.get(row.resident_id) || null : null
        const categoryDefinition = normalizeCategory(row, currentCategories)
        const status = normalizeStatus(row.status)
        const explicitPriority = String(row.priority_level || row.priority || '').toLowerCase().trim()
        const analysis = explicitPriority && ['low', 'medium', 'high', 'critical'].includes(explicitPriority)
          ? null
          : analyzeComplaintPriority(row.title || '', row.description || '', categoryDefinition.fallbackPriority)
        const priority = analysis?.priority || (explicitPriority as CanonicalPriority) || categoryDefinition.fallbackPriority
        const priorityConfidence = analysis?.confidence ?? 1.0
        const priorityReasons = analysis?.reasons ?? ['Explicit priority set']
        const assignedOfficial = row.assigned_official_id ? officialOptions.find((official: OfficialOption) => official.id === row.assigned_official_id) || null : null

        return {
          id: row.id,
          trackingNumber: row.tracking_number || normalizeTrackingNumber(row.id),
          title: row.title || 'Untitled report',
          description: row.description || 'No description provided.',
          category: categoryDefinition.label,
          categoryKey: categoryDefinition.key,
          status,
          priority,
          priorityConfidence,
          priorityReasons,
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
           categoryBadgeClass: categoryDefinition.badgeClass,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload: RealtimeReportPayload) => {
        if (payload.eventType === 'INSERT') {
          const reportId = String(payload.new?.id || '')
          const trackingNumber = normalizeTrackingNumber(reportId)
          setNotificationAlerts((current) => [{ id: reportId || crypto.randomUUID(), message: `New resident report received: ${trackingNumber}`, createdAt: new Date().toISOString() }, ...current].slice(0, 5))
          setUnreadAlerts((current) => current + 1)
        }

        loadReports(false)
      })
      .subscribe((status: string) => {
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

  // Priority-weighted workload per official, recomputed whenever the report
  // list or official roster changes. Drives the auto-assign suggestions.
  const officialWorkloads = useMemo(() => computeOfficialWorkloads(
    officials.map((official) => ({
      id: official.id,
      name: official.name,
      designationLabel: official.designationLabel,
      status: official.status,
    })),
    reports.map((report) => ({
      assignedOfficialId: report.assignedOfficialId,
      status: report.status,
      priority: report.priority,
      archivedAt: report.archivedAt,
    })),
  ), [officials, reports])

  /** Suggest the least-loaded active official for the currently open report. */
  function autoAssignSelected() {
    if (!selectedReport) return

    const suggestion = suggestAssignee(officialWorkloads, {
      excludeIds: selectedReport.assignedOfficialId ? [selectedReport.assignedOfficialId] : [],
    })
    if (!suggestion) {
      toast.error('No active official is available for assignment.')
      return
    }

    setAssignedOfficialDraft(suggestion.officialId)
    toast.info(`Suggested: ${suggestion.name} (${suggestion.activeTotal} active case${suggestion.activeTotal === 1 ? '' : 's'}). Click Save Changes to apply.`)
  }

  /** Distribute every unassigned report evenly across active officials. */
  async function autoAssignUnassigned() {
    if (!hasSupabaseConfig()) {
      toast.error('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
      return
    }

    const unassigned = reports.filter((report) => !report.assignedOfficialId && !report.archivedAt)
    if (unassigned.length === 0) {
      toast.info('Every report already has an assigned official.')
      return
    }

    const plan = planEvenDistribution(
      unassigned.map((report) => ({ id: report.id, priority: report.priority })),
      officialWorkloads,
    )
    if (plan.length === 0) {
      toast.error('No active official is available for assignment.')
      return
    }

    setSavingAction(true)
    try {
      const supabase = createClient()
      const reportsById = new Map(reports.map((report) => [report.id, report]))
      let assignedCount = 0

      for (const entry of plan) {
        const { error } = await supabase
          .from('complaints')
          .update({ assigned_official_id: entry.officialId, updated_at: new Date().toISOString() })
          .eq('id', entry.itemId)

        if (error) {
          toast.error(`Auto-assign stopped: ${error.message}`)
          break
        }

        assignedCount += 1
        const report = reportsById.get(entry.itemId)
        void logAdminActionClient({
          action: 'complaint_updated',
          resourceType: 'complaint',
          resourceId: entry.itemId,
          oldValues: { assigned_official_id: null },
          newValues: { assigned_official_id: entry.officialId },
        })

        if (report?.residentUserId && profileUser?.id) {
          await supabase.from('complaint_messages').insert([
            {
              complaint_id: entry.itemId,
              recipient_user_id: report.residentUserId,
              sender_id: profileUser.id,
              message: `Your report has been assigned to ${entry.officialName}.`,
              message_type: 'system',
              is_read: false,
            },
          ])
        }
      }

      await loadReports(false)
      if (assignedCount > 0) {
        toast.success(`Auto-assigned ${assignedCount} report${assignedCount === 1 ? '' : 's'} across the least-loaded officials.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to auto-assign reports')
    } finally {
      setSavingAction(false)
    }
  }

  function openReport(report: ResidentReportRow, tab: 'overview' | 'actions' | 'activity' = 'overview') {
    setSelectedReport(report)
    setModalTab(tab)
    setModalOpen(true)
  }

  async function updateReport(report: ResidentReportRow, updates: Partial<ResidentReportRow>, systemMessage?: string): Promise<boolean> {
    setSavingAction(true)
    try {
      if (!hasSupabaseConfig()) {
        toast.error('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        return false
      }

      const supabase = createClient()
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if ('status' in updates) {
        const canonicalStatus = updates.status || report.status
        const dbStatus = statusToDatabaseValue[canonicalStatus]
        if (dbStatus) {
          // Enforce the complaint status finite state machine before writing
          const currentDbStatus = statusToDatabaseValue[report.status]
          if (dbStatus !== currentDbStatus && !canTransitionComplaint(currentDbStatus, dbStatus)) {
            toast.error(`That status change is not allowed while the report is ${statusDefinitions[report.status].label}.`)
            return false
          }
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

      const { error, data } = await supabase
        .from('complaints')
        .update(payload)
        .eq('id', report.id)
        .select()

      if (error) {
        toast.error(error.message || 'Database update failed')
        return false
      }

      if (!data || data.length === 0) {
        toast.error('Update was blocked. You may not have permission to update this report. Please check that your admin account has the correct role in the database.')
        return false
      }

      const changedValues = Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== 'updated_at'),
      )

      void logAdminActionClient({
        action: 'complaint_updated',
        resourceType: 'complaint',
        resourceId: report.id,
        oldValues: { status: report.status },
        newValues: Object.keys(changedValues).length > 0 ? changedValues : undefined,
      })

      if (systemMessage && profileUser?.id && report.residentUserId) {
        const { error: msgError } = await supabase.from('complaint_messages').insert([
          {
            complaint_id: report.id,
            recipient_user_id: report.residentUserId,
            sender_id: profileUser.id,
            message: systemMessage,
            message_type: 'system',
            is_read: false,
          },
        ])
        if (msgError) {
          toast.error(`Changes saved, but the activity message could not be recorded: ${msgError.message}`)
        }
      }

      await loadReports(false)
      toast.success('Changes saved successfully')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update report')
      return false
    } finally {
      setSavingAction(false)
    }
  }

  async function sendReply() {
    if (!selectedReport || !replyDraft.trim()) return

    if (!profileUser?.id) {
      toast.error('Unable to identify your admin account. Please refresh the page and try again.')
      return
    }

    const recipientId = selectedReport.residentUserId || null

    if (!recipientId) {
      toast.error('Unable to find the resident account linked to this report. The resident may not have a verified account yet.')
      return
    }

    setSavingAction(true)
    try {
      const supabase = createClient()

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

      toast.success('Response sent successfully')
      setReplyDraft('')
      await loadReports(false)
    } catch (error) {
      console.error('Failed to reply to report:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send reply')
    } finally {
      setSavingAction(false)
    }
  }

  async function archiveReport(report: ResidentReportRow) {
    setArchiveTarget(report)
  }

  async function confirmArchive() {
    if (!archiveTarget) return

    await updateReport(
      archiveTarget,
      { status: 'rejected', archivedAt: new Date().toISOString() },
      `Report archived: ${archiveTarget.trackingNumber}`
    )
    setArchiveTarget(null)
  }

  function exportCsv() {
    const rows = filteredReports.map((report) => [
      report.trackingNumber,
      report.residentName,
      report.category,
      truncateText(report.description, 90),
      getReportDateLabel(report.submittedAt),
      `${priorityDefinitions[report.priority].label} / ${statusDefinitions[report.status].label}`,
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
        `${priorityDefinitions[report.priority].label} / ${statusDefinitions[report.status].label}`,
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
    <div className="min-h-screen space-y-6 bg-linear-to-br from-emerald-50 via-white to-lime-50 p-4 sm:space-y-8 sm:p-6 lg:p-8 dark:from-emerald-950/25 dark:via-background dark:to-sky-950/20">
      {loadError && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:shadow-none">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-200">Resident reports unavailable</CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-300/90">{loadError}</CardDescription>
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
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No new alerts yet.</p>
              </div>
            ) : (
              notificationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-400/25 dark:bg-emerald-400/10"
                >
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">{alert.message}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300/80">{formatDateTime(alert.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,60rem)] overflow-y-auto dark:border-border dark:bg-popover sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl">
              {selectedReport?.trackingNumber || 'Resident Report'}
              {selectedReport && <Badge className={statusDefinitions[selectedReport.status].badgeClass}>{statusDefinitions[selectedReport.status].label}</Badge>}
              {selectedReport && (
                <Badge className={priorityDefinitions[selectedReport.priority].badgeClass} variant="secondary">
                  {priorityDefinitions[selectedReport.priority].label}
                  {selectedReport.priorityConfidence < 1 && ` (${Math.round(selectedReport.priorityConfidence * 100)}% confidence)`}
                </Badge>
              )}
{selectedReport && (
                 <Badge className={selectedReport.categoryBadgeClass}>
                   {selectedReport.category}
                 </Badge>
               )}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.title || 'Report details, admin actions, evidence, and history logs.'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <Tabs value={modalTab} onValueChange={(value) => setModalTab(value as 'overview' | 'actions' | 'activity')}>
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 dark:bg-background/80 sm:h-9">
                <TabsTrigger value="overview" className="h-8 px-2 text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="actions" className="h-8 px-2 text-xs sm:text-sm">Admin Actions</TabsTrigger>
                <TabsTrigger value="activity" className="h-8 px-2 text-xs sm:text-sm">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <Card className={`border-emerald-100 dark:border-border ${selectedReport.priority === 'critical' ? 'border-l-4 border-l-rose-600' : selectedReport.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}>
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

                  <Card className="border-emerald-100 dark:border-border">
                    <CardHeader>
                      <CardTitle>Report Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
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
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-400/25 dark:bg-emerald-400/[0.07]">
                        <p className="text-sm font-semibold text-foreground">Full Complaint Description</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{selectedReport.description}</p>
                      </div>
                      {selectedReport.priorityReasons && selectedReport.priorityReasons.length > 0 && (
                        <div className="text-xs text-slate-500 dark:text-muted-foreground">
                          <span className="font-medium">Priority reasons:</span> {selectedReport.priorityReasons.join(', ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedReport.evidenceUrls.length > 0 && (
                    <Card className="border-emerald-100 dark:border-border">
                      <CardHeader>
                        <CardTitle>Evidence Images</CardTitle>
                        <CardDescription>Preview any attached images or available evidence links.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {selectedReport.evidenceUrls.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-border dark:bg-muted/50"
                            >
                              <img src={url} alt="Evidence preview" className="h-40 w-full object-cover transition-transform group-hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-emerald-100 dark:border-border">
                    <CardHeader>
                      <CardTitle>Location Map Preview</CardTitle>
                      <CardDescription>{selectedReport.locationAddress}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {buildMapEmbedUrl(selectedReport) ? (
                        <iframe
                          title="Report location preview"
                          src={buildMapEmbedUrl(selectedReport)}
                          className="h-64 w-full rounded-2xl border border-slate-200 dark:border-border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground dark:border-border dark:bg-muted/40">
                          No map coordinates available for this report.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="mt-6 space-y-6">
                <Card className="border-emerald-100 dark:border-border">
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
                            {Object.entries(statusDefinitions).map(([key, definition]) => {
                              // Only offer statuses the complaint state machine allows from the current state
                              const dbValue = statusToDatabaseValue[key as CanonicalStatus]
                              const isAllowed =
                                key === selectedReport.status ||
                                getAllowedComplaintTransitions(selectedReport.status).some((transition) => transition.to === dbValue)

                              return (
                                <SelectItem key={key} value={key} disabled={!isAllowed}>
                                  {definition.label}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {selectedReport.status !== 'resolved' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200" onClick={() => { setStatusDraft('resolved'); updateReport(selectedReport, { status: 'resolved', assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, 'Marked as resolved.') }} disabled={savingAction}>
                              Mark Resolved
                            </Button>
                          )}
                          {selectedReport.status === 'resolved' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground" onClick={() => { setStatusDraft('under_review'); updateReport(selectedReport, { status: 'under_review', assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, 'Report reopened.') }} disabled={savingAction}>
                              Unresolve
                            </Button>
                          )}
                        </div>
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
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200" onClick={autoAssignSelected} disabled={savingAction}>
                          <Scale className="mr-1 h-3.5 w-3.5" />
                          Auto-assign least loaded
                        </Button>
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
                      <Button className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400" onClick={() => updateReport(selectedReport, { status: statusDraft, assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, `Admin updated the report status to ${statusDefinitions[statusDraft].label}.`)} disabled={savingAction}>
                        {savingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" className="dark:border-border dark:text-foreground dark:hover:bg-muted" onClick={() => updateReport(selectedReport, { archivedAt: new Date().toISOString(), status: 'rejected' }, `Report archived: ${selectedReport.trackingNumber}`)} disabled={savingAction}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Report
                      </Button>
                      <Button variant="ghost" size="sm" onClick={exportPdf} disabled={savingAction}>
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-100 dark:border-border">
                  <CardHeader>
                    <CardTitle>Send Response to Resident</CardTitle>
                    <CardDescription>Use this box to reply directly to the resident.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Type your response to the resident..."
                        className="min-h-48"
                      />
                      <div className="text-xs text-slate-500 dark:text-muted-foreground">{replyDraft.length} characters</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-sky-500 dark:text-sky-950 dark:hover:bg-sky-400" onClick={sendReply} disabled={savingAction || !replyDraft.trim()}>
                        {savingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send Response
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setReplyDraft('')} disabled={savingAction || !replyDraft.trim()}>
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="mt-6 space-y-6">
                <Card className="border-emerald-100 dark:border-border">
                  <CardHeader className="sticky top-0 z-10 border-b border-emerald-100 bg-white dark:border-border dark:bg-card">
                    <CardTitle>Timeline / History Logs</CardTitle>
                    <CardDescription>Review every update, reply, and internal action made for this report.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {selectedReportTimeline.length === 0 ? (
                      <Empty
                        title="No history yet"
                        description="System updates and admin replies will appear here."
                        className="border border-dashed border-emerald-100/80 dark:border-border/70 dark:bg-muted/20"
                      >
                        <EmptyMedia variant="icon" className="dark:bg-muted dark:text-emerald-300">
                          <Clock3 className="h-6 w-6" />
                        </EmptyMedia>
                      </Empty>
                    ) : (
                      selectedReportTimeline.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-border dark:bg-muted/40"
                        >
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                              {message.message_type === 'reply' ? <MessageSquareReply className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold capitalize">{message.message_type || 'system'}</p>
                                <Badge variant="outline" className="rounded-full dark:border-border dark:bg-muted/50 dark:text-muted-foreground">
                                  {formatRelativeTime(message.created_at)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{message.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6 rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(16,185,129,0.12)] backdrop-blur dark:border-border dark:bg-card/70 dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)] xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
            <FileText className="h-3.5 w-3.5" />
            Resident Reports
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-foreground">Resident Reports</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-muted-foreground">Monitor and manage resident-submitted reports and complaints.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${isLive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300'}`}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : isLive ? 'Realtime connected' : 'Syncing data'}
          </div>
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200" onClick={() => loadReports(false)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200" onClick={autoAssignUnassigned} disabled={savingAction}>
            <Scale className="mr-2 h-4 w-4" />
            Auto-assign Unassigned
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200">
                <Bell className="h-4 w-4" />
                {unreadAlerts > 0 && <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white dark:bg-rose-500 dark:text-rose-950">{unreadAlerts}</span>}
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
              <Button variant="outline" className="border-emerald-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-slate-200 dark:hover:bg-muted dark:hover:text-foreground">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950">{(profileUser?.name || 'AD').slice(0, 2).toUpperCase()}</AvatarFallback>
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

      <Card className="border-emerald-100 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-border dark:bg-card/70 dark:shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:inline">Quick filters</span>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-full px-3.5', statusFilter === 'pending' ? activeChipClass : idleChipClass)}
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
            >
              <Clock3 className="mr-1.5 h-3.5 w-3.5" />
              Pending ({summary.pendingReports})
            </Button>
            <Button
              variant={statusFilter === 'under_review' ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-full px-3.5', statusFilter === 'under_review' ? activeChipClass : idleChipClass)}
              onClick={() => setStatusFilter(statusFilter === 'under_review' ? 'all' : 'under_review')}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Under Review
            </Button>
            <Button
              variant={priorityFilter === 'high' || priorityFilter === 'critical' ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-full px-3.5', priorityFilter === 'high' || priorityFilter === 'critical' ? activeUrgentChipClass : idleChipClass)}
              onClick={() => {
                if (priorityFilter === 'high') {
                  setPriorityFilter('all')
                } else {
                  setPriorityFilter('high')
                }
              }}
            >
              <TriangleAlert className="mr-1.5 h-3.5 w-3.5" />
              Urgent ({summary.urgentCases})
            </Button>
            <Button
              variant={statusFilter === 'resolved' ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-full px-3.5', statusFilter === 'resolved' ? activeChipClass : idleChipClass)}
              onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Resolved ({summary.resolvedReports})
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="relative border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {(statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || dateFrom || dateTo) && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 dark:bg-emerald-400"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Reports</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | CanonicalStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
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
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {dynamicCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.slug}>
                            {cat.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | CanonicalPriority)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Priorities" />
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
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                      <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setStatusFilter('all')
                      setCategoryFilter('all')
                      setPriorityFilter('all')
                      setDateFrom('')
                      setDateTo('')
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Card>

      <Card className="border-emerald-100 bg-white shadow-sm dark:border-border dark:bg-card">
        <CardHeader className="flex flex-col gap-4 border-b border-emerald-100/80 dark:border-border lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Reports Table</CardTitle>
            <CardDescription>
              {filteredReports.length} filtered report{filteredReports.length === 1 ? '' : 's'} visible out of {reports.length} total.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400 sm:w-auto"
              onClick={printReports}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Reports
            </Button>
            <Button
              variant="outline"
              className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200 sm:w-auto"
              onClick={exportCsv}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-border dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200 sm:w-auto"
              onClick={exportPdf}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 dark:bg-muted/80" />
              <Skeleton className="h-64 w-full dark:bg-muted/80" />
            </div>
          ) : filteredReports.length === 0 ? (
            <Empty
              title="No matching reports"
              description="Try changing the search text, date range, or filter dropdowns."
              className="border border-dashed border-emerald-100/80 dark:border-border/70 dark:bg-muted/20"
            >
              <EmptyMedia variant="icon" className="dark:bg-muted dark:text-emerald-300">
                <Search className="h-6 w-6" />
              </EmptyMedia>
            </Empty>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/60 dark:border-border dark:bg-muted/10">
              <Table>
                <TableHeader className="bg-emerald-50/80 dark:bg-muted/50">
                  <TableRow className="border-emerald-100 hover:bg-transparent dark:border-border dark:hover:bg-transparent">
                    {tableColumns.map((column) => (
                      <TableHead
                        key={column.key}
                        className="h-11 px-4 text-[11px] font-semibold tracking-[0.08em] text-emerald-900/80 uppercase dark:text-muted-foreground"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="h-11 px-4 text-right text-[11px] font-semibold tracking-[0.08em] text-emerald-900/80 uppercase dark:text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
{paginatedReports.map((report) => {
                     const priority = priorityDefinitions[report.priority]
                     const status = statusDefinitions[report.status]
                     const PriorityIcon = priority.icon || GripVertical

                     return (
                       <TableRow
                         key={report.id}
                         className={cn(
                           'border-emerald-100/70 transition-colors hover:bg-emerald-50/70 dark:border-border/70 dark:hover:bg-emerald-500/[0.07]',
                           report.priority === 'critical' && 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.14]',
                           report.priority === 'high' && 'bg-amber-50/30 dark:bg-amber-400/[0.05]',
                         )}
                       >
                         <TableCell className="px-4 font-semibold text-slate-900 dark:text-foreground">
                           <div className="flex items-center gap-2">
                             {report.trackingNumber}
                             {report.priority === 'critical' && <TriangleAlert className="h-4 w-4 text-rose-700 dark:text-rose-400" />}
                           </div>
                         </TableCell>
                         <TableCell className="px-4">
                           <div className="font-medium text-slate-900 dark:text-foreground">{report.residentName}</div>
                           <div className="text-xs text-muted-foreground">{report.residentBarangay || report.residentAddress || 'Resident profile'}</div>
                         </TableCell>
                         <TableCell className="px-4">
                           <Badge className={report.categoryBadgeClass}>{report.category}</Badge>
                         </TableCell>
                        <TableCell className="max-w-[24rem] px-4 whitespace-normal">
                          <span title={report.description} className="flex items-start gap-2">
                            <span className="line-clamp-2 text-slate-600 dark:text-muted-foreground">{truncateText(report.description, 70)}</span>
                            {report.evidenceUrls.length > 0 && (
                              <Badge variant="secondary" className="flex shrink-0 items-center gap-1 rounded-full text-xs dark:bg-muted dark:text-muted-foreground">
                                <ImageIcon className="h-3 w-3" />
                                {report.evidenceUrls.length}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 whitespace-nowrap text-slate-600 dark:text-muted-foreground">
                          {getReportDateLabel(report.submittedAt)}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex items-center gap-2">
                            {priority.icon && <PriorityIcon className="h-3.5 w-3.5" />}
                            <Badge className={priority.badgeClass} variant="secondary">
                              {priority.label}
                            </Badge>
                            <Badge className={status.badgeClass} variant="outline">
                              {status.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="text-sm font-medium">{report.assignedOfficialLabel}</div>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open actions menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 dark:border-border">
                              <DropdownMenuItem onClick={() => openReport(report, 'overview')}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReport(report, 'actions')}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Assign Official
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReport(report, 'actions')}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReport(report, 'actions')}>
                                <MessageSquareReply className="mr-2 h-4 w-4" />
                                Reply to Resident
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setArchiveTarget(report)}
                                className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 dark:text-rose-400 dark:focus:bg-rose-500/15 dark:focus:text-rose-200"
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm dark:border-border dark:bg-card dark:shadow-none sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedReports.length} of {filteredReports.length} filtered reports
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-emerald-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground sm:flex-none"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-medium whitespace-nowrap text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-emerald-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground sm:flex-none"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Last refreshed {lastSyncedAt ? formatDateTime(lastSyncedAt.toISOString()) : 'just now'}
        </div>
      </div>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent className="dark:border-border dark:bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Report</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {archiveTarget?.trackingNumber} as rejected and store it in the archive log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:border-border dark:text-foreground dark:hover:bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-rose-600 text-white hover:bg-rose-700 dark:border dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25 dark:hover:text-rose-100"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ResidentReportsPage