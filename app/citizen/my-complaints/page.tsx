'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import Link from 'next/link'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { ChevronRight } from 'lucide-react'

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
}

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadComplaints() {
      try {
        const supabase = createClient()
        
        // Get user and resident
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const resident = await getOrCreateResidentProfile(supabase, user)

        if (resident) {
          const { data } = await supabase
            .from('complaints')
            .select('*')
            .eq('resident_id', resident.id)
            .order('created_at', { ascending: false })

          setComplaints(data || [])
        }
      } catch (error) {
        console.error('Error loading complaints:', error)
      } finally {
        setLoading(false)
      }
    }

    loadComplaints()
  }, [])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Complaints</h1>
          <p className="text-muted-foreground mt-2">Track all complaints you&apos;ve filed with your barangay</p>
        </div>
        <Link href="/citizen/file-complaint">
          <Button className="bg-primary hover:bg-primary/90">
            + File Complaint
          </Button>
        </Link>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <Empty
          title="No complaints filed"
          description="File your first complaint to report an issue"
          action={
            <Link href="/citizen/file-complaint">
              <Button className="bg-primary hover:bg-primary/90">
                File Complaint
              </Button>
            </Link>
          }
        />
      ) : (
<div className="space-y-4">
          {complaints.map((complaint) => (
            <Link key={complaint.id} href={`/citizen/my-complaints/${complaint.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{complaint.title}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">{complaint.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getStatusIcon(complaint.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-background">
                      {complaint.category}
                    </Badge>
                    <Badge className={getStatusColor(complaint.status)}>
                      {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                    </Badge>
                    <Badge variant="secondary">
                      Priority: {complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {complaint.evidence_url && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Attached Evidence:</p>
                      <a href={complaint.evidence_url} target="_blank" rel="noopener noreferrer" className="block w-40 h-28 rounded-lg overflow-hidden border shadow-sm group">
                        <img
                          src={complaint.evidence_url}
                          alt="Evidence preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => console.error('[DEBUG] Image load error:', complaint.evidence_url, e)}
                        />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
