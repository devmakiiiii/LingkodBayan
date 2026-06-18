'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty } from '@/components/ui/empty'
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
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import {
  buildCsv,
  downloadCsvFile,
  getReportDateLabel,
  getReportDateTimeLabel,
  openPrintableReport,
  type PrintableColumn,
} from '@/lib/admin-reporting'
import { complaintCategories, complaintCategoryKeywords, complaintCategoryBadgeClasses, complaintCategoryFallbackPriorities, type ComplaintCategory, analyzeComplaintPriority } from '@/lib/complaint-categories'

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
      const [{ data: userData }, { data: categoriesData }, { data: complaintRows, error: complaintError }, { data: residentsData, error: residentsError }, { data: officialsData, error: officialsError }, { data: messagesData, error: messagesError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('service_categories').select('id, slug, title, description, is_active').eq('category_type', 'incident').eq('is_active', true).order('sort_order', { ascending: true }),
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

      const currentCategories = (categoriesData || []) as ServiceCategory[]
      setDynamicCategories(currentCategories)

      const messagesByComplaintId = new Map<string, ComplaintMessageRow[]>()
       ;(messagesData || []).forEach((message: any) => {
        const entry = messagesByComplaintId.get(message.complaint_id) || []
        entry.push(message)
        messagesByComplaintId.set(message.complaint_id, entry)
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
      toast.success('Changes saved successfully')
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

      toast.success('Response sent successfully')
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
        <DialogContent className="max-h-[92vh] w-[min(96vw,60rem)] overflow-y-auto sm:max-w-none">
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="actions">Admin Actions</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <Card className={`border-emerald-100 ${selectedReport.priority === 'critical' ? 'border-l-4 border-l-rose-600' : selectedReport.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}>
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
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4">
                        <p className="text-sm font-semibold text-foreground">Full Complaint Description</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedReport.description}</p>
                      </div>
                      {selectedReport.priorityReasons && selectedReport.priorityReasons.length > 0 && (
                        <div className="text-xs text-slate-500">
                          <span className="font-medium">Priority reasons:</span> {selectedReport.priorityReasons.join(', ')}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedReport.evidenceUrls.length > 0 && (
                    <Card className="border-emerald-100">
                      <CardHeader>
                        <CardTitle>Evidence Images</CardTitle>
                        <CardDescription>Preview any attached images or available evidence links.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedReport.evidenceUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img src={url} alt="Evidence preview" className="h-40 w-full object-cover transition-transform group-hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
              </TabsContent>

              <TabsContent value="actions" className="mt-6 space-y-6">
                <Card className="border-emerald-100">
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
                        <div className="flex flex-wrap gap-1 pt-1">
                          {selectedReport.status !== 'resolved' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setStatusDraft('resolved'); updateReport({ status: 'resolved', assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, 'Marked as resolved.') }} disabled={savingAction}>
                              Mark Resolved
                            </Button>
                          )}
                          {selectedReport.status === 'resolved' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setStatusDraft('under_review'); updateReport({ status: 'under_review', assignedOfficialId: assignedOfficialDraft || null, adminNotes: adminNotesDraft }, 'Report reopened.') }} disabled={savingAction}>
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
                      <Button variant="ghost" size="sm" onClick={exportPdf} disabled={savingAction}>
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-100">
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
                      <div className="text-xs text-slate-500">{replyDraft.length} characters</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={sendReply} disabled={savingAction || !replyDraft.trim()}>
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
                <Card className="border-emerald-100">
                  <CardHeader className="sticky top-0 bg-white z-10 border-b border-emerald-100">
                    <CardTitle>Timeline / History Logs</CardTitle>
                    <CardDescription>Review every update, reply, and internal action made for this report.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
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
                                <Badge variant="outline">{formatRelativeTime(message.created_at)}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{message.message}</p>
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

      <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
            Pending ({summary.pendingReports})
          </Button>
          <Button variant={statusFilter === 'under_review' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(statusFilter === 'under_review' ? 'all' : 'under_review')}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Under Review
          </Button>
          <Button variant={priorityFilter === 'high' || priorityFilter === 'critical' ? 'default' : 'outline'} size="sm" onClick={() => {
            if (priorityFilter === 'high') {
              setPriorityFilter('all')
            } else {
              setPriorityFilter('high')
            }
          }}>
            <TriangleAlert className="mr-1.5 h-3.5 w-3.5" />
            Urgent ({summary.urgentCases})
          </Button>
          <Button variant={statusFilter === 'resolved' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Resolved ({summary.resolvedReports})
          </Button>
        </div>

        <Card className="border-emerald-100 bg-white shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {(statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || dateFrom || dateTo) && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
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
                           <Badge className={report.categoryBadgeClass}>{report.category}</Badge>
                         </TableCell>
                        <TableCell>
                          <span title={report.description} className="flex items-start gap-2">
                            {truncateText(report.description, 70)}
                            {report.evidenceUrls.length > 0 && (
                              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                <ImageIcon className="h-3 w-3" />
                                {report.evidenceUrls.length}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{getReportDateLabel(report.submittedAt)}</TableCell>
                        <TableCell>
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
                        <TableCell>
                          <div className="text-sm font-medium">{report.assignedOfficialLabel}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open actions menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                              <DropdownMenuItem onClick={() => archiveReport(report)} className="text-rose-600 focus:text-rose-600">
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