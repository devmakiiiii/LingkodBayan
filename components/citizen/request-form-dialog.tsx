'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateResidentProfile } from '@/lib/residents'
import {
  getRequestSummaryValue,
  getRequestTypeConfig,
  type RequestFileValue,
  type RequestPayload,
  type RequestType,
} from '@/lib/request-types'

type RequestFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestType: RequestType | null
}

type SubmittedState = {
  requestId: string
  message: string
}

function createInitialValues(requestType: RequestType | null) {
  const config = requestType ? getRequestTypeConfig(requestType) : null
  const values: Record<string, string> = {}

  config?.fields.forEach((field) => {
    if (field.type !== 'file') {
      values[field.name] = ''
    }
  })

  return values
}

function fileToDataUrl(file: File) {
  return new Promise<RequestFileValue>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: String(reader.result ?? ''),
      })
    }

    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function RequestFormDialog({ open, onOpenChange, requestType }: RequestFormDialogProps) {
  const router = useRouter()
  const config = requestType ? getRequestTypeConfig(requestType) : null
  const [values, setValues] = useState<Record<string, string>>(() => createInitialValues(requestType))
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submittedState, setSubmittedState] = useState<SubmittedState | null>(null)

  useEffect(() => {
    if (!open) {
      setValues(createInitialValues(requestType))
      setFiles({})
      setIsSubmitting(false)
      setErrorMessage('')
      setSubmittedState(null)
    }
  }, [open, requestType])

  const handleValueChange = (fieldName: string, fieldValue: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [fieldName]: fieldValue,
    }))
  }

  const handleFileChange = (fieldName: string, selectedFiles: FileList | null) => {
    setFiles((currentFiles) => ({
      ...currentFiles,
      [fieldName]: selectedFiles ? Array.from(selectedFiles) : [],
    }))
  }

  const handleSubmit = async () => {
    if (!config) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Please sign in to submit a request.')
      }

      const resident = await getOrCreateResidentProfile(supabase, user)

      if (!resident) {
        throw new Error('Your resident profile is incomplete. Please finish registration first.')
      }

      const payload: RequestPayload = {}

      for (const field of config.fields) {
        if (field.type === 'file') {
          const selectedFiles = files[field.name] ?? []
          payload[field.name] = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)))
          continue
        }

        const rawValue = values[field.name] ?? ''
        if (field.type === 'number') {
          payload[field.name] = rawValue === '' ? '' : Number(rawValue)
        } else {
          payload[field.name] = rawValue
        }
      }

      const { data, error } = await supabase
        .from('requests')
        .insert([
          {
            resident_id: resident.id,
            request_type: config.requestType,
            title: config.title,
            description: getRequestSummaryValue(config.requestType, payload, config.title),
            category: config.category,
            payload,
            status: 'pending',
            priority: 'normal',
          },
        ])
        .select('id')
        .single()

      if (error) {
        throw error
      }

      setSubmittedState({
        requestId: data.id,
        message: `${config.title} has been submitted successfully and is now pending review.`,
      })
      setValues(createInitialValues(requestType))
      setFiles({})
    } catch (submitError) {
      setErrorMessage(submitError instanceof Error ? submitError.message : 'Failed to submit request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeDialog = () => {
    onOpenChange(false)
  }

  if (!config) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-emerald-100 bg-white">
        {!submittedState ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl text-foreground">{config.title}</DialogTitle>
              <DialogDescription>
                Fill out the form below. Your request will be saved as pending and routed for review.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {config.fields.map((field) => (
                <div key={field.name} className={field.type === 'textarea' || field.type === 'file' ? 'md:col-span-2' : ''}>
                  <Label htmlFor={field.name} className="mb-2 block text-sm font-medium text-foreground">
                    {field.label}
                    {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
                  </Label>

                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      value={values[field.name] ?? ''}
                      onChange={(event) => handleValueChange(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      className="min-h-28 border-emerald-200 bg-white focus-visible:ring-emerald-500"
                    />
                  ) : field.type === 'select' ? (
                    <Select value={values[field.name] ?? ''} onValueChange={(value) => handleValueChange(field.name, value)}>
                      <SelectTrigger className="border-emerald-200 bg-white focus:ring-emerald-500">
                        <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'file' ? (
                    <div className="space-y-2 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                      <div className="flex items-center gap-3">
                        <Upload className="h-4 w-4 text-emerald-700" />
                        <Input
                          id={field.name}
                          type="file"
                          multiple={field.multiple}
                          accept={field.accept}
                          onChange={(event) => handleFileChange(field.name, event.target.files)}
                          className="border-emerald-200 bg-white focus-visible:ring-emerald-500"
                        />
                      </div>
                      {field.helperText && <p className="text-xs text-muted-foreground">{field.helperText}</p>}
                      {(files[field.name] ?? []).length > 0 && (
                        <div className="space-y-2">
                          {(files[field.name] ?? []).map((file) => (
                            <div key={`${field.name}-${file.name}`} className="rounded-lg bg-white px-3 py-2 text-sm text-foreground shadow-sm">
                              {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={values[field.name] ?? ''}
                      onChange={(event) => handleValueChange(field.name, event.target.value)}
                      placeholder={field.placeholder}
                      className="border-emerald-200 bg-white focus-visible:ring-emerald-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">Request Submitted</h3>
              <p className="max-w-xl text-sm text-muted-foreground">{submittedState.message}</p>
              <p className="text-xs text-muted-foreground">Request ID: {submittedState.requestId}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  closeDialog()
                  router.push('/citizen/my-requests')
                }}
              >
                View My Requests
              </Button>
              <Button variant="outline" onClick={closeDialog}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
