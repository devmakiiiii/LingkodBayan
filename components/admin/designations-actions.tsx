'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { logAdminActionClient } from '@/lib/audit-log-client'
import {
  designationCategories,
  getDesignationBadgeColor,
  getNextRank,
  isRankTaken,
  type DesignationCategory,
  type RankedDesignationLike,
} from '@/lib/governance'
import type { DesignationInput } from '@/lib/schemas'

export type DesignationRecord = DesignationInput & {
  id: string
  created_at?: string
  updated_at?: string
}

interface DesignationActionsProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  designation: DesignationRecord | null
  /** All designations, used to derive the next rank and to detect clashes. */
  designations?: DesignationRecord[]
  onClose: () => void
  onSaved: () => void
}

export function DesignationActions({
  isOpen,
  mode,
  designation,
  designations = [],
  onClose,
  onSaved,
}: DesignationActionsProps) {
  // Blank means "auto-assign the next rank in this category" (migration 42).
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DesignationCategory>('barangay')
  const [rank, setRank] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const isEdit = mode === 'edit'

  useEffect(() => {
    if (isOpen && designation) {
      setName(designation.name)
      setCategory(designation.category)
      setRank(designation.rank === undefined || designation.rank === null ? '' : String(designation.rank))
      return
    }

    if (isOpen) {
      setName('')
      setCategory('barangay')
      setRank('')
    }
  }, [isOpen, designation])

  const title = useMemo(() => (isEdit ? 'Edit Designation' : 'Add Designation'), [isEdit])

  // What the record will end up with: the explicit override if typed, otherwise
  // the next free rank in the selected category.
  const resolvedRank = useMemo(() => {
    const trimmed = rank.trim()
    if (trimmed === '') return getNextRank(designations as RankedDesignationLike[], category)
    return Number(trimmed)
  }, [rank, category, designations])

  const rankConflict = useMemo(
    () => isRankTaken(
      designations as RankedDesignationLike[],
      category,
      rank.trim() === '' ? null : Number(rank),
      { excludeId: designation?.id ?? null },
    ),
    [designations, category, rank, designation?.id],
  )

  async function handleSave() {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const trimmed = rank.trim()
      const payload = {
        name: name.trim(),
        category,
        // Blank means auto: send the rank we previewed above rather than letting
        // Number('') coerce to 0, which would outrank the whole category.
        rank: trimmed === '' ? resolvedRank : Number(trimmed),
      }

      const { error } = isEdit
        ? await supabase.from('designations').update({ ...payload, updated_at: new Date() }).eq('id', designation?.id)
        : await supabase.from('designations').insert([payload])

      if (error) throw error

      // Reordering the hierarchy changes who gets assigned work first
      // (see suggestAssignee in lib/workload.ts), so a silent edit here would
      // quietly alter assignment behaviour with no record of who did it.
      void logAdminActionClient({
        action: isEdit ? 'designation_updated' : 'designation_created',
        resourceType: 'designation',
        resourceId: isEdit ? designation?.id : undefined,
        oldValues: isEdit && designation
          ? {
              name: designation.name,
              category: designation.category,
              rank: designation.rank ?? null,
            }
          : undefined,
        newValues: {
          name: payload.name,
          category: payload.category,
          rank: payload.rank,
        },
      })

      toast.success(isEdit ? 'Designation updated successfully' : 'Designation created successfully')
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save designation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save designation')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Manage the designation name, category, and rank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="designation-name">Designation Name</Label>
            <Input
              id="designation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Barangay Captain"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as DesignationCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {designationCategories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === 'barangay' ? 'Barangay Officials' : item === 'sk' ? 'SK Officials' : 'Staff'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation-rank">Rank</Label>
            <Input
              id="designation-rank"
              type="number"
              min={1}
              value={rank}
              onChange={(event) => setRank(event.target.value)}
              placeholder={`Auto (${resolvedRank})`}
              aria-invalid={rankConflict}
            />
            <p className="text-xs text-muted-foreground">
              {rankConflict ? (
                <span className="text-destructive">
                  Rank {resolvedRank} is already used in{' '}
                  {category === 'sk' ? 'SK' : category === 'barangay' ? 'Barangay' : 'Staff'}. Pick another number or
                  clear the field to auto-assign.
                </span>
              ) : rank.trim() === '' ? (
                <>Leave blank to assign automatically. Lower numbers rank higher; ranking is separate for each category.</>
              ) : (
                <>Lower numbers rank higher; ranking is separate for each category.</>
              )}
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Badge Preview</Label>
            <div className="flex items-center gap-3">
              <Badge className="text-white" style={{ backgroundColor: getDesignationBadgeColor(category) }}>
                {name.trim() || 'Designation name'}
              </Badge>
              <p className="text-xs text-muted-foreground">
                The badge color follows the category automatically (migration 43), so it always matches the group
                instead of being picked by hand.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSave} disabled={isSaving || !name.trim() || rankConflict}>
            {isSaving ? 'Saving...' : 'Save Designation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
