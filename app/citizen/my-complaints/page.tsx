'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  ComplaintStatusBadge,
  ComplaintStatusIcon,
} from '@/components/citizen/complaint-status-badge'
import Link from 'next/link'
import { ChevronRight, Search, X } from 'lucide-react'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { formatDate } from '@/lib/format-date'
import {
  complaintStatusFilterOptions,
  getComplaintStatus,
} from '@/lib/complaint-status'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

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

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesSearch = searchQuery === '' || 
        complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        complaint.description.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus =
        statusFilter === 'all' || getComplaintStatus(complaint.status) === statusFilter
      
      const matchesCategory = categoryFilter === 'all' || complaint.category === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [complaints, searchQuery, statusFilter, categoryFilter])

  const uniqueCategories = Array.from(new Set(complaints.map(c => c.category)))

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Complaints</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all complaints you&apos;ve filed with your barangay</p>
        </div>
        <Link href="/citizen/file-complaint">
          <Button size="sm">File Complaint</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search complaints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm"
        >
          {complaintStatusFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm"
        >
          <option value="all">All Categories</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Clear filters</span>
          </Button>
        )}
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
      ) : filteredComplaints.length === 0 ? (
        <Empty
          title="No complaints match your search"
          description="Try adjusting your search or filter criteria"
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((complaint) => (
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
                      <ComplaintStatusIcon status={complaint.status} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs px-2 py-0">
                      {complaint.category}
                    </Badge>
                    <ComplaintStatusBadge status={complaint.status} className="px-2 py-0" />
                    <Badge variant="secondary" className="text-xs px-2 py-0">
                      {complaint.priority.charAt(0).toUpperCase() + complaint.priority.slice(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(complaint.created_at, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {complaint.evidence_url && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Attached Evidence:</p>
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
