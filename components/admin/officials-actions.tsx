'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  designationCategories,
  getDesignationCategoryShortLabel,
  getOfficialTermDuration,
  isCaptainDesignation,
} from '@/lib/governance'
import { officialSchema } from '@/lib/schemas'
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
  officials: OfficialRecord[]
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

// Extracts the object name from a public bucket URL so the file can be
// removed again later.
function officialPhotoPathFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    return last ? decodeURIComponent(last) : null
  } catch {
    return null
  }
}

async function deleteOfficialPhoto(url: string) {
  const path = officialPhotoPathFromUrl(url)
  if (!path) return

  const response = await fetch('/api/admin/official-photos', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error || 'Failed to remove official photo')
  }
}

// Cleanup is best-effort: the official record is already correct by this
// point, and a stranded file is preferable to surfacing a confusing error.
async function removeStoredPhotoBestEffort(url: string, context: string) {
  try {
    await deleteOfficialPhoto(url)
  } catch (error) {
    console.warn(`Failed to remove ${context}:`, error)
  }
}

// Rolls back a half-created official after a failed photo upload. Returns the
// Supabase error, or null when the cleanup succeeded.
async function rollbackCreatedOfficial(officialId?: string) {
  if (!officialId) return new Error('New official record has no id')

  const supabase = createClient()
  const { error } = await supabase.from('officials').delete().eq('id', officialId)
  return error
}

// Formats a Date as YYYY-MM-DD for <input type="date"> using the local
// timezone (toISOString() uses UTC and could shift the day).
function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Calendar-safe "N years later": clamps Feb 29 to Feb 28 in non-leap target
// years, where plain Date arithmetic would roll over into March.
function plusYears(date: Date, years: number) {
  const result = new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
  if (result.getMonth() !== date.getMonth()) {
    result.setDate(0)
  }
  return result
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

type FieldErrorKey = 'photo' | 'fullName' | 'firstName' | 'middleInitial' | 'lastName' | 'designationId' | 'contactNumber' | 'email' | 'termStart' | 'termEnd'

type FieldErrors = Partial<Record<FieldErrorKey, string>>

// Same ceiling as the upload route (app/api/admin/official-photos/route.ts).
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

interface FormSnapshot {
  firstName: string
  middleInitial: string
  lastName: string
  suffix: string
  designationId: string
  contactNumber: string
  email: string
  termStart: string
  termEnd: string
  photo: string
  photoFileKey: string
}

function photoFileKey(file: File | null) {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : ''
}

function serializeSnapshot(state: FormSnapshot) {
  return JSON.stringify(state)
}

// Composes the display string every existing query reads (`full_name`) from the
// structured parts, so nothing downstream (reports, dashboard, dropdowns) has
// to change.
function composeFullName(input: { firstName: string; middleInitial: string; lastName: string; suffix: string }) {
  return [input.firstName.trim(), input.middleInitial.trim(), input.lastName.trim(), input.suffix.trim()]
    .filter(Boolean)
    .join(' ')
}

// Officials are recorded with a middle initial only, so whatever is typed is
// coerced to a single capitalised letter plus a period ("s", "S" and "S." all
// become "S.").
function normalizeMiddleInitialInput(value: string) {
  const letter = value.replace(/[^A-Za-z]/g, '').charAt(0)
  return letter ? `${letter.toUpperCase()}.` : ''
}

function normalizeName(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// officialSchema is the source of truth for field formats, but it deliberately
// allows an empty contact/email/photo because other callers treat them as
// optional. This form requires all three, so those rules are layered on top of
// the schema's checks, together with the term-date ordering rule the schema
// does not cover.
function collectFieldErrors(input: {
  firstName: string
  middleInitial: string
  lastName: string
  suffix: string
  designationId: string
  contactNumber: string
  email: string
  termStart: string
  termEnd: string
  photo: string
  hasPhotoFile: boolean
  status: 'active' | 'archived'
}): FieldErrors {
  const errors: FieldErrors = {}

  const parsed = officialSchema.safeParse({
    fullName: composeFullName(input),
    firstName: input.firstName.trim(),
    middleInitial: input.middleInitial.trim(),
    lastName: input.lastName.trim(),
    suffix: input.suffix.trim(),
    designationId: input.designationId,
    contactNumber: input.contactNumber.trim(),
    email: input.email.trim(),
    termStart: input.termStart,
    termEnd: input.termEnd,
    status: input.status,
    photo: input.photo,
  })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as FieldErrorKey | undefined
      if (key && !errors[key]) {
        errors[key] = issue.message
      }
    }
  }

  const contactNumber = input.contactNumber.trim()
  if (!contactNumber) {
    errors.contactNumber = 'Contact number is required'
  } else if (contactNumber.length < 5 || !/^[0-9+()\-\s]+$/.test(contactNumber)) {
    errors.contactNumber = 'Enter a valid contact number'
  }

  if (!input.email.trim()) {
    errors.email = 'Email address is required'
  }

  if (!input.hasPhotoFile && !input.photo) {
    errors.photo = 'Profile photo is required'
  }

  if (!input.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!input.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  if (input.termStart && input.termEnd && input.termEnd < input.termStart) {
    errors.termEnd = 'Term end date must be on or after the term start date'
  }

  return errors
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <p className="text-xs text-rose-600" role="alert">
      {message}
    </p>
  )
}

// Duplicate detection runs client-side against the officials list the page has
// already loaded: it avoids an extra round trip and the case-sensitivity and
// comma-escaping pitfalls of PostgREST `.or()` filters.
function findDuplicateOfficial(
  officials: OfficialRecord[],
  input: {
    fullName: string
    firstName: string
    lastName: string
    designationId: string
    email: string
    excludeId?: string
  },
): OfficialRecord | null {
  const email = input.email.trim().toLowerCase()

  // An email match is the strongest signal, so report it first.
  if (email) {
    const emailMatch = officials.find(
      (candidate) =>
        candidate.id !== input.excludeId &&
        (candidate.email || '').trim().toLowerCase() === email,
    )
    if (emailMatch) return emailMatch
  }

  const inputFullName = normalizeName(input.fullName)
  if (!inputFullName) return null

  // Same name + same designation. The composed display name catches legacy rows;
  // when both sides carry structured parts, surname + given name also catches
  // formatting variants such as a missing or extra middle initial.
  const inputIdentity = `${normalizeName(input.lastName)} ${normalizeName(input.firstName)}`.trim()

  return (
    officials.find((candidate) => {
      if (candidate.id === input.excludeId) return false
      if (candidate.designationId !== input.designationId) return false

      if (normalizeName(candidate.fullName) === inputFullName) return true

      const candidateIdentity = `${normalizeName(candidate.lastName)} ${normalizeName(candidate.firstName)}`.trim()
      return Boolean(inputIdentity && candidateIdentity === inputIdentity)
    }) || null
  )
}

function describeDuplicateMatch(match: OfficialRecord) {
  const designationName = match.designation?.name || 'unknown designation'
  const status = match.status === 'archived' ? 'archived' : 'active'
  return `"${match.fullName}" (${designationName}, ${status})`
}

function RequiredLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-rose-600">*</span>
    </Label>
  )
}

export function OfficialActions({ isOpen, mode, official, designations, officials, onClose, onSaved }: OfficialActionsProps) {
  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [designationId, setDesignationId] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [photo, setPhoto] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const initialSnapshotRef = useRef('')
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const duplicateAckRef = useRef(false)
  const isView = mode === 'view'

  useEffect(() => {
    if (isOpen && official) {
      setFirstName(official.firstName || '')
      setMiddleInitial(official.middleInitial || '')
      setLastName(official.lastName || '')
      setSuffix(official.suffix || '')
      setDesignationId(official.designationId)
      setContactNumber(official.contactNumber || '')
      setEmail(official.email || '')
      setTermStart(official.termStart || '')
      setTermEnd(official.termEnd || '')
      setPhoto(official.photo || '')
      setPhotoFile(null)
      setErrors({})
      setConfirmDiscard(false)
      setDuplicateWarning(null)
      duplicateAckRef.current = false
      initialSnapshotRef.current = serializeSnapshot({
        firstName: official.firstName || '',
        middleInitial: official.middleInitial || '',
        lastName: official.lastName || '',
        suffix: official.suffix || '',
        designationId: official.designationId,
        contactNumber: official.contactNumber || '',
        email: official.email || '',
        termStart: official.termStart || '',
        termEnd: official.termEnd || '',
        photo: official.photo || '',
        photoFileKey: '',
      })
      return
    }

    if (isOpen) {
      const emptySnapshot: FormSnapshot = {
        firstName: '',
        middleInitial: '',
        lastName: '',
        suffix: '',
        designationId: '',
        contactNumber: '',
        email: '',
        termStart: '',
        termEnd: '',
        photo: '',
        photoFileKey: '',
      }
      // Start with no designation preselected so a high-priority designation
      // (the first entry is priority order 1) is never assigned by accident.
      setFirstName(emptySnapshot.firstName)
      setMiddleInitial(emptySnapshot.middleInitial)
      setLastName(emptySnapshot.lastName)
      setSuffix(emptySnapshot.suffix)
      setDesignationId(emptySnapshot.designationId)
      setContactNumber(emptySnapshot.contactNumber)
      setEmail(emptySnapshot.email)
      setTermStart(emptySnapshot.termStart)
      setTermEnd(emptySnapshot.termEnd)
      setPhoto(emptySnapshot.photo)
      setPhotoFile(null)
      setErrors({})
      setConfirmDiscard(false)
      setDuplicateWarning(null)
      duplicateAckRef.current = false
      initialSnapshotRef.current = serializeSnapshot(emptySnapshot)
    }
  }, [isOpen, official, designations])

  // Revoke the object URL for a picked photo so repeated open/close cycles do
  // not leak memory.
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const selectedDesignation = useMemo(
    () => designations.find((designation) => designation.id === designationId) || null,
    [designationId, designations],
  )

  // Group the designation dropdown by category (Barangay / SK / Staff) so the
  // list stays scannable as more designations are added.
  const designationGroups = useMemo(
    () =>
      designationCategories
        .map((category) => ({
          category,
          label: getDesignationCategoryShortLabel(category),
          items: designations.filter((designation) => designation.category === category),
        }))
        .filter((group) => group.items.length > 0),
    [designations],
  )

  const categoryLabel = selectedDesignation
    ? getDesignationCategoryShortLabel(selectedDesignation.category)
    : 'Unknown'

  const title = mode === 'create' ? 'Add Official' : isView ? 'Official Details' : 'Edit Official'

  const composedName = composeFullName({ firstName, middleInitial, lastName, suffix })

  // Rows created before migration 41 carry no structured name parts; nudging the
  // admin to fill them in on the next save quietly backfills the record.
  const isLegacyNameRecord =
    mode === 'edit' && Boolean(official) && !(official?.firstName && official?.lastName)

  function clearError(key: FieldErrorKey) {
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    if (!file) {
      setPhotoFile(null)
      clearError('photo')
      return
    }

    // Mirror the limits enforced by app/api/admin/official-photos/route.ts so
    // bad files are rejected before the upload round trip.
    if (!file.type.startsWith('image/')) {
      event.target.value = ''
      toast.error('Profile photo must be an image file.')
      return
    }

    if (file.size > MAX_PHOTO_BYTES) {
      event.target.value = ''
      toast.error('Profile photo must be less than 5MB.')
      return
    }

    setPhotoFile(file)
    clearError('photo')
  }

  function removePhoto() {
    setPhoto('')
    setPhotoFile(null)
    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
    clearError('photo')
  }

  function fillThreeYearTerm() {
    const start = new Date()
    setTermStart(toDateInputValue(start))
    setTermEnd(toDateInputValue(plusYears(start, 3)))
    clearError('termStart')
    clearError('termEnd')
  }

  function forceClose() {
    setConfirmDiscard(false)
    setErrors({})
    onClose()
  }

  function requestClose() {
    if (isSaving) return

    // Compare against the snapshot taken when the dialog opened so Escape or
    // outside-clicks cannot silently throw away edits.
    const currentSnapshot = serializeSnapshot({
      firstName,
      middleInitial,
      lastName,
      suffix,
      designationId,
      contactNumber,
      email,
      termStart,
      termEnd,
      photo,
      photoFileKey: photoFileKey(photoFile),
    })

    if (currentSnapshot !== initialSnapshotRef.current) {
      setConfirmDiscard(true)
      return
    }
    forceClose()
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) requestClose()
  }

  function handleSaveAnyway() {
    duplicateAckRef.current = true
    setDuplicateWarning(null)
    void handleSave()
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (isSaving) return

    const nextErrors = collectFieldErrors({
      firstName,
      middleInitial,
      lastName,
      suffix,
      designationId,
      contactNumber,
      email,
      termStart,
      termEnd,
      photo,
      hasPhotoFile: Boolean(photoFile),
      status: official?.status === 'archived' ? 'archived' : 'active',
    })
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted fields before saving.')
      return
    }

    // Guard against saving the same person twice (same email, or same name +
    // designation). The first attempt only warns; "Save anyway" in the banner
    // acknowledges the attempt and lets it through.
    const duplicate = findDuplicateOfficial(officials, {
      fullName: composedName,
      firstName,
      lastName,
      designationId,
      email,
      excludeId: mode === 'edit' ? official?.id : undefined,
    })

    if (duplicate && !duplicateAckRef.current) {
      const emailMatches =
        (duplicate.email || '').trim().toLowerCase() === email.trim().toLowerCase()
      const reason = emailMatches
        ? `Email ${email.trim()} is already used by ${describeDuplicateMatch(duplicate)}.`
        : `${describeDuplicateMatch(duplicate)} already has this name and designation.`
      const archivedHint =
        duplicate.status === 'archived' ? ' Consider restoring that record instead.' : ''
      setDuplicateWarning(`${reason}${archivedHint}`)
      return
    }

    duplicateAckRef.current = false
    setDuplicateWarning(null)

    setIsSaving(true)
    try {
      const supabase = createClient()
      const fields = {
        // full_name stays the display column every existing query reads; the
        // structured parts ride alongside it (migration 41).
        full_name: composedName,
        first_name: firstName.trim() || null,
        middle_initial: middleInitial.trim() || null,
        last_name: lastName.trim() || null,
        suffix: suffix.trim() || null,
        designation_id: designationId,
        contact_number: contactNumber.trim() || null,
        email: email.trim() || null,
        term_start: termStart || null,
        term_end: termEnd || null,
        status: official?.status === 'archived' ? 'archived' : 'active',
      }

      if (mode === 'edit') {
        // Upload the replacement photo first. If the update then fails, the
        // freshly uploaded file is removed again so it cannot be stranded in
        // the public bucket.
        const uploadedUrl = photoFile ? await uploadOfficialPhoto(photoFile) : null
        const payload = { ...fields, photo: uploadedUrl ?? (photo.trim() || null) }
        const { error } = await supabase
          .from('officials')
          .update({ ...payload, updated_at: new Date() })
          .eq('id', official?.id)

        if (error) {
          if (uploadedUrl) {
            await removeStoredPhotoBestEffort(uploadedUrl, 'a replaced official photo')
          }
          throw error
        }

        // The previous photo was replaced or removed; clear it out of the bucket.
        const previousPhoto = official?.photo || null
        if (previousPhoto && previousPhoto !== payload.photo) {
          await removeStoredPhotoBestEffort(previousPhoto, 'the previous official photo')
        }
      } else {
        // Insert without the photo first so a failed upload can roll the new
        // row back instead of leaving an orphaned file in the public bucket.
        const { data: inserted, error: insertError } = await supabase
          .from('officials')
          .insert([{ ...fields, photo: null }])
          .select('id')
          .maybeSingle()

        if (insertError) throw insertError

        if (photoFile) {
          let uploadedUrl: string
          try {
            uploadedUrl = await uploadOfficialPhoto(photoFile)
          } catch (uploadError) {
            const rollbackError = await rollbackCreatedOfficial(inserted?.id)
            if (rollbackError) {
              throw new Error(
                `Photo upload failed (${formatSaveError(uploadError)}) and the new record could not be removed. Edit the official to attach the photo.`,
              )
            }
            throw new Error(`Photo upload failed, so nothing was saved. ${formatSaveError(uploadError)}`)
          }

          const { error: photoError } = await supabase
            .from('officials')
            .update({ photo: uploadedUrl })
            .eq('id', inserted?.id)

          if (photoError) {
            await removeStoredPhotoBestEffort(uploadedUrl, 'a failed official photo upload')
            const rollbackError = await rollbackCreatedOfficial(inserted?.id)
            if (rollbackError) {
              throw new Error(
                `The photo could not be attached (${photoError.message}) and the new record could not be removed. Edit the official to attach the photo.`,
              )
            }
            throw new Error(`The photo could not be attached, so nothing was saved. ${photoError.message}`)
          }
        }
      }

      toast.success(mode === 'edit' ? 'Official updated successfully' : 'Official added successfully')
      setErrors({})
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save official:', error)
      toast.error(formatSaveError(error))
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
              {isCaptainDesignation(official.designation?.name) && (
                <div className="flex items-center">
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Top Priority
                  </span>
                </div>
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
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Officials choose a designation from the dropdown. Category is derived automatically from the selected designation.
          </DialogDescription>
        </DialogHeader>

        {duplicateWarning && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p className="font-semibold">Possible duplicate record</p>
            <p className="mt-1">{duplicateWarning}</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setDuplicateWarning(null)}>
                Back to edit
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={handleSaveAnyway}
              >
                Save anyway
              </Button>
            </div>
          </div>
        )}

        <form noValidate onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <RequiredLabel htmlFor="official-photo">Profile Photo</RequiredLabel>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border border-dashed border-emerald-200 bg-emerald-50">
                {photoFile && photoPreviewUrl ? (
                  <img src={photoPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : photo ? (
                  <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Photo</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Input
                  ref={photoInputRef}
                  id="official-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.photo)}
                />
                <p className="text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>
                <FieldError message={errors.photo} />
              </div>
              {(photo || photoFile) && (
                <Button type="button" variant="outline" size="sm" onClick={removePhoto} disabled={isSaving}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="official-first-name">First Name</RequiredLabel>
                <Input
                  id="official-first-name"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value)
                    clearError('firstName')
                    setDuplicateWarning(null)
                  }}
                  placeholder="Juan"
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.firstName)}
                />
                <FieldError message={errors.firstName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="official-middle-initial">Middle Initial</Label>
                <Input
                  id="official-middle-initial"
                  value={middleInitial}
                  onChange={(event) => {
                    setMiddleInitial(normalizeMiddleInitialInput(event.target.value))
                    clearError('middleInitial')
                  }}
                  placeholder="S."
                  maxLength={2}
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.middleInitial)}
                />
                <FieldError message={errors.middleInitial} />
              </div>

              <div className="space-y-2">
                <RequiredLabel htmlFor="official-last-name">Last Name</RequiredLabel>
                <Input
                  id="official-last-name"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value)
                    clearError('lastName')
                    setDuplicateWarning(null)
                  }}
                  placeholder="Dela Cruz"
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.lastName)}
                />
                <FieldError message={errors.lastName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="official-suffix">Suffix</Label>
                <Input
                  id="official-suffix"
                  value={suffix}
                  onChange={(event) => setSuffix(event.target.value)}
                  placeholder="Jr."
                  disabled={isSaving}
                />
              </div>
            </div>

            {isLegacyNameRecord && (
              <p className="text-xs text-amber-700">
                This record has no name parts on file yet. Enter the first and last name when saving.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Listed as: <span className="font-medium text-foreground">{composedName || '—'}</span>
            </p>
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-designation">Designation</RequiredLabel>
            <Select
              value={designationId}
              onValueChange={(value) => {
                setDesignationId(value)
                clearError('designationId')
                setDuplicateWarning(null)
              }}
              disabled={isSaving}
            >
              <SelectTrigger id="official-designation" aria-invalid={Boolean(errors.designationId)}>
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                {designationGroups.map((group) => (
                  <SelectGroup key={group.category}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((designation) => (
                      <SelectItem key={designation.id} value={designation.id}>
                        {designation.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.designationId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="official-category">Category</Label>
            <Input id="official-category" value={categoryLabel} readOnly className="bg-muted" />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-contact">Contact Number</RequiredLabel>
            <Input
              id="official-contact"
              type="tel"
              value={contactNumber}
              onChange={(event) => {
                setContactNumber(event.target.value)
                clearError('contactNumber')
              }}
              placeholder="09xx xxx xxxx"
              disabled={isSaving}
              aria-invalid={Boolean(errors.contactNumber)}
            />
            <FieldError message={errors.contactNumber} />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-email">Email Address</RequiredLabel>
            <Input
              id="official-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
                setDuplicateWarning(null)
              }}
              placeholder="name@example.com"
              disabled={isSaving}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email} />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-term-start">Term Start Date</RequiredLabel>
            <Input
              id="official-term-start"
              type="date"
              value={termStart}
              onChange={(event) => {
                setTermStart(event.target.value)
                clearError('termStart')
              }}
              disabled={isSaving}
              aria-invalid={Boolean(errors.termStart)}
            />
            <FieldError message={errors.termStart} />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="official-term-end">Term End Date</RequiredLabel>
            <Input
              id="official-term-end"
              type="date"
              value={termEnd}
              min={termStart || undefined}
              onChange={(event) => {
                setTermEnd(event.target.value)
                clearError('termEnd')
              }}
              disabled={isSaving}
              aria-invalid={Boolean(errors.termEnd)}
            />
            <FieldError message={errors.termEnd} />
          </div>

          <div className="md:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={fillThreeYearTerm} disabled={isSaving}>
              Fill 3-year term from today
            </Button>
          </div>

          {termStart && termEnd && !errors.termEnd && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Term: {getOfficialTermDuration(termStart, termEnd)}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={requestClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={isSaving}>
            {isSaving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Save Official'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fields marked with <span className="text-rose-600">*</span> are required.
        </p>
        </form>
        <AlertDialog open={confirmDiscard} onOpenChange={(open) => !open && setConfirmDiscard(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>Your unsaved edits to this official will be lost.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction onClick={forceClose}>Discard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
