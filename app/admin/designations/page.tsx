'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { OfficialActions, type OfficialRecord } from '@/components/admin/officials-actions'
import { type DesignationRecord } from '@/components/admin/designations-actions'
import { getDesignationCategoryShortLabel, normalizeBadgeColor } from '@/lib/governance'

type OfficialRow = OfficialRecord & {
  designation?: DesignationRecord | null
}

const defaultDesignations = [
  { name: 'Barangay Captain', category: 'barangay', priority_order: 1, badge_color: '#166534' },
  { name: 'Barangay Kagawad', category: 'barangay', priority_order: 2, badge_color: '#28A745' },
  { name: 'Barangay Secretary', category: 'barangay', priority_order: 3, badge_color: '#0f766e' },
  { name: 'Barangay Treasurer', category: 'barangay', priority_order: 4, badge_color: '#0ea5e9' },
  { name: 'SK Chairperson', category: 'sk', priority_order: 1, badge_color: '#7c3aed' },
  { name: 'SK Kagawad', category: 'sk', priority_order: 2, badge_color: '#8b5cf6' },
  { name: 'Staff Member', category: 'staff', priority_order: 1, badge_color: '#6b7280' },
] as const

function mapOfficialRow(row: any): OfficialRow {
  const designationRow = row.designation || row.designations || null

  return {
    id: row.id,
    fullName: row.full_name,
    designationId: row.designation_id,
    contactNumber: row.contact_number,
    email: row.email,
    termStart: row.term_start,
    termEnd: row.term_end,
    status: row.status,
    photo: row.photo,
    created_at: row.created_at,
    updated_at: row.updated_at,
    designation: designationRow
      ? {
          id: designationRow.id,
          name: designationRow.name,
          category: designationRow.category,
          priorityOrder: designationRow.priority_order,
          badgeColor: designationRow.badge_color,
          created_at: designationRow.created_at,
          updated_at: designationRow.updated_at,
        }
      : null,
  }
}

export default function AdminDesignationsPage() {
  const [officials, setOfficials] = useState<OfficialRow[]>([])
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OfficialRow | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoadError('')
      const supabase = createClient()
      const [{ data: designationData, error: designationError }, { data: officialData, error: officialError }] = await Promise.all([
        supabase.from('designations').select('*').order('priority_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('officials').select('*, designations(id, name, category, priority_order, badge_color)').order('created_at', { ascending: false }),
      ])

      if (designationError) throw designationError
      if (officialError) throw officialError

      if (!designationData || designationData.length === 0) {
        const { error: seedError } = await supabase
          .from('designations')
          .upsert(defaultDesignations, { onConflict: 'name,category' })

        if (seedError) throw seedError

        const { data: seededDesignations, error: refetchError } = await supabase
          .from('designations')
          .select('*')
          .order('priority_order', { ascending: true })
          .order('name', { ascending: true })

        if (refetchError) throw refetchError

        setDesignations((seededDesignations || []) as DesignationRecord[])
      } else {
        setDesignations((designationData || []) as DesignationRecord[])
      }

      setOfficials((officialData || []).map(mapOfficialRow))
    } catch (error) {
      console.error('Error loading officials:', error)
      setLoadError(error instanceof Error ? error.message : 'Failed to load official records')
    } finally {
      setLoading(false)
    }
  }

  const filteredOfficials = useMemo(() => {
    const query = search.trim().toLowerCase()

    return officials.filter((official) => {
      const designation = official.designation || null

      if (!query) return true

      return (
        official.fullName.toLowerCase().includes(query) ||
        (designation?.name || '').toLowerCase().includes(query) ||
        (designation?.category || '').toLowerCase().includes(query)
      )
    })
  }, [officials, search])

  async function deleteOfficialById(official: OfficialRow) {
    try {
      const confirmed = window.confirm(`Delete ${official.fullName}? This action cannot be undone.`)
      if (!confirmed) return

      const supabase = createClient()
      const { error } = await supabase.from('officials').delete().eq('id', official.id)
      if (error) throw error

      setDeleteTarget(null)
      loadData()
    } catch (error) {
      console.error('Error deleting official:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete official')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <OfficialActions
        isOpen={isModalOpen}
        mode={modalMode}
        official={selectedOfficial}
        designations={designations}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedOfficial(null)
        }}
        onSaved={loadData}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Official</DialogTitle>
            <DialogDescription>
              This will permanently remove the official record.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteTarget && deleteOfficialById(deleteTarget)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Official Records</h1>
          <p className="mt-2 text-muted-foreground">Manage the officials listed in the barangay records.</p>
        </div>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => {
            setModalMode('create')
            setSelectedOfficial(null)
            setIsModalOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Official
        </Button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search official, designation, or category"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Loading official records...</p>
        </div>
      ) : filteredOfficials.length === 0 ? (
        <Empty title="No official records" description="Add officials to populate this list." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Official Name</TableHead>
                <TableHead>Designation Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority Order</TableHead>
                <TableHead>Badge Color</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfficials.map((official) => {
                const designation = official.designation || null

                return (
                  <TableRow key={official.id}>
                    <TableCell className="font-medium">{official.fullName}</TableCell>
                    <TableCell>{designation?.name || 'N/A'}</TableCell>
                    <TableCell>{getDesignationCategoryShortLabel(designation?.category)}</TableCell>
                    <TableCell>{designation?.priorityOrder ?? 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className="text-white" style={{ backgroundColor: normalizeBadgeColor(designation?.badgeColor) }}>
                        {designation?.badgeColor || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setModalMode('edit')
                            setSelectedOfficial(official)
                            setIsModalOpen(true)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                          onClick={() => setDeleteTarget(official)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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
      )}
    </div>
  )
}
