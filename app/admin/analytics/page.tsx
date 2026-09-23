'use client'

import { useEffect, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, BarChart3, CalendarRange, FileText, Users } from 'lucide-react'
import { AnalyticsCharts } from '@/components/admin/analytics-charts'

/** Upper bound for analytics fetches (summary cards count array lengths). */
const ANALYTICS_ROW_LIMIT = 10000

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

function mapRequestRow(row: any) {
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

export default function AdminAnalyticsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([])
  const [officials, setOfficials] = useState<OfficialRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [trendView, setTrendView] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Summary cards count array lengths, so lift PostgREST's default
      // 1000-row cap to keep the totals accurate as the tables grow.
      const [{ data: requestsData, error: requestsError }, { data: complaintsData, error: complaintsError }, { data: officialsData, error: officialsError }] = await Promise.all([
        supabase
          .from('requests')
          .select('id, request_type, title, description, category, status, created_at')
          .order('created_at', { ascending: true })
          .limit(ANALYTICS_ROW_LIMIT),
        supabase
          .from('complaints')
          .select('id, category, status, created_at')
          .order('created_at', { ascending: true })
          .limit(ANALYTICS_ROW_LIMIT),
        supabase
          .from('officials')
          .select('id, status')
          .order('created_at', { ascending: true })
          .limit(ANALYTICS_ROW_LIMIT),
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
      value: trendView.charAt(0).toUpperCase() + trendView.slice(1),
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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white dark:bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
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
            <Card key={card.label} className="border-emerald-100 bg-white/90 dark:bg-card/90 shadow-[0_12px_32px_rgba(16,185,129,0.08)] backdrop-blur">
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
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[340px] w-full" />
            <Skeleton className="h-[340px] w-full" />
            <Skeleton className="h-[340px] w-full" />
            <Skeleton className="h-[340px] w-full" />
          </div>
        </div>
      ) : (
        <AnalyticsCharts
          requests={requests}
          complaints={complaints}
          officials={officials}
          trendView={trendView}
          onTrendViewChange={setTrendView}
        />
      )}
    </div>
  )
}
