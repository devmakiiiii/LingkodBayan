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
  getRequestTypeConfigAny,
  type RequestFileValue,
  type RequestPayload,
  type RequestType,
  type DynamicServiceInfo,
  type RequestTypeConfig,
} from '@/lib/request-types'
import { formatServiceFee } from '@/lib/charter-services'
import {
  buildRequestPaymentSnapshot,
  computePerPageAmount,
  formatPeso,
  getDefaultPaymentAmount,
  getFeeType,
  getPaymentMethodLabel,
  requestPaymentMethods,
  requiresAmountEntry,
  requiresReferenceNumber,
  toRequestPaymentRow,
  validateRequestPayment,
  type RequestPaymentFeeInfo,
  type RequestPaymentMethod,
  type RequestPaymentSnapshot,
} from '@/lib/request-payment'

type RequestFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestType: RequestType | null
  serviceInfo?: DynamicServiceInfo | null
}

type SubmittedState = {
  requestId: string
  message: string
}

function createInitialValues(config: RequestTypeConfig | null) {
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

export function RequestFormDialog({ open, onOpenChange, requestType, serviceInfo }: RequestFormDialogProps) {
  const router = useRouter()
  const config = getRequestTypeConfigAny(requestType, serviceInfo)
  const paymentFee: RequestPaymentFeeInfo | null = serviceInfo
    ? {
        feeType: serviceInfo.fee_type ?? null,
        feeAmountMin: serviceInfo.fee_amount_min ?? null,
        feeAmountMax: serviceInfo.fee_amount_max ?? null,
        feeDescription: serviceInfo.fee_description ?? null,
      }
    : null
  // snake_case view of the fee for display via formatServiceFee
  const paymentFeeDisplay = paymentFee
    ? {
        fee_type: paymentFee.feeType,
        fee_amount_min: paymentFee.feeAmountMin,
        fee_amount_max: paymentFee.feeAmountMax,
        fee_description: paymentFee.feeDescription,
      }
    : null
  const [values, setValues] = useState<Record<string, string>>(() => createInitialValues(config))
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submittedState, setSubmittedState] = useState<SubmittedState | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<RequestPaymentMethod | ''>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentPages, setPaymentPages] = useState('')

  const isPerPageFee = paymentFee != null && getFeeType(paymentFee) === 'per_page'
  const perPageTotal = paymentFee != null && isPerPageFee ? computePerPageAmount(paymentFee, paymentPages) : null
  const paymentMethodRequired = paymentFee != null && getFeeType(paymentFee) !== 'free'
  const paymentAmountRequired =
    paymentFee != null &&
    !isPerPageFee &&
    (getFeeType(paymentFee) === 'range' ||
      (requiresAmountEntry(paymentFee) && requiresReferenceNumber(paymentMethod as RequestPaymentMethod)))
  const paymentPagesRequired = isPerPageFee && requiresReferenceNumber(paymentMethod as RequestPaymentMethod)

  // Live "amount due": charter-fixed numbers, computed per-page totals, or the
  // resident's entry; null means the barangay office will assess it.
  const enteredAmount = paymentAmount.trim() === '' ? null : Number(paymentAmount)
  const amountDue: number | null =
    paymentFee == null
      ? null
      : getFeeType(paymentFee) === 'free'
        ? 0
        : getFeeType(paymentFee) === 'fixed'
          ? (paymentFee.feeAmountMin ?? 0)
          : isPerPageFee
            ? perPageTotal
            : enteredAmount != null && Number.isFinite(enteredAmount)
              ? enteredAmount
              : null

  useEffect(() => {
    if (!open) {
      setValues(createInitialValues(config))
      setFiles({})
      setIsSubmitting(false)
      setErrorMessage('')
      setSubmittedState(null)
      setPaymentMethod('')
      setPaymentAmount('')
      setPaymentReference('')
      setPaymentPages('')
      return
    }

    // Payment defaults: prefill an amount whenever the charter determines one
    // (0 for free, the charter amount for fixed fees, and the charter minimum
    // as an adjustable starting point for ranges).
    if (paymentFee) {
      const defaultAmount = getDefaultPaymentAmount(paymentFee)
      if (defaultAmount != null) {
        setPaymentAmount((current) => (current === '' ? String(defaultAmount) : current))
      }
    }

    // Auto-input the selected service's details into the form (dynamic services only)
    if (serviceInfo && !requestType) {
      const purposeSeed = serviceInfo.description
        ? `${serviceInfo.title} - ${serviceInfo.description}`
        : ''

      if (purposeSeed) {
        setValues((currentValues) => {
          const updates: Record<string, string> = {}
          for (const fieldName of ['purpose', 'reasonForRequest']) {
            if (fieldName in currentValues && currentValues[fieldName] === '') {
              updates[fieldName] = purposeSeed
            }
          }
          return Object.keys(updates).length > 0 ? { ...currentValues, ...updates } : currentValues
        })
      }
    }

    const prefillFromProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const resident = await getOrCreateResidentProfile(supabase, user)
      if (!resident) return

      const residentFullName = `${resident.first_name ?? ''} ${resident.last_name ?? ''}`.trim()

      // Profile values keyed by form field name - any matching empty field gets auto-filled
      const profileFieldValues: Record<string, string> = {
        fullName: residentFullName,
        ownerName: residentFullName,
        address: resident.address ?? '',
        contactNumber: resident.phone ?? '',
        email: resident.email ?? '',
        dateOfBirth: resident.date_of_birth ?? '',
      }

      setValues((currentValues) => {
        const updates: Record<string, string> = {}

        for (const field of config?.fields ?? []) {
          if (field.type === 'file') continue
          const profileValue = profileFieldValues[field.name]
          if ((currentValues[field.name] ?? '') === '' && profileValue) {
            updates[field.name] = profileValue
          }
        }

        return Object.keys(updates).length > 0 ? { ...currentValues, ...updates } : currentValues
      })
    }

    prefillFromProfile()
  }, [open])

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

  const getMissingRequiredFields = () => {
    if (!config) {
      return [] as string[]
    }

    return config.fields
      .filter((field) => field.required)
      .filter((field) => {
        if (field.type === 'file') {
          return (files[field.name] ?? []).length === 0
        }

        const rawValue = (values[field.name] ?? '').trim()
        return rawValue === ''
      })
      .map((field) => field.label)
  }

  const handleSubmit = async () => {
    if (!config) {
      return
    }

    const missingRequiredFields = getMissingRequiredFields()

    if (missingRequiredFields.length > 0) {
      setErrorMessage(`Please complete the required fields first: ${missingRequiredFields.join(', ')}.`)
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

      let paymentSnapshot: RequestPaymentSnapshot | null = null

      if (paymentFee) {
        let draftAmount = paymentAmount

        if (isPerPageFee) {
          if (paymentPages.trim() !== '' && perPageTotal == null) {
            setErrorMessage('Please enter a whole number of pages (1 or more) so the fee can be computed.')
            return
          }
          if (paymentPagesRequired && perPageTotal == null) {
            setErrorMessage('Please enter the number of pages so the total fee can be computed.')
            return
          }
          draftAmount = perPageTotal != null ? String(perPageTotal) : ''
        }

        const paymentDraft = {
          method: paymentMethod,
          amount: draftAmount,
          referenceNumber: paymentReference,
        }
        const paymentValidationError = validateRequestPayment(paymentFee, paymentDraft)

        if (paymentValidationError) {
          setErrorMessage(paymentValidationError)
          return
        }

        paymentSnapshot = buildRequestPaymentSnapshot(paymentFee, paymentDraft)
        payload.payment = { ...paymentSnapshot }
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

      let paymentLedgerNote = ''

      if (paymentSnapshot && data?.id) {
        const { error: paymentInsertError } = await supabase.from('request_payments').insert([
          {
            request_id: data.id,
            resident_id: resident.id,
            ...toRequestPaymentRow(paymentSnapshot),
          },
        ])

        if (paymentInsertError) {
          console.error('Failed to save payment record:', paymentInsertError)
          paymentLedgerNote =
            ' Note: your payment details were saved with the request, but the payment ledger entry could not be recorded.'
        }
      }

      setSubmittedState({
        requestId: data.id,
        message: `${config.title} has been submitted successfully and is now pending review.${paymentLedgerNote}`,
      })
      setValues(createInitialValues(config))
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

  const missingRequiredFields = getMissingRequiredFields()
  const canSubmit = !isSubmitting && missingRequiredFields.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-emerald-100 dark:border-border bg-white dark:bg-card">
        {!submittedState ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl text-foreground">{config.title}</DialogTitle>
              <DialogDescription>
                Fill out the form below. Your request will be saved as pending and routed for review.
                <span className="block text-xs text-emerald-600 mt-1">Some fields are auto-filled from your profile.</span>
              </DialogDescription>
            </DialogHeader>

            {/* Auto-filled service details summary */}
            <div className="rounded-xl border border-emerald-200 dark:border-border bg-emerald-50/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-emerald-800">Service: {config.title}</span>
                <span className="text-emerald-700">Category: {config.category}</span>
              </div>
              {serviceInfo?.description && (
                <p className="mt-1 text-xs text-emerald-700">{serviceInfo.description}</p>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
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
                      className="min-h-28 border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                    />
                  ) : field.type === 'select' ? (
                    <Select value={values[field.name] ?? ''} onValueChange={(value) => handleValueChange(field.name, value)}>
                      <SelectTrigger className="border-emerald-200 dark:border-border bg-white dark:bg-card focus:ring-emerald-500">
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
                    <div className="space-y-2 rounded-2xl border border-dashed border-emerald-200 dark:border-border bg-emerald-50/40 p-4">
                      <div className="flex items-center gap-3">
                        <Upload className="h-4 w-4 text-emerald-700" />
                        <Input
                          id={field.name}
                          type="file"
                          multiple={field.multiple}
                          accept={field.accept}
                          onChange={(event) => handleFileChange(field.name, event.target.files)}
                          className="border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                        />
                      </div>
                      {field.helperText && <p className="text-xs text-muted-foreground">{field.helperText}</p>}
                      {(files[field.name] ?? []).length > 0 && (
                        <div className="space-y-2">
                          {(files[field.name] ?? []).map((file) => (
                            <div key={`${field.name}-${file.name}`} className="rounded-lg bg-white dark:bg-card px-3 py-2 text-sm text-foreground shadow-sm">
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
                      className="border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                    />
                  )}
                </div>
              ))}
            </div>

            {paymentFee && (
              <div className="space-y-3 rounded-xl border border-emerald-200 dark:border-border bg-emerald-50/60 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-800">Payment</span>
                  <span className="text-emerald-700">
                    Charter fee: {paymentFeeDisplay ? formatServiceFee(paymentFeeDisplay) : ''}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="payment-method" className="mb-2 block text-sm font-medium text-foreground">
                      Payment Method
                      {paymentMethodRequired ? <span className="ml-1 text-rose-600">*</span> : null}
                    </Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as RequestPaymentMethod)}
                    >
                      <SelectTrigger
                        id="payment-method"
                        className="border-emerald-200 dark:border-border bg-white dark:bg-card focus:ring-emerald-500"
                      >
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {requestPaymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {getPaymentMethodLabel(method)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isPerPageFee && paymentFee && (
                    <div>
                      <Label htmlFor="payment-pages" className="mb-2 block text-sm font-medium text-foreground">
                        Number of Pages
                        {paymentPagesRequired ? <span className="ml-1 text-rose-600">*</span> : null}
                      </Label>
                      <Input
                        id="payment-pages"
                        type="number"
                        min="1"
                        step="1"
                        value={paymentPages}
                        onChange={(event) => setPaymentPages(event.target.value)}
                        placeholder={
                          paymentFee.feeAmountMin != null
                            ? `e.g. 5 (${formatPeso(paymentFee.feeAmountMin)} per page)`
                            : 'e.g. 5'
                        }
                        className="border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="payment-amount" className="mb-2 block text-sm font-medium text-foreground">
                      {isPerPageFee ? 'Computed Amount' : 'Amount to Pay'}
                      {paymentAmountRequired ? <span className="ml-1 text-rose-600">*</span> : null}
                    </Label>
                    {isPerPageFee ? (
                      <p className="flex h-10 items-center rounded-lg border border-emerald-200 dark:border-border bg-white dark:bg-card px-3 text-foreground">
                        {perPageTotal != null ? formatPeso(perPageTotal) : 'Enter the number of pages'}
                      </p>
                    ) : requiresAmountEntry(paymentFee) ? (
                      <Input
                        id="payment-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder="0.00"
                        className="border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                      />
                    ) : (
                      <p className="flex h-10 items-center rounded-lg border border-emerald-200 dark:border-border bg-white dark:bg-card px-3 text-foreground">
                        {paymentFeeDisplay ? formatServiceFee(paymentFeeDisplay) : ''}
                      </p>
                    )}
                  </div>

                  {requiresReferenceNumber(paymentMethod as RequestPaymentMethod) && (
                    <div className="md:col-span-2">
                      <Label htmlFor="payment-reference" className="mb-2 block text-sm font-medium text-foreground">
                        Reference / Transaction Number
                        <span className="ml-1 text-rose-600">*</span>
                      </Label>
                      <Input
                        id="payment-reference"
                        type="text"
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        placeholder="Enter the GCash/Maya reference number"
                        className="border-emerald-200 dark:border-border bg-white dark:bg-card focus-visible:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 dark:border-border bg-white dark:bg-card px-3 py-2">
                  <span className="font-medium text-emerald-800">Amount due</span>
                  <span className="text-base font-semibold text-emerald-900">
                    {amountDue != null
                      ? formatPeso(amountDue)
                      : isPerPageFee
                        ? 'Enter the number of pages'
                        : 'To be assessed at the barangay office'}
                  </span>
                </div>

                <p className="text-xs text-emerald-700">
                  {getFeeType(paymentFee) === 'free'
                    ? 'This service is free of charge - no payment is required.'
                    : 'No online payments: counter payments are settled at the barangay office, while GCash/Maya payments are verified by barangay staff before being marked as paid.'}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSubmit}
                  disabled={!canSubmit}
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
