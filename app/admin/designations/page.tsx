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
import { DesignationActions, type DesignationRecord } from '@/components/admin/designations-actions'
import { getDesignationCategoryShortLabel, normalizeBadgeColor } from '@/lib/governance'

const defaultDesignations = [
  { name: 'Barangay Captain', category: 'barangay', priority_order: 1, badge_color: '#166534' },
  { name: 'Barangay Kagawad', category: 'barangay', priority_order: 2, badge_color: '#28A745' },
  { name: 'Barangay Secretary', category: 'barangay', priority_order: 3, badge_color: '#0f766e' },
  { name: 'Barangay Treasurer', category: 'barangay', priority_order: 4, badge_color: '#0ea5e9' },
  { name: 'SK Chairperson', category: 'sk', priority_order: 1, badge_color: '#7c3aed' },
  { name: 'SK Kagawad', category: 'sk', priority_order: 2, badge_color: '#8b5cf6' },
  { name: 'Staff Member', category: 'staff', priority_order: 1, badge_color: '#6b7280' },
] as const

export default function AdminDesignationsPage() {
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedDesignation, setSelectedDesignation] = useState<DesignationRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DesignationRecord | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoadError('')
      const supabase = createClient()
      const { data: designationData, error: designationError } = await supabase
        .from('designations')
        .select('*')
        .order('priority_order', { ascending: true })
        .order('name', { ascending: true })

      if (designationError) throw designationError

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

        setDesignations((seededDesignations || []).map(mapDesignationRow))
      } else {
        setDesignations((designationData || []).map(mapDesignationRow))
      }
    } catch (error) {
      console.error('Error loading designations:', error)
      setLoadError(error instanceof Error ? error.message : 'Failed to load designations')
    } finally {
      setLoading(false)
    }
  }

  function mapDesignationRow(row: any): DesignationRecord {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      priorityOrder: row.priority_order,
      badgeColor: row.badge_color,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }

  const filteredDesignations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return designations

    return designations.filter((designation) => {
      return (
        designation.name.toLowerCase().includes(query) ||
        designation.category.toLowerCase().includes(query)
      )
    })
  }, [designations, search])

  async function deleteDesignationById(designation: DesignationRecord) {
    try {
      const confirmed = window.confirm(`Delete ${designation.name}? This action cannot be undone and will fail if there are officials assigned to this designation.`)
      if (!confirmed) return

      const supabase = createClient()
      const { error } = await supabase.from('designations').delete().eq('id', designation.id)
      
      if (error) {
        if (error.code === '23503') { // Foreign key constraint violation
          throw new Error('Cannot delete this designation because it is currently assigned to one or more officials. Please reassign or delete the officials first.')
        }
        throw error
      }

      setDeleteTarget(null)
      loadData()
    } catch (error) {
      console.error('Error deleting designation:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete designation')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <DesignationActions
        isOpen={isModalOpen}
        mode={modalMode}
        designation={selectedDesignation}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedDesignation(null)
        }}
        onSaved={loadData}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Designation</DialogTitle>
            <DialogDescription>
              This will permanently remove the designation. It will fail if officials are still assigned to it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => deleteTarget && deleteDesignationById(deleteTarget)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Designations</h1>
          <p className="mt-2 text-muted-foreground">Manage official titles, roles, and categories in the barangay.</p>
        </div>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => {
            setModalMode('create')
            setSelectedDesignation(null)
            setIsModalOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Designation
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
            placeholder="Search by name or category..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Loading designations...</p>
        </div>
      ) : filteredDesignations.length === 0 ? (
        <Empty title="No designations found" description="Add designations to populate this list." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Designation Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority Order</TableHead>
                <TableHead>Badge Color</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDesignations.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell className="font-medium">{designation.name}</TableCell>
                  <TableCell>{getDesignationCategoryShortLabel(designation.category)}</TableCell>
                  <TableCell>{designation.priorityOrder}</TableCell>
                  <TableCell>
                    <Badge className="text-white" style={{ backgroundColor: normalizeBadgeColor(designation.badgeColor) }}>
                      {designation.badgeColor}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setModalMode('edit')
                          setSelectedDesignation(designation)
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
                        onClick={() => setDeleteTarget(designation)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
