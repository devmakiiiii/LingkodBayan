'use client'

import { Button } from '@/components/ui/button'
import { FileText, CheckCircle, Briefcase, Award, Heart, Clock, PhilippinePeso } from 'lucide-react'
import Link from 'next/link'
import { formatServiceFee, getServiceTypeLabel, NOT_SPECIFIED } from '@/lib/charter-services'

interface ServiceCardProps {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  tag: string
  buttonLabel: string
  buttonHref?: string
  onRequestClick?: (id: string) => void
  feeLabel?: string | null
  timeLabel?: string | null
  onDetailsClick?: (id: string) => void
}

interface Service {
  id: string
  slug: string
  title: string
  description: string | null
  category_type: 'document' | 'appointment' | 'incident' | 'health' | 'emergency' | 'justice' | 'program'
  is_active: boolean
  sort_order: number
  office_key?: string | null
  fee_type?: string | null
  fee_amount_min?: number | null
  fee_amount_max?: number | null
  fee_description?: string | null
  processing_time_text?: string | null
}

const iconMap: Record<string, React.ReactNode> = {
  'barangay-clearance': <FileText className="w-6 h-6" />,
  'certificate-residency': <CheckCircle className="w-6 h-6" />,
  'business-permit': <Briefcase className="w-6 h-6" />,
  'good-moral': <Award className="w-6 h-6" />,
  'indigency': <Heart className="w-6 h-6" />,
}

const defaultIcons = [
  <FileText className="w-4 h-4" />,
  <CheckCircle className="w-4 h-4" />,
  <Briefcase className="w-4 h-4" />,
  <Award className="w-4 h-4" />,
  <Heart className="w-4 h-4" />,
]

export function ServiceCard({
  id,
  icon,
  title,
  description,
  tag,
  buttonLabel,
  buttonHref,
  onRequestClick,
  feeLabel,
  timeLabel,
  onDetailsClick,
}: ServiceCardProps) {
  const handleClick = () => {
    if (onRequestClick) {
      onRequestClick(id)
    } else if (buttonHref) {
      window.location.href = buttonHref
    }
  }

  return (
    <div className="group bg-white dark:bg-card rounded-[12px] shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100 dark:border-border">
      {/* Card Content */}
      <div className="p-6 flex flex-col h-full">
        {/* Header with Icon and Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-lg bg-linear-to-br from-[#28A745]/10 to-[#28A745]/5 flex items-center justify-center text-[#28A745]">
            {icon}
          </div>
          {tag && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#28A745]/10 text-[#228039]">
              {tag}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-foreground mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4 grow line-clamp-3">
          {description}
        </p>

        {/* Charter metadata: fee + processing time */}
        {(feeLabel || timeLabel) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {feeLabel && (
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-muted-foreground">
                <PhilippinePeso className="h-3 w-3" aria-hidden="true" />
                {feeLabel}
              </span>
            )}
            {timeLabel && (
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {timeLabel}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onDetailsClick && (
            <Button
              variant="outline"
              onClick={() => onDetailsClick(id)}
              className="flex-1 font-medium py-2.5 rounded-lg"
            >
              Details
            </Button>
          )}
          <Button
            onClick={handleClick}
            className="flex-1 bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DynamicServiceCard({
  service,
  onRequestClick,
  onDetailsClick,
}: {
  service: Service
  onRequestClick?: (id: string) => void
  onDetailsClick?: (id: string) => void
}) {
  const iconIndex = Math.abs(service.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % defaultIcons.length
  const icon = iconMap[service.slug] || defaultIcons[iconIndex]
  const buttonLabel = 'Request Now'

  const hasCharterData = service.fee_type != null && service.fee_type !== 'unspecified'
  const feeLabel = hasCharterData ? formatServiceFee(service) : null
  const timeLabel =
    service.processing_time_text && service.processing_time_text !== NOT_SPECIFIED
      ? service.processing_time_text
      : null

  return (
    <ServiceCard
      id={service.slug}
      icon={icon}
      title={service.title}
      description={service.description || 'No description available'}
      tag={getServiceTypeLabel(service.category_type)}
      buttonLabel={buttonLabel}
      onRequestClick={onRequestClick}
      onDetailsClick={onDetailsClick}
      feeLabel={feeLabel}
      timeLabel={timeLabel}
    />
  )
}