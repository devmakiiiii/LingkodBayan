'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getDesignationCategoryShortLabel, getOfficialStatusLabel, isCaptainDesignation } from '@/lib/governance'
import type { OfficialInput } from '@/lib/schemas'
import type { DesignationRecord } from '@/components/admin/designations-actions'

export type OfficialRecord = OfficialInput & {
  id: string
  created_at?: string
  updated_at?: string
  designation?: DesignationRecord | null
}

interface OfficialActionsProps {
  isOpen: boolean
  mode: 'create' | 'edit' | 'view'
  official: OfficialRecord | null
  designations: DesignationRecord[]
  onClose: () => void
  onSaved: () => void
}

async function uploadOfficialPhoto(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/admin/official-photos', {
    method: 'POST',
    body: formData,
  })

  const payload = (await response.json()) as { url?: string; error?: string }

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to upload official photo')
  }

  if (!payload.url) {
    throw new Error('Failed to upload official photo')
  }

  return payload.url
}

function formatSaveError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const supabaseError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    return supabaseError.message || supabaseError.details || supabaseError.hint || supabaseError.code || 'Failed to save official'
  }

  return 'Failed to save official'
}

function RequiredLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-rose-600">*</span>
    </Label>
  )
}

function RequiredValueLabel({ children }: { children: string }) {
  return (
    <Label>
      {children} <span className="text-rose-600">*</span>
    </Label>
  )
}

export function OfficialActions({ isOpen, mode, official, designations, onClose, onSaved }: OfficialActionsProps) {
  const [fullName, setFullName] = useState('')
  const [designationId, setDesignationId] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [photo, setPhoto] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isView = mode === 'view'

  useEffect(() => {
    if (isOpen && official) {
      setFullName(official.fullName)
      setDesignationId(official.designationId)
      setContactNumber(official.contactNumber || '')
      setEmail(official.email || '')
      setTermStart(official.termStart || '')
      setTermEnd(official.termEnd || '')
      setStatus(official.status)
      setPhoto(official.photo || '')
      setPhotoFile(null)
      return
    }

    if (isOpen) {
      setFullName('')
      setDesignationId(designations[0]?.id || '')
      setContactNumber('')
      setEmail('')
      setTermStart('')
      setTermEnd('')
      setStatus('active')
      setPhoto('')
      setPhotoFile(null)
    }
  }, [isOpen, official, designations])

  const selectedDesignation = useMemo(
    () => designations.find((designation) => designation.id === designationId) || null,
    [designationId, designations],
  )

  const hasRequiredPhoto = Boolean(photoFile || photo)
  const canSave = Boolean(
    fullName.trim() &&
    designationId &&
    contactNumber.trim() &&
    email.trim() &&
    termStart &&
    termEnd &&
    hasRequiredPhoto,
  )

  const categoryLabel = selectedDesignation
    ? getDesignationCategoryShortLabel(selectedDesignation.category)
    : 'Unknown'

  const title = mode === 'create' ? 'Add Official' : isView ? 'Official Details' : 'Edit Official'

  async function handleSave() {
    if (!canSave) {
      alert('Complete all required fields before saving the official.')
      return
    }

    setIsSaving(true)
    try {
      let nextPhoto = photo
      if (photoFile) {
        nextPhoto = await uploadOfficialPhoto(photoFile)
      }

      const supabase = createClient()
      const payload = {
        full_name: fullName.trim(),
        designation_id: designationId,
        contact_number: contactNumber || null,
        email: email || null,
        term_start: termStart || null,
        term_end: termEnd || null,
        status,
        photo: nextPhoto || null,
      }

      const { error } = mode === 'edit'
        ? await supabase.from('officials').update({ ...payload, updated_at: new Date() }).eq('id', official?.id)
        : await supabase.from('officials').insert([payload])

      if (error) throw error

      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save official:', error)
      alert(formatSaveError(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (isView && official) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Preview the official record and designation linkage.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-[160px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
              {official.photo ? (
                <img src={official.photo} alt={official.fullName} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No photo</div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Full Name</p>
                <p className="text-lg font-semibold">{official.fullName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Designation</p>
                <p className="font-medium">{official.designation?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                <p className="font-medium">{categoryLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                <p className="font-medium">{official.contactNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="font-medium">{official.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Term</p>
                <p className="font-medium">{(official.termStart || '').replaceAll('-', '/')} - {(official.termEnd || '').replaceAll('-', '/')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="font-medium">{getOfficialStatusLabel(official.status)}</p>
              </div>
              {isCaptainDesignation(official.designation?.name) && (
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Top Priority
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Officials choose a designation from the dropdown. Category is derived automatically from the selected designation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="official-photo">Profile Photo</RequiredLabel>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-dashed border-emerald-200 bg-emerald-50">
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} alt="Preview" className="h-full w-full object-cover" />
                ) : photo ? (
                  <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Photo</div>
                )}
              </div>
                <Input
                id="official-photo"
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                  required
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="official-name">Full Name</RequiredLabel>
            <Input id="official-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Juan Dela Cruz" required />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Designation</RequiredLabel>
            <Select value={designationId} onValueChange={setDesignationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                {designations.map((designation) => (
                  <SelectItem key={designation.id} value={designation.id}>
                    {designation.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={categoryLabel} readOnly className="bg-muted" />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-contact">Contact Number</RequiredLabel>
            <Input id="official-contact" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="09xx xxx xxxx" required />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-email">Email Address</RequiredLabel>
            <Input id="official-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-term-start">Term Start Date</RequiredLabel>
            <Input id="official-term-start" type="date" value={termStart} onChange={(event) => setTermStart(event.target.value)} required />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-term-end">Term End Date</RequiredLabel>
            <Input id="official-term-end" type="date" value={termEnd} onChange={(event) => setTermEnd(event.target.value)} required />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 md:col-span-2">
            <div>
              <RequiredValueLabel>Status</RequiredValueLabel>
              <p className="text-sm text-muted-foreground">Toggle Active / Inactive</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Inactive</span>
              <Switch checked={status === 'active'} onCheckedChange={(checked) => setStatus(checked ? 'active' : 'inactive')} />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving ? 'Saving...' : 'Save Official'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fields marked with <span className="text-rose-600">*</span> are required.
        </p>
      </DialogContent>
    </Dialog>
  )
}
