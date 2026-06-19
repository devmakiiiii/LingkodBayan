'use client'

import { Button } from '@/components/ui/button'
import { FileText, CheckCircle, Briefcase, Award, Heart } from 'lucide-react'
import Link from 'next/link'

interface ServiceCardProps {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  tag: string
  buttonLabel: string
  buttonHref?: string
  onRequestClick?: (id: string) => void
}

interface Service {
  id: string
  slug: string
  title: string
  description: string | null
  category_type: 'document' | 'appointment' | 'incident'
  is_active: boolean
  sort_order: number
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
}: ServiceCardProps) {
  const handleClick = () => {
    if (onRequestClick) {
      onRequestClick(id)
    } else if (buttonHref) {
      window.location.href = buttonHref
    }
  }

  return (
    <div className="group bg-white rounded-[12px] shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100">
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
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-6 grow line-clamp-3">
          {description}
        </p>

        {/* Button */}
        <Button
          onClick={handleClick}
          className="w-full bg-[#28A745] hover:bg-[#228039] text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

function getDefaultTag(categoryType: string): string {
  switch (categoryType) {
    case 'document': return 'Document'
    case 'appointment': return 'Appointment'
    default: return 'Service'
  }
}

export function DynamicServiceCard({
  service,
  onRequestClick,
}: {
  service: Service
  onRequestClick?: (id: string) => void
}) {
  const iconIndex = Math.abs(service.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % defaultIcons.length
  const icon = iconMap[service.slug] || defaultIcons[iconIndex]
  const buttonLabel = 'Request Now'
  
  return (
    <ServiceCard
      id={service.slug}
      icon={icon}
      title={service.title}
      description={service.description || 'No description available'}
      tag={getDefaultTag(service.category_type)}
      buttonLabel={buttonLabel}
      onRequestClick={onRequestClick}
    />
  )
}