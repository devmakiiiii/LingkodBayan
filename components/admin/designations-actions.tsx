'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { designationCategories, type DesignationCategory } from '@/lib/governance'
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
  onClose: () => void
  onSaved: () => void
}

export function DesignationActions({ isOpen, mode, designation, onClose, onSaved }: DesignationActionsProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DesignationCategory>('barangay')
  const [priorityOrder, setPriorityOrder] = useState('1')
  const [badgeColor, setBadgeColor] = useState('#28A745')
  const [isSaving, setIsSaving] = useState(false)
  const isEdit = mode === 'edit'

  useEffect(() => {
    if (isOpen && designation) {
      setName(designation.name)
      setCategory(designation.category)
      setPriorityOrder(String(designation.priorityOrder))
      setBadgeColor(designation.badgeColor)
      return
    }

    if (isOpen) {
      setName('')
      setCategory('barangay')
      setPriorityOrder('1')
      setBadgeColor('#28A745')
    }
  }, [isOpen, designation])

  const title = useMemo(() => (isEdit ? 'Edit Designation' : 'Add Designation'), [isEdit])

  async function handleSave() {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        name: name.trim(),
        category,
        priority_order: Number(priorityOrder),
        badge_color: badgeColor,
      }

      const { error } = isEdit
        ? await supabase.from('designations').update({ ...payload, updated_at: new Date() }).eq('id', designation?.id)
        : await supabase.from('designations').insert([payload])

      if (error) throw error

      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save designation:', error)
      alert(error instanceof Error ? error.message : 'Failed to save designation')
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
            Manage the designation name, category, sorting priority, and badge color.
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
            <Label htmlFor="priority-order">Priority Order</Label>
            <Input
              id="priority-order"
              type="number"
              min={1}
              value={priorityOrder}
              onChange={(event) => setPriorityOrder(event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="badge-color">Badge Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="badge-color"
                type="color"
                value={badgeColor}
                onChange={(event) => setBadgeColor(event.target.value)}
                className="h-11 w-20 p-1"
              />
              <Input value={badgeColor} onChange={(event) => setBadgeColor(event.target.value)} placeholder="#28A745" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving...' : 'Save Designation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
