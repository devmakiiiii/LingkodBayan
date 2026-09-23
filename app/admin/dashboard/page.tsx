'use client'

import { useEffect, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { countComplaintsByStatus, countRequestsByStatus } from '@/lib/citizen-stats'
import { computeOfficialWorkloads, type OfficialWorkload } from '@/lib/workload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, Scale, Users, TrendingUp } from 'lucide-react'

/**
 * Upper bound for the status-column fetch used by the breakdown counts.
 * Well above PostgREST's default 1000-row cap so the client-side buckets
 * stay in sync with the exact totals even as the tables grow.
 */
const STATUS_ROW_LIMIT = 10000

interface DashboardStats {
  totalResidents: number
  totalRequests: number
  totalComplaints: number
  pendingRequests: number
  openComplaints: number
  resolvedRequests: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalResidents: 0,
    totalRequests: 0,
    totalComplaints: 0,
    pendingRequests: 0,
    openComplaints: 0,
    resolvedRequests: 0,
  })
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [officialWorkloads, setOfficialWorkloads] = useState<OfficialWorkload[]>([])

  useEffect(() => {
    async function loadStats() {
      try {
        if (!hasSupabaseConfig()) {
          setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
          return
        }

        const supabase = createClient()

        // Only the columns needed for the breakdowns and the workload card are
        // selected. Selecting `*` would pull the requests table's JSONB payload
        // (base64 attachments) and PostgREST's default row cap would silently
        // truncate the rows, making the client-side counts smaller than the
        // exact totals.
        const [
          { count: residentsCount },
          { data: requestRows, count: requestsCount },
          { data: complaintRows, count: complaintsCount },
          { data: officialRows },
        ] = await Promise.all([
          supabase.from('residents').select('id', { count: 'exact', head: true }),
          // assigned_official_id requires migration 21; if it has not been run
          // yet this query errors, data is null, and the workload card simply
          // falls back to complaint load only.
          supabase.from('requests').select('status, assigned_official_id, priority', { count: 'exact' }).limit(STATUS_ROW_LIMIT),
          supabase.from('complaints').select('status, assigned_official_id, priority_level, archived_at', { count: 'exact' }).limit(STATUS_ROW_LIMIT),
          supabase.from('officials').select('id, full_name, status, designations(name)').order('full_name', { ascending: true }),
        ])

        // Normalize legacy aliases ("in-progress", "under_review", ...) so every
        // row lands in exactly one bucket and the breakdowns reconcile with the
        // totals (see lib/citizen-stats.ts).
        const requestCounts = countRequestsByStatus(requestRows)
        const complaintCounts = countComplaintsByStatus(complaintRows)

        setStats({
          totalResidents: residentsCount ?? 0,
          totalRequests: requestsCount ?? requestCounts.total,
          totalComplaints: complaintsCount ?? complaintCounts.total,
          pendingRequests: requestCounts.pending,
          // "Unresolved" includes complaints already under investigation.
          openComplaints: complaintCounts.inProgress,
          // Terminal request states (legacy "resolved" normalizes to approved).
          resolvedRequests: requestCounts.approved + requestCounts.rejected,
        })

        setOfficialWorkloads(computeOfficialWorkloads(
          (officialRows ?? []).map((official: any) => ({
            id: official.id,
            name: official.full_name || 'Official',
            designationLabel: official.designations?.name || 'Official',
            status: official.status,
          })),
          (complaintRows ?? []).map((row: any) => ({
            assignedOfficialId: row.assigned_official_id,
            status: row.status,
            priority: row.priority_level,
            archivedAt: row.archived_at,
          })),
          (requestRows ?? []).map((row: any) => ({
            assignedOfficialId: row.assigned_official_id,
            status: row.status,
            priority: row.priority,
          })),
        ))
      } catch (error) {
        console.error('Error loading dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage service requests, complaints, and residents</p>
      </div>

      {configError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Supabase not configured</CardTitle>
            <CardDescription className="text-amber-800">{configError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Residents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResidents}</div>
            <p className="text-xs text-muted-foreground">Registered citizens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">Service requests submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Requests</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolvedRequests}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalComplaints}</div>
            <p className="text-xs text-muted-foreground">Issues reported</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Complaints</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openComplaints}</div>
            <p className="text-xs text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Official Workload */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Official Workload
            </CardTitle>
            <CardDescription>
              Priority-weighted active complaints and requests per official. Use this to keep assignments balanced.
            </CardDescription>
          </div>
          <Link href="/admin/complaints">
            <Button variant="outline" size="sm">Manage Reports</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading workload…</p>
          ) : officialWorkloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No officials found. Add officials under Manage Officials to start balancing workload.
            </p>
          ) : (
            <div className="space-y-3">
              {[...officialWorkloads]
                .sort((a, b) => b.weightedLoad - a.weightedLoad)
                .map((workload) => (
                  <div key={workload.officialId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">
                        {workload.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{workload.designationLabel}</span>
                        {!workload.isAssignable && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {workload.activeComplaints} complaint{workload.activeComplaints === 1 ? '' : 's'} ·{' '}
                        {workload.activeRequests} request{workload.activeRequests === 1 ? '' : 's'} active ·{' '}
                        {workload.completedTotal} completed
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${workload.loadShare >= 0.75 ? 'bg-destructive' : workload.loadShare >= 0.4 ? 'bg-yellow-500' : 'bg-primary'}`}
                        style={{ width: `${Math.round(workload.loadShare * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to key management areas</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Link href="/admin/requests">
            <Button variant="outline">
              View Requests
            </Button>
          </Link>
          <Link href="/admin/complaints">
            <Button variant="outline">
              View Complaints
            </Button>
          </Link>
          <Link href="/admin/residents">
            <Button variant="outline">
              Manage Residents
            </Button>
          </Link>
          <Link href="/admin/announcements">
            <Button variant="outline">
              Create Announcement
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
