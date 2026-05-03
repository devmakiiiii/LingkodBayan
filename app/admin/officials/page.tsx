'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, Eye, Search } from 'lucide-react'
import { OfficialActions, type OfficialRecord } from '@/components/admin/officials-actions'
import { DesignationActions, type DesignationRecord } from '@/components/admin/designations-actions'
import {
  getDesignationCategoryShortLabel,
  getOfficialStatusLabel,
  getOfficialTermDuration,
  isCaptainDesignation,
  normalizeBadgeColor,
} from '@/lib/governance'

type OfficialRow = OfficialRecord & {
  designation?: DesignationRecord | null
}

const categoryFilters = ['all', 'barangay', 'sk', 'staff'] as const
const statusFilters = ['all', 'active', 'inactive'] as const

export default function AdminOfficialsPage() {
  const [officials, setOfficials] = useState<OfficialRow[]>([])
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<(typeof categoryFilters)[number]>('all')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialRow | null>(null)
  const [designationModalOpen, setDesignationModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const supabase = createClient()
      const [{ data: designationData }, { data: officialData }] = await Promise.all([
        supabase.from('designations').select('*').order('priority_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('officials').select('*, designations(id, name, category, priority_order, badge_color)').order('created_at', { ascending: false }),
      ])

      setDesignations((designationData || []) as DesignationRecord[])
      setOfficials((officialData || []) as OfficialRow[])
    } catch (error) {
      console.error('Error loading officials:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOfficials = useMemo(() => {
    const query = search.trim().toLowerCase()

    return officials
      .filter((official) => {
        const designation = official.designation || (official as any).designations || null
        const matchesSearch =
          !query ||
          official.fullName.toLowerCase().includes(query) ||
          (designation?.name || '').toLowerCase().includes(query)
        const matchesCategory = categoryFilter === 'all' || designation?.category === categoryFilter
        const matchesStatus = statusFilter === 'all' || official.status === statusFilter

        return matchesSearch && matchesCategory && matchesStatus
      })
      .sort((a, b) => {
        const da = a.designation || (a as any).designations || null
        const db = b.designation || (b as any).designations || null
        const priorityDiff = (da?.priorityOrder || 999) - (db?.priorityOrder || 999)
        if (priorityDiff !== 0) return priorityDiff
        return a.fullName.localeCompare(b.fullName)
      })
  }, [officials, search, categoryFilter, statusFilter])

  const groupedOfficials = useMemo(() => {
    const groups: Record<'barangay' | 'sk' | 'staff', OfficialRow[]> = {
      barangay: [],
      sk: [],
      staff: [],
    }

    filteredOfficials.forEach((official) => {
      const designation = official.designation || (official as any).designations || null
      const category = (designation?.category || 'staff') as 'barangay' | 'sk' | 'staff'
      groups[category].push(official)
    })

    return groups
  }, [filteredOfficials])

  async function deleteOfficialById(official: OfficialRow) {
    const confirmed = window.confirm(`Delete ${official.fullName}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from('officials').delete().eq('id', official.id)
      if (error) throw error
      loadData()
    } catch (error) {
      console.error('Error deleting official:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete official')
    }
  }

  const groups = [
    { key: 'barangay' as const, title: 'Barangay Officials' },
    { key: 'sk' as const, title: 'SK Officials' },
    { key: 'staff' as const, title: 'Staff' },
  ]

  return (
    <div className="space-y-8 p-8">
      <OfficialActions
        isOpen={modalOpen}
        mode={modalMode}
        official={selectedOfficial}
        designations={designations}
        onClose={() => {
          setModalOpen(false)
          setSelectedOfficial(null)
        }}
        onSaved={loadData}
      />

      <DesignationActions
        isOpen={designationModalOpen}
        mode="create"
        designation={null}
        onClose={() => setDesignationModalOpen(false)}
        onSaved={loadData}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Officials List</h1>
          <p className="text-muted-foreground mt-2">Manage officials, linked designations, and their active term</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDesignationModalOpen(true)}>
            Add Designation
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setModalMode('create'); setSelectedOfficial(null); setModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Official
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categoryFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filter === 'all' ? 'All Categories' : filter === 'barangay' ? 'Barangay' : filter === 'sk' ? 'SK' : 'Staff'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filter === 'all' ? 'All Statuses' : filter === 'active' ? 'Active' : 'Inactive'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center"><p className="text-muted-foreground">Loading officials...</p></div>
      ) : filteredOfficials.length === 0 ? (
        <Empty title="No officials" description="Add officials to start managing barangay governance records." />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const items = groupedOfficials[group.key]
            if (items.length === 0) return null

            return (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">{group.title}</h2>
                  <Badge variant="outline">{items.length} official(s)</Badge>
                </div>

                <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profile Photo</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Contact Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Term Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((official) => {
                        const designation = official.designation || (official as any).designations || null
                        const isCaptain = isCaptainDesignation(designation?.name)

                        return (
                          <TableRow key={official.id} className={isCaptain ? 'bg-emerald-50/40' : ''}>
                            <TableCell>
                              {official.photo ? (
                                <Image src={official.photo} alt={official.fullName} width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                                  {official.fullName
                                    .split(' ')
                                    .map((part) => part[0])
                                    .slice(0, 2)
                                    .join('')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {official.fullName}
                                {isCaptain && <Badge className="bg-emerald-600 text-white">Top Priority</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge style={{ backgroundColor: normalizeBadgeColor(designation?.badgeColor), color: '#fff' }}>
                                {designation?.name || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>{designation ? getDesignationCategoryShortLabel(designation.category) : 'N/A'}</TableCell>
                            <TableCell>{official.contactNumber || 'N/A'}</TableCell>
                            <TableCell>{official.email || 'N/A'}</TableCell>
                            <TableCell>{getOfficialTermDuration(official.termStart, official.termEnd)}</TableCell>
                            <TableCell>
                              <Badge className={official.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-slate-500/10 text-slate-700 border-slate-500/20'}>
                                {getOfficialStatusLabel(official.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setSelectedOfficial(official); setModalMode('view'); setModalOpen(true) }}>
                                  <Eye className="mr-1 h-4 w-4" />
                                  View
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setSelectedOfficial(official); setModalMode('edit'); setModalOpen(true) }}>
                                  <Pencil className="mr-1 h-4 w-4" />
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => deleteOfficialById(official)}>
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
