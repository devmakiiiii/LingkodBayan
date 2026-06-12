'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ArrowLeft, MapPin, Calendar, ImageIcon, MessageSquare } from 'lucide-react'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { ComplaintLocationMap } from '@/components/citizen/complaint-location-map'

interface Complaint {
  id: string
  title: string
  description: string
  category: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  evidence_url?: string | null
  latitude?: number | null
  longitude?: number | null
  location_address?: string | null
}

interface ComplaintMessage {
  id: string
  message: string
  created_at: string
  is_read: boolean
  sender_id: string | null
  recipient_user_id: string | null
}

export default function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [complaint, setComplaint] = useState<Complaint | null>(null)
  const [messages, setMessages] = useState<ComplaintMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadComplaint() {
      try {
        const supabase = createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        const resident = await getOrCreateResidentProfile(supabase, user)

        if (resident) {
          const { data } = await supabase
            .from('complaints')
            .select('*')
            .eq('id', id)
            .eq('resident_id', resident.id)
            .single()

          if (data) {
            setComplaint(data)

            const { data: messagesData } = await supabase
              .from('complaint_messages')
              .select('id, message, created_at, is_read, sender_id, recipient_user_id')
              .eq('complaint_id', id)
              .order('created_at', { ascending: true })

            setMessages(messagesData || [])
          }
        }
      } catch (error) {
        console.error('Error loading complaint:', error)
      } finally {
        setLoading(false)
      }
    }

    loadComplaint()
  }, [id])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="h-5 w-5 text-primary" />
      case 'open':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'in-progress':
        return <AlertCircle className="h-5 w-5 text-blue-600" />
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

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Loading complaint...</p>
        </div>
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="p-4 md:p-6 max-w-2xl">
        <Empty
          title="Complaint not found"
          description="The complaint you are looking for does not exist or you do not have permission to view it"
          action={
            <Link href="/citizen/my-complaints">
              <Button variant="outline" size="sm">Back to My Complaints</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/citizen/my-complaints">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{complaint.title}</h1>
          <p className="text-muted-foreground text-sm">Complaint details and conversation</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Complaint Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Description</label>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{complaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Category</label>
                  <p className="text-sm text-gray-600 mt-1">{complaint.category}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Priority</label>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{complaint.priority}</p>
                </div>
              </div>

              {complaint.location_address && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </label>
                  <p className="text-sm text-gray-600 mt-1">{complaint.location_address}</p>
                </div>
              )}

              {complaint.evidence_url && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Evidence
                  </label>
                  <a href={complaint.evidence_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                    <img
                      src={complaint.evidence_url}
                      alt="Evidence"
                      className="max-w-full max-h-48 rounded-md border shadow-sm"
                    />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Conversation History
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Admin replies will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isAdmin = msg.sender_id !== userId
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
                            isAdmin
                              ? 'bg-gray-100'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-xs mt-1.5 ${isAdmin ? 'text-gray-500' : 'text-primary-foreground/70'}`}>
                            {new Date(msg.created_at).toLocaleString('en-PH')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(complaint.status)}
                <Badge className={`text-xs px-2 py-0.5 ${getStatusColor(complaint.status)}`}>
                  {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {complaint.latitude && complaint.longitude && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Location Map</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="w-full overflow-hidden rounded-md border shadow-sm">
                  <ComplaintLocationMap
                    latitude={complaint.latitude}
                    longitude={complaint.longitude}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-gray-600">Submitted:</span>
                <span className="font-medium">{new Date(complaint.created_at).toLocaleString('en-PH')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-gray-600">Last Updated:</span>
                <span className="font-medium">{new Date(complaint.updated_at).toLocaleString('en-PH')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}