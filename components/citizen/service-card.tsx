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

export const servicesList = [
  {
    id: 'barangay-clearance',
    icon: <FileText className="w-6 h-6" />,
    title: 'Barangay Clearance',
    description: 'Official document required for various transactions, confirming local residency in good standing.',
    tag: 'Express Processing',
    buttonLabel: 'Request Now',
  },
  {
    id: 'certificate-residency',
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Certificate of Residency',
    description: 'A legal document certifying that a citizen is a permanent resident of the barangay.',
    tag: 'Resident Only',
    buttonLabel: 'Request Now',
  },
  {
    id: 'business-permit',
    icon: <Briefcase className="w-6 h-6" />,
    title: 'Business Permit',
    description: 'For new applications and renewals of local businesses.',
    tag: 'Professional',
    buttonLabel: 'Request Now',
  },
  {
    id: 'good-moral',
    icon: <Award className="w-6 h-6" />,
    title: 'Good Moral Certificate',
    description: 'Certifies good character, commonly required for school or employment.',
    tag: 'Character Ref',
    buttonLabel: 'Request Now',
  },
  {
    id: 'indigency',
    icon: <Heart className="w-6 h-6" />,
    title: 'Indigency Certificate',
    description: 'Required for welfare benefits, scholarships, and assistance programs.',
    tag: 'Social Assistance',
    buttonLabel: 'Request Now',
  },
]
