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
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Complaints</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all complaints you&apos;ve filed with your barangay</p>
        </div>
        <Link href="/citizen/file-complaint">
          <Button size="sm">File Complaint</Button>
        </Link>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Loading complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <Empty
          title="No complaints filed"
          description="File your first complaint to report an issue"
          action={
            <Link href="/citizen/file-complaint">
              <Button size="sm">File Complaint</Button>
            </Link>
          }
        />
      ) : (
<div className="space-y-3">
           {complaints.map((complaint) => (
             <Link key={complaint.id} href={`/citizen/my-complaints/${complaint.id}`}>
               <Card className="hover:shadow-md transition-shadow cursor-pointer group py-4">
                 <CardHeader className="pb-2 px-4">
                   <div className="flex items-start justify-between gap-2">
                     <div className="flex-1 min-w-0">
                       <CardTitle className="text-base flex items-center justify-between gap-2">
                         <span className="truncate">{complaint.title}</span>
                         <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                       </CardTitle>
                       <CardDescription className="mt-1 text-xs line-clamp-2">{complaint.description}</CardDescription>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                       {getStatusIcon(complaint.status)}
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="px-4 py-2">
                   <div className="flex items-center gap-1.5 flex-wrap">
                     <Badge variant="outline" className="text-xs px-2 py-0">
                       {complaint.category}
                     </Badge>
                     <Badge className={`text-xs px-2 py-0 ${getStatusColor(complaint.status)}`}>
                       {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                     </Badge>
                     <Badge variant="secondary" className="text-xs px-2 py-0">
                       {complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1)}
                     </Badge>
                     <span className="text-xs text-muted-foreground ml-auto">
                       {new Date(complaint.created_at).toLocaleDateString()}
                     </span>
                   </div>
                   {complaint.evidence_url && (
                     <div className="mt-3 pt-3 border-t border-gray-100">
                       <p className="text-xs font-semibold text-gray-700 mb-1.5">Attached Evidence:</p>
                       <a href={complaint.evidence_url} target="_blank" rel="noopener noreferrer" className="block w-32 h-20 rounded-md overflow-hidden border shadow-sm group">
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
