import { Badge } from '@/components/ui/badge'
import {
  getComplaintStatus,
  getComplaintStatusClassName,
  getComplaintStatusLabel,
} from '@/lib/complaint-status'
import type { ComplaintLifecycleStatus } from '@/lib/status-machine'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'

const statusIcons: Record<ComplaintLifecycleStatus, typeof AlertCircle> = {
  open: AlertCircle,
  under_investigation: Clock,
  resolved: CheckCircle2,
  dismissed: XCircle,
}

const statusIconClassNames: Record<ComplaintLifecycleStatus, string> = {
  open: 'text-amber-600',
  under_investigation: 'text-sky-600',
  resolved: 'text-emerald-600',
  dismissed: 'text-muted-foreground',
}

interface ComplaintStatusProps {
  status?: string | null
  className?: string
}

/**
 * Icon + badge pair for a complaint status. Both read the canonical status
 * from `lib/complaint-status.ts`, so the list, the detail page, and the
 * dashboard all render the same label and colour for the same row.
 */
export function ComplaintStatusIcon({ status, className }: ComplaintStatusProps) {
  const canonical = getComplaintStatus(status)
  const Icon = statusIcons[canonical]

  return (
    <Icon
      className={cn('h-4 w-4', statusIconClassNames[canonical], className)}
      aria-hidden="true"
    />
  )
}

export function ComplaintStatusBadge({ status, className }: ComplaintStatusProps) {
  return (
    <Badge className={cn('text-xs', getComplaintStatusClassName(status), className)}>
      {getComplaintStatusLabel(status)}
    </Badge>
  )
}
