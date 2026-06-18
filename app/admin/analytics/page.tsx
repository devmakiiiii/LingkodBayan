'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  analyticsTrendLabels,
  analyticsTrendViews,
  complaintCategoryColors,
  complaintCategoryLabels,
  complaintCategories,
  statusPalette,
  normalizeComplaintCategory,
  normalizeRequestStatus,
  getRequestTypeLabel,
  type AnalyticsTrendView,
  type RequestReportRow,
} from '@/lib/admin-reporting'
import { complaintCategoryBadgeClasses } from '@/lib/complaint-categories'
import { requestTypes } from '@/lib/request-types'
import { AlertTriangle, BarChart3, CalendarRange, FileText, Users } from 'lucide-react'

type ComplaintRecord = {
  id: string
  category: string | null
  status: string | null
  created_at: string
}

type OfficialRecord = {
  id: string
  status: string
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

function mapComplaintRow(row: any): ComplaintRecord {
  return {
    id: row.id,
    category: row.category ?? null,
    status: row.status ?? null,
    created_at: row.created_at,
  }
}

function mapOfficialRow(row: any): OfficialRecord {
  return {
    id: row.id,
    status: row.status,
  }
}

function formatBucket(date: Date, view: AnalyticsTrendView) {
  if (view === 'daily') {
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  if (view === 'weekly') {
    const start = new Date(date)
    const day = start.getDay()
    const diff = (day + 6) % 7
    start.setDate(start.getDate() - diff)
    return `Week of ${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
  }

  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function bucketDate(date: Date, view: AnalyticsTrendView) {
  const copy = new Date(date)
  if (view === 'daily') {
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  if (view === 'weekly') {
    const day = copy.getDay()
    const diff = (day + 6) % 7
    copy.setDate(copy.getDate() - diff)
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  copy.setDate(1)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function buildTrendData(rows: RequestReportRow[], view: AnalyticsTrendView) {
  const groups = new Map<string, { label: string; bucket: number; value: number }>()

  rows.forEach((row) => {
    const date = new Date(row.created_at)
    const bucket = bucketDate(date, view)
    const key = bucket.toISOString()

    if (!groups.has(key)) {
      groups.set(key, {
        label: formatBucket(bucket, view),
        bucket: bucket.getTime(),
        value: 0,
      })
    }

    const entry = groups.get(key)
    if (entry) {
      entry.value += 1
    }
  })

  return Array.from(groups.values()).sort((a, b) => a.bucket - b.bucket)
}

function countStatusDistribution(requests: RequestReportRow[], complaints: ComplaintRecord[]) {
  const counts: Record<'pending' | 'processing' | 'approved' | 'rejected' | 'resolved', number> = {
    pending: 0,
    processing: 0,
    approved: 0,
    rejected: 0,
    resolved: 0,
  }

  requests.forEach((request) => {
    const status = normalizeRequestStatus(request.status)
    counts[status] += 1
  })

  complaints.forEach((complaint) => {
    const normalized = complaint.status?.toLowerCase() ?? 'open'
    if (normalized === 'open') {
      counts.pending += 1
    } else if (normalized === 'in-progress') {
      counts.processing += 1
    } else if (normalized === 'resolved') {
      counts.resolved += 1
    }
  })

  return counts
}

export default function AdminAnalyticsPage() {
  const [requests, setRequests] = useState<RequestReportRow[]>([])
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([])
  const [officials, setOfficials] = useState<OfficialRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [trendView, setTrendView] = useState<AnalyticsTrendView>('weekly')
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setLoading(false)
        return
      }

      const supabase = createClient()

      const [{ data: requestsData, error: requestsError }, { data: complaintsData, error: complaintsError }, { data: officialsData, error: officialsError }] = await Promise.all([
        supabase
          .from('requests')
          .select('id, request_type, title, description, category, status, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('complaints')
          .select('id, category, status, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('officials')
          .select('id, status')
          .order('created_at', { ascending: true }),
      ])

      if (requestsError) {
        console.warn('Requests analytics query failed:', requestsError)
      } else {
        setRequests((requestsData || []).map(mapRequestRow))
      }

      if (complaintsError) {
        console.warn('Complaints analytics query failed:', complaintsError)
      } else {
        setComplaints((complaintsData || []).map(mapComplaintRow))
      }

      if (officialsError) {
        console.warn('Officials analytics query failed:', officialsError)
      } else {
        setOfficials((officialsData || []).map(mapOfficialRow))
      }

      setLoading(false)
    }

    loadAnalytics()
  }, [])

  const requestsByType = useMemo(
    () =>
      requestTypes.map((requestType, index) => ({
        requestType,
        label: getRequestTypeLabel(requestType),
        value: requests.filter((request) => request.request_type === requestType).length,
        fill: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e'][index],
      })),
    [requests],
  )

  const requestsOverTime = useMemo(() => buildTrendData(requests, trendView), [requests, trendView])

  const complaintCategoryData = useMemo(
    () =>
      complaintCategories.map((category) => ({
        category,
        label: complaintCategoryLabels[category],
        value: complaints.filter((complaint) => normalizeComplaintCategory(complaint.category) === category).length,
        fill: complaintCategoryColors[category],
      })),
    [complaints],
  )

  const statusCounts = useMemo(() => countStatusDistribution(requests, complaints), [requests, complaints])

  const statusData = useMemo(
    () => [
      { status: 'Pending', value: statusCounts.pending, fill: statusPalette.pending },
      { status: 'Processing', value: statusCounts.processing, fill: statusPalette.processing },
      { status: 'Approved', value: statusCounts.approved, fill: statusPalette.approved },
      { status: 'Rejected', value: statusCounts.rejected, fill: statusPalette.rejected },
      { status: 'Resolved', value: statusCounts.resolved, fill: statusPalette.resolved },
    ],
    [statusCounts],
  )

  const summaryCards = [
    {
      label: 'Total Requests',
      value: requests.length,
      icon: FileText,
      hint: 'All submitted service requests',
    },
    {
      label: 'Total Complaints',
      value: complaints.length,
      icon: AlertTriangle,
      hint: 'Resident complaints and issues',
    },
    {
      label: 'Total Officials',
      value: officials.length,
      icon: Users,
      hint: 'Active and inactive records',
    },
    {
      label: 'Trend View',
      value: analyticsTrendLabels[trendView],
      icon: CalendarRange,
      hint: 'Switch daily, weekly, or monthly',
    },
  ]

  return (
    <div
      className="space-y-8 p-8"
      style={{ backgroundImage: 'linear-gradient(to bottom right, #ecfdf5, #ffffff, #f7fee7)' }}
    >
      {configError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Supabase not configured</CardTitle>
            <CardDescription className="text-amber-800">{configError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Admin Analytics
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="max-w-2xl text-sm text-slate-600">Track request volume, complaint categories, and status distribution across the barangay system.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <Card key={card.label} className="border-emerald-100 bg-white/90 shadow-[0_12px_32px_rgba(16,185,129,0.08)] backdrop-blur">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <div className="text-3xl font-bold text-slate-900">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
                  <p className="text-xs text-slate-500">{card.hint}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 shadow-inner">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {loading ? (
        <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
          <CardContent className="py-16 text-center text-slate-600">Loading analytics...</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader>
              <CardTitle>Requests by Type</CardTitle>
              <CardDescription>Bar chart showing the current request volume for each service type.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsByType} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                    <XAxis dataKey="label" angle={-15} textAnchor="end" interval={0} height={60} tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [value, 'Requests']} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {requestsByType.map((entry) => (
                        <Cell key={entry.requestType} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Requests Over Time</CardTitle>
                <CardDescription>Daily, weekly, or monthly request trends.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {analyticsTrendViews.map((view) => (
                  <Button
                    key={view}
                    size="sm"
                    variant={trendView === view ? 'default' : 'outline'}
                    className={trendView === view ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
                    onClick={() => setTrendView(view)}
                  >
                    {analyticsTrendLabels[view]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={requestsOverTime} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, 'Requests']} />
                    <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader>
              <CardTitle>Reports by Category</CardTitle>
              <CardDescription>Pie chart for complaint categories submitted by residents.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={complaintCategoryData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={110} innerRadius={65} paddingAngle={4}>
                      {complaintCategoryData.map((entry) => (
                        <Cell key={entry.category} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {complaintCategoryData.map((entry) => (
                  <Badge key={entry.category} className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    {entry.label}: {entry.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-white shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Donut chart across pending, processing, approved, rejected, and resolved items.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={110} innerRadius={72} paddingAngle={3}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {statusData.map((entry) => (
                  <div key={entry.status} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500">{entry.status}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{entry.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
