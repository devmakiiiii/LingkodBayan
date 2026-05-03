'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { DesignationActions, type DesignationRecord } from '@/components/admin/designations-actions'
import { getDesignationCategoryLabel, normalizeBadgeColor } from '@/lib/governance'

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

export default function AdminDesignationsPage() {
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedDesignation, setSelectedDesignation] = useState<DesignationRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DesignationRecord | null>(null)

  useEffect(() => {
    loadDesignations()
  }, [])

  async function loadDesignations() {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('designations')
        .select('*')
        .order('priority_order', { ascending: true })
        .order('name', { ascending: true })

      setDesignations((data || []).map(mapDesignationRow))
    } catch (error) {
      console.error('Error loading designations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteDesignationById(designation: DesignationRecord) {
    try {
      const supabase = createClient()
      const { count } = await supabase
        .from('officials')
        .select('id', { count: 'exact', head: true })
        .eq('designation_id', designation.id)

      if ((count || 0) > 0) {
        alert('Cannot delete this designation because it is currently assigned to an official.')
        return
      }

      const confirmed = window.confirm(`Delete designation "${designation.name}"? This action cannot be undone.`)
      if (!confirmed) return

      const { error } = await supabase.from('designations').delete().eq('id', designation.id)
      if (error) throw error

      setDeleteTarget(null)
      loadDesignations()
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
        onSaved={loadDesignations}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Designation</DialogTitle>
            <DialogDescription>
              This will remove the designation only if it is not assigned to any official.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => deleteTarget && deleteDesignationById(deleteTarget)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Designations</h1>
          <p className="text-muted-foreground mt-2">Manage official roles, priority order, and badge colors</p>
        </div>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setModalMode('create'); setSelectedDesignation(null); setIsModalOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Designation
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-muted-foreground">Loading designations...</p></div>
      ) : designations.length === 0 ? (
        <Empty title="No designations" description="Create your first designation to start managing officials." />
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
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
              {designations.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell className="font-medium">{designation.name}</TableCell>
                  <TableCell>{getDesignationCategoryLabel(designation.category)}</TableCell>
                  <TableCell>{designation.priorityOrder}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: normalizeBadgeColor(designation.badgeColor), color: '#fff' }}>
                      {designation.badgeColor}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setModalMode('edit'); setSelectedDesignation(designation); setIsModalOpen(true) }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteTarget(designation)}>
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
