'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  analyticsTrendLabels,
  analyticsTrendViews,
  complaintCategoryColors,
  complaintCategoryLabels,
  complaintCategories,
  statusPalette,
  normalizeComplaintCategory,
  normalizeComplaintStatus,
  normalizeRequestStatus,
  getRequestTypeLabel,
  type AnalyticsTrendView,
  type RequestReportRow,
} from '@/lib/admin-reporting'
import { complaintCategoryBadgeClasses } from '@/lib/complaint-categories'
import { requestTypes } from '@/lib/request-types'
import * as RechartsPrimitive from 'recharts'
import * as React from 'react'

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

interface AnalyticsChartsProps {
  requests: RequestReportRow[]
  complaints: ComplaintRecord[]
  officials: OfficialRecord[]
  trendView: AnalyticsTrendView
  onTrendViewChange: (view: AnalyticsTrendView) => void
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
    // Normalize first so canonical ("under_investigation", "dismissed") and
    // legacy ("in-progress", "under_review", "rejected") statuses all land in
    // a bucket instead of being silently dropped from the chart.
    const status = normalizeComplaintStatus(complaint.status)
    if (status === 'open') {
      counts.pending += 1
    } else if (status === 'under_investigation') {
      counts.processing += 1
    } else if (status === 'resolved') {
      counts.resolved += 1
    } else {
      counts.rejected += 1
    }
  })

  return counts
}

export function AnalyticsCharts({ requests, complaints, officials, trendView, onTrendViewChange }: AnalyticsChartsProps) {
  const requestsByType = React.useMemo(
    () =>
      requestTypes.map((requestType, index) => ({
        requestType,
        label: getRequestTypeLabel(requestType),
        value: requests.filter((request) => request.request_type === requestType).length,
        fill: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e'][index],
      })),
    [requests],
  )

  const requestsOverTime = React.useMemo(() => buildTrendData(requests, trendView), [requests, trendView])

  const complaintCategoryData = React.useMemo(
    () =>
      complaintCategories.map((category) => ({
        category,
        label: complaintCategoryLabels[category],
        value: complaints.filter((complaint) => normalizeComplaintCategory(complaint.category) === category).length,
        fill: complaintCategoryColors[category],
      })),
    [complaints],
  )

  const statusCounts = React.useMemo(() => countStatusDistribution(requests, complaints), [requests, complaints])

  const statusData = React.useMemo(
    () => [
      { status: 'Pending', value: statusCounts.pending, fill: statusPalette.pending },
      { status: 'Processing', value: statusCounts.processing, fill: statusPalette.processing },
      { status: 'Approved', value: statusCounts.approved, fill: statusPalette.approved },
      { status: 'Rejected', value: statusCounts.rejected, fill: statusPalette.rejected },
      { status: 'Resolved', value: statusCounts.resolved, fill: statusPalette.resolved },
    ],
    [statusCounts],
  )

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-emerald-100 dark:border-border bg-white dark:bg-card shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
        <CardHeader>
          <CardTitle>Requests by Type</CardTitle>
          <CardDescription>Bar chart showing the current request volume for each service type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full" style={{ height: 320 }}>
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
              <RechartsPrimitive.BarChart data={requestsByType} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
                <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <RechartsPrimitive.XAxis dataKey="label" angle={-15} textAnchor="end" interval={0} height={60} tick={{ fill: '#475569', fontSize: 12 }} />
                <RechartsPrimitive.YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                <RechartsPrimitive.Tooltip formatter={(value) => [value, 'Requests']} cursor={{ fill: 'rgba(16,185,129,0.08)' }} />
                <RechartsPrimitive.Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {requestsByType.map((entry) => (
                    <RechartsPrimitive.Cell key={entry.requestType} fill={entry.fill} />
                  ))}
                </RechartsPrimitive.Bar>
              </RechartsPrimitive.BarChart>
            </RechartsPrimitive.ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 dark:border-border bg-white dark:bg-card shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
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
                className={trendView === view ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-200 dark:border-border text-emerald-700 hover:bg-emerald-50'}
                onClick={() => onTrendViewChange(view)}
              >
                {analyticsTrendLabels[view]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full" style={{ height: 320 }}>
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
              <RechartsPrimitive.LineChart data={requestsOverTime} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <RechartsPrimitive.XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                <RechartsPrimitive.YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                <RechartsPrimitive.Tooltip formatter={(value) => [value, 'Requests']} />
                <RechartsPrimitive.Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6 }} />
              </RechartsPrimitive.LineChart>
            </RechartsPrimitive.ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 dark:border-border bg-white dark:bg-card shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
        <CardHeader>
          <CardTitle>Reports by Category</CardTitle>
          <CardDescription>Pie chart for complaint categories submitted by residents.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full" style={{ height: 320 }}>
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
              <RechartsPrimitive.PieChart>
                <RechartsPrimitive.Pie data={complaintCategoryData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={110} innerRadius={65} paddingAngle={4}>
                  {complaintCategoryData.map((entry) => (
                    <RechartsPrimitive.Cell key={entry.category} fill={entry.fill} />
                  ))}
                </RechartsPrimitive.Pie>
                <RechartsPrimitive.Tooltip formatter={(value, name) => [value, name]} />
              </RechartsPrimitive.PieChart>
            </RechartsPrimitive.ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {complaintCategoryData.map((entry) => (
              <span key={entry.category} className={complaintCategoryBadgeClasses[entry.category as keyof typeof complaintCategoryBadgeClasses] || 'border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-gray-300'}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                {entry.label}: {entry.value}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 dark:border-border bg-white dark:bg-card shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Donut chart across pending, processing, approved, rejected, and resolved items.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full" style={{ height: 320 }}>
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
              <RechartsPrimitive.PieChart>
                <RechartsPrimitive.Pie data={statusData} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={110} innerRadius={72} paddingAngle={3}>
                  {statusData.map((entry) => (
                    <RechartsPrimitive.Cell key={entry.status} fill={entry.fill} />
                  ))}
                </RechartsPrimitive.Pie>
                <RechartsPrimitive.Tooltip formatter={(value, name) => [value, name]} />
              </RechartsPrimitive.PieChart>
            </RechartsPrimitive.ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {statusData.map((entry) => (
              <div key={entry.status} className="rounded-2xl border border-emerald-100 dark:border-border bg-emerald-50/70 p-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">{entry.status}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{entry.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
