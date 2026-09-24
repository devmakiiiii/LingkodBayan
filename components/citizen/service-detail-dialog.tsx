'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, CheckCircle2, Clock, Loader2, Phone, PhilippinePeso, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  NOT_SPECIFIED,
  formatServiceFee,
  formatProcessingTime,
  getServiceTypeLabel,
  isEmergencyService,
  type CharterService,
  type Office,
  type ServiceRequirement,
  type ServiceStep,
} from '@/lib/charter-services'

interface ServiceDetailDialogProps {
  service: CharterService | null
  office?: Office | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequest?: (slug: string) => void
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const display = value && value.trim() !== '' ? value : NOT_SPECIFIED
  const isFallback = display === NOT_SPECIFIED
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 ${isFallback ? 'italic text-muted-foreground' : 'text-foreground'}`}>
        {display}
      </p>
    </div>
  )
}

export function ServiceDetailDialog({ service, office, open, onOpenChange, onRequest }: ServiceDetailDialogProps) {
  const [requirements, setRequirements] = useState<ServiceRequirement[]>([])
  const [steps, setSteps] = useState<ServiceStep[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !service) return

    let cancelled = false
    async function loadDetails() {
      setLoading(true)
      try {
        const supabase = createClient()
        const [{ data: reqs }, { data: svcSteps }] = await Promise.all([
          supabase
            .from('service_category_requirements')
            .select('id, requirement_key, requirement_label, is_required, sort_order')
            .eq('service_category_id', service!.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('service_steps')
            .select('id, step_number, actor, description')
            .eq('service_category_id', service!.id)
            .order('step_number', { ascending: true }),
        ])
        if (!cancelled) {
          setRequirements(reqs || [])
          setSteps(svcSteps || [])
        }
      } catch (error) {
        console.error('Error loading service details:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadDetails()
    return () => {
      cancelled = true
    }
  }, [open, service])

  if (!service) return null

  const emergency = isEmergencyService(service)
  const classificationLabel =
    service.classification === 'highly_technical' ? 'Highly Technical' : service.classification === 'simple' ? 'Simple' : null


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-xl">{service.title}</DialogTitle>
            <Badge variant="secondary" className="shrink-0">{getServiceTypeLabel(service.category_type)}</Badge>
          </div>
          <DialogDescription>{service.description}</DialogDescription>
        </DialogHeader>

        {/* Hotline-first notice for emergency services */}
        {emergency && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-400">
                For emergencies, call first — response begins immediately.
              </p>
              <p className="text-red-700/90 dark:text-red-300 mt-0.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                BBFRU Hotline: 0946-214-2438 &middot; BPAT Hotline: 0938-949-5840 &middot; National Emergency: 911
              </p>
              <p className="text-red-700/80 dark:text-red-300/80 text-xs mt-1">
                Use the online request only for follow-up or documentation after contacting the hotline.
              </p>
            </div>
          </div>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailRow label="Office" value={office?.name ?? service.charter_section} />
          <DetailRow label="Classification" value={classificationLabel} />
          <DetailRow
            label="Type of Transaction"
            value={service.transaction_types && service.transaction_types.length > 0 ? service.transaction_types.join(', ') : null}
          />
          <DetailRow label="Who May Avail" value={service.who_may_avail} />
          <DetailRow label="Responsible Personnel" value={service.responsible_personnel} />
          {service.charter_section && <DetailRow label="Citizen's Charter Section" value={service.charter_section} />}
        </div>

        {/* Fees & processing time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-border p-3 flex gap-2.5 items-start">
            <PhilippinePeso className="h-4 w-4 mt-0.5 text-[#28A745]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fees to be Paid</p>
              <p className={`text-sm font-medium ${formatServiceFee(service) === NOT_SPECIFIED ? 'italic text-muted-foreground font-normal' : ''}`}>
                {formatServiceFee(service)}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-border p-3 flex gap-2.5 items-start">
            <Clock className="h-4 w-4 mt-0.5 text-[#28A745]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Processing Time</p>
              <p className={`text-sm font-medium ${formatProcessingTime(service) === NOT_SPECIFIED ? 'italic text-muted-foreground font-normal' : ''}`}>
                {formatProcessingTime(service)}
              </p>
            </div>
          </div>
        </div>

        <Separator />


        {/* Requirements */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Checklist of Requirements</h4>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading requirements…
            </div>
          ) : requirements.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">{NOT_SPECIFIED}</p>
          ) : (
            <ul className="space-y-1.5">
              {requirements.map((req) => (
                <li key={req.id} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[#28A745]" aria-hidden="true" />
                  <span>
                    {req.requirement_label}
                    {!req.is_required && (
                      <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-2 italic">
            Where to secure these requirements: {NOT_SPECIFIED}
          </p>
        </div>

        {/* Process steps */}
        {steps.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">Official Process (from the Citizen&apos;s Charter)</h4>
              <p className="text-xs text-muted-foreground mb-3 italic">
                These are the barangay&apos;s official process steps. Submitting a request online is a
                system convenience — the office still follows the process below.
              </p>
              <ol className="space-y-2">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#28A745]/10 text-[11px] font-semibold text-[#228039]">
                      {step.step_number}
                    </span>
                    <span className="grow">
                      {step.description}
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <User className="h-2.5 w-2.5" aria-hidden="true" />
                        {step.actor === 'client' ? 'You' : 'Barangay'}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* Actions */}
        {onRequest && (
          <div className="pt-2">
            <Button
              onClick={() => {
                onOpenChange(false)
                onRequest(service.slug)
              }}
              className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg"
            >
              {emergency ? 'File a Request (Follow-up / Documentation)' : 'Request This Service'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
