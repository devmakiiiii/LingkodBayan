'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { getOrCreateResidentProfile } from '@/lib/residents'

interface DashboardStats {
  totalRequests: number
  totalComplaints: number
  pendingRequests: number
  resolvedRequests: number
}

export default function CitizenDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    totalComplaints: 0,
    pendingRequests: 0,
    resolvedRequests: 0,
  })
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        
        // Get user info
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserName(user.user_metadata?.first_name || user.email?.split('@')[0] || 'Resident')
        }

        // Get resident data to fetch stats
        const resident = user ? await getOrCreateResidentProfile(supabase, user) : null

        if (resident) {
          // Get requests
          const { data: requests } = await supabase
            .from('requests')
            .select('*')
            .eq('resident_id', resident.id)

          // Get complaints
          const { data: complaints } = await supabase
            .from('complaints')
            .select('*')
            .eq('resident_id', resident.id)

          const totalRequests = requests?.length || 0
          const totalComplaints = complaints?.length || 0
          const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0
          const resolvedRequests = requests?.filter(r => r.status === 'resolved').length || 0

          setStats({
            totalRequests,
            totalComplaints,
            pendingRequests,
            resolvedRequests,
          })
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {userName}! 👋</h1>
        <p className="text-muted-foreground mt-2">Here&apos;s an overview of your civic activities</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">Service requests submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolvedRequests}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complaints</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalComplaints}</div>
            <p className="text-xs text-muted-foreground">Issues reported</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with a new service request or complaint</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link href="/citizen/request-service">
            <Button className="bg-primary hover:bg-primary/90">
              + New Service Request
            </Button>
          </Link>
          <Link href="/citizen/file-complaint">
            <Button variant="outline">
              + File Complaint
            </Button>
          </Link>
          <Link href="/citizen/my-requests">
            <Button variant="outline">
              View My Requests
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
