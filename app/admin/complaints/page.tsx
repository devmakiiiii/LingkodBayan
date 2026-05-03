'use client'

import { useEffect, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Empty } from '@/components/ui/empty'
import { AlertCircle, CheckCircle2, MapIcon, List } from 'lucide-react'
import { ComplaintActions } from '@/components/admin/complaint-actions'

const ComplaintsAnalyticsMap = dynamic(
  () => import('@/components/admin/complaints-analytics-map').then((mod) => mod.ComplaintsAnalyticsMap),
  {
    ssr: false,
    loading: () => <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>,
  },
)

interface Complaint {
  id: string
  subject: string
  title?: string
  description: string
  category: string
  status: string
  resident_id: string
  latitude?: number
  longitude?: number
  location_address: string
  resident_name: string
  resident_email: string
  resident_user_id: string
  created_at: string
  residents: {
    id: string
    user_id: string
    first_name: string
    last_name: string
    email: string
    barangay: string
  } | null
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [showActions, setShowActions] = useState(false)

  useEffect(() => {
    loadComplaints()
  }, [])

  async function loadComplaints() {
    try {
      setLoadError(null)
      if (!hasSupabaseConfig()) {
        setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
        setComplaints([])
        return
      }

      const supabase = createClient()

      // Use wildcard select so page still works even when local DB is behind some migrations.
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error?.message || 'Failed to load complaints')
        setComplaints([])
        return
      }

      const residentIds = Array.from(new Set((data || []).map((row: any) => row.resident_id).filter(Boolean)))
      let residentsById: Record<string, { id: string; user_id: string; first_name: string; last_name: string; email: string; barangay: string }> = {}

      if (residentIds.length > 0) {
        const { data: residents, error: residentsError } = await supabase
          .from('residents')
          .select('id, user_id, first_name, last_name, email, barangay')
          .in('id', residentIds)

        if (!residentsError) {
          residentsById = Object.fromEntries(
            (residents || []).map((resident: any) => [resident.id, resident]),
          )
        }
      }

      const normalizedComplaints = (data || []).map((complaint: any) => ({
        ...complaint,
        subject: complaint.title || complaint.subject || 'Untitled complaint',
        location_address: complaint.location_address || 'Unknown location',
        residents: residentsById[complaint.resident_id] || null,
        resident_user_id: residentsById[complaint.resident_id]?.user_id || '',
        resident_name: residentsById[complaint.resident_id]
          ? `${residentsById[complaint.resident_id].first_name} ${residentsById[complaint.resident_id].last_name}`
          : 'Resident record unavailable',
        resident_email: residentsById[complaint.resident_id]?.email || 'No email available',
      }))

      setComplaints(normalizedComplaints)
    } catch (error: any) {
      setLoadError(error?.message || 'Failed to load complaints')
      setComplaints([])
    } finally {
      setLoading(false)
    }
  }

  async function handleComplaintAction(action: string, data: any) {
    try {
      const supabase = createClient()
      
      if (action === 'kasunduan') {
        // Settlement - close ticket
        await supabase
          .from('complaints')
          .update({ status: 'resolved' })
          .eq('id', data.complaintId)
      } else if (action === 'sumbong') {
        // Process - mark as under investigation
        await supabase
          .from('complaints')
          .update({ status: 'processing' })
          .eq('id', data.complaintId)
      } else if (action === 'reply') {
        // Send reply message
        await supabase
          .from('complaint_messages')
          .insert([
            {
              complaint_id: data.complaintId,
              recipient_user_id: data.recipientUserId,
              sender_id: data.senderId,
              message: data.message,
              message_type: 'reply',
              is_read: false,
            },
          ])
      }

      // Refresh list
      loadComplaints()
    } catch (error) {
      console.error('Error handling complaint action:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-primary" />
      case 'open':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-primary/10 text-primary border-primary/20'
      case 'open':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    }
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Complaints Management</h1>
          <p className="text-muted-foreground mt-2">Review and respond to citizen complaints</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setViewMode('list')}
            variant={viewMode === 'list' ? 'default' : 'outline'}
            className="gap-2"
          >
            <List size={18} />
            List View
          </Button>
          <Button
            onClick={() => setViewMode('map')}
            variant={viewMode === 'map' ? 'default' : 'outline'}
            className="gap-2"
          >
            <MapIcon size={18} />
            Map View
          </Button>
        </div>
      </div>

      {/* Complaints List / Map */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <Empty
          title={configError ? 'Supabase not configured' : loadError ? 'Complaints table unavailable' : 'No complaints'}
          description={configError || loadError || 'No complaints have been filed yet'}
        />
      ) : viewMode === 'map' ? (
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>}>
          <ComplaintsAnalyticsMap
            complaints={complaints.map((c) => ({
              id: c.id,
              latitude: c.latitude || 0,
              longitude: c.longitude || 0,
              location_address: c.location_address,
              category: c.category,
              subject: c.subject,
              created_at: c.created_at,
              status: c.status,
              resident_name: c.resident_name,
            }))}
            onMarkerClick={(complaint) => {
              const full = complaints.find((c) => c.id === complaint.id)
              if (full) {
                setSelectedComplaint(full)
                setShowActions(true)
              }
            }}
          />
        </Suspense>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => (
            <Card
              key={complaint.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedComplaint(complaint)
                setShowActions(true)
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{complaint.subject}</CardTitle>
                    <CardDescription className="mt-1">{complaint.description}</CardDescription>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>
                        Filed by: {complaint.residents
                          ? `${complaint.residents.first_name} ${complaint.residents.last_name}`
                          : 'Resident record unavailable'}
                      </p>
                      <p>Email: {complaint.residents?.email || 'No email available'}</p>
                      {complaint.location_address && <p>Location: {complaint.location_address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(complaint.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-background">
                    {complaint.category}
                  </Badge>
                  <Badge className={getStatusColor(complaint.status)}>
                    {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(complaint.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="pt-2 border-t">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedComplaint(complaint)
                      setShowActions(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Manage Complaint
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Complaint Actions Modal */}
      <ComplaintActions
        complaint={selectedComplaint}
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        onAction={handleComplaintAction}
      />
    </div>
  )
}
