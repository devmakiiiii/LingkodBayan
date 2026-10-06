'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DesignationActions, type DesignationRecord } from '@/components/admin/designations-actions'
import { getDesignationCategoryShortLabel, getDesignationBadgeColor } from '@/lib/governance'
import { logAdminActionClient } from '@/lib/audit-log-client'

const defaultDesignations = [
  { name: 'Barangay Captain', category: 'barangay', rank: 1 },
  { name: 'Barangay Kagawad', category: 'barangay', rank: 2 },
  { name: 'Barangay Secretary', category: 'barangay', rank: 3 },
  { name: 'Barangay Treasurer', category: 'barangay', rank: 4 },
  { name: 'SK Chairperson', category: 'sk', rank: 1 },
  { name: 'SK Kagawad', category: 'sk', rank: 2 },
  { name: 'Staff Member', category: 'staff', rank: 1 },
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
        .order('rank', { ascending: true })
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
          .order('rank', { ascending: true })
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
      rank: row.rank,
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
      const supabase = createClient()
      const { error } = await supabase.from('designations').delete().eq('id', designation.id)
      
      if (error) {
        if (error.code === '23503') {
          toast.error('Cannot delete this designation because it is currently assigned to one or more officials.')
          return
        }
        throw error
      }

      // Deleting a designation removes an office from the hierarchy, which
      // changes assignment order just as surely as re-ranking does.
      void logAdminActionClient({
        action: 'designation_deleted',
        resourceType: 'designation',
        resourceId: designation.id,
        oldValues: {
          name: designation.name,
          category: designation.category,
          rank: designation.rank ?? null,
        },
      })

      toast.success(`${designation.name} has been deleted.`)
      setDeleteTarget(null)
      loadData()
    } catch (error) {
      console.error('Error deleting designation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete designation')
    }
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <DesignationActions
        isOpen={isModalOpen}
        mode={modalMode}
        designation={selectedDesignation}
        designations={designations}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedDesignation(null)
        }}
        onSaved={loadData}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Designation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the designation. It will fail if officials are still assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteDesignationById(deleteTarget)}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Designations</h1>
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

      <div className="rounded-2xl border border-emerald-100 bg-white dark:bg-card p-4 shadow-sm">
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
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : filteredDesignations.length === 0 ? (
        <Empty title="No designations found" description="Add designations to populate this list." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white dark:bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Designation Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDesignations.map((designation) => (
                <TableRow key={designation.id}>
                  <TableCell className="font-medium">
                    <Badge
                      className="text-white"
                      style={{ backgroundColor: getDesignationBadgeColor(designation.category) }}
                    >
                      {designation.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{getDesignationCategoryShortLabel(designation.category)}</TableCell>
                  <TableCell>{designation.rank}</TableCell>
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
