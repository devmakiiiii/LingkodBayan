'use client'

import { useEffect, useState } from 'react'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, Users, TrendingUp } from 'lucide-react'

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

  useEffect(() => {
    async function loadStats() {
      try {
        if (!hasSupabaseConfig()) {
          setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
          return
        }

        const supabase = createClient()
        
        // Get residents count
        const { count: residentsCount } = await supabase
          .from('residents')
          .select('*', { count: 'exact', head: true })

        // Get requests
        const { data: requests, count: requestsCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact' })

        // Get complaints
        const { data: complaints, count: complaintsCount } = await supabase
          .from('complaints')
          .select('*', { count: 'exact' })

        const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0
        const resolvedRequests = requests?.filter(r => ['approved', 'rejected', 'resolved'].includes(r.status)).length || 0
        const openComplaints = complaints?.filter(c => c.status === 'open').length || 0

        setStats({
          totalResidents: residentsCount || 0,
          totalRequests: requestsCount || 0,
          totalComplaints: complaintsCount || 0,
          pendingRequests,
          openComplaints,
          resolvedRequests,
        })
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
