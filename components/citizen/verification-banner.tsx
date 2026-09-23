'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Clock, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

export type VerificationStatus =
  | 'unverified'
  | 'auto_verified'
  | 'id_verified'
  | 'needs_review'
  | 'rejected'
  | string

interface VerificationBannerProps {
  status?: VerificationStatus | null
  confidence?: number | null
  className?: string
}

const isVerified = (status?: VerificationStatus | null) =>
  status === 'auto_verified' || status === 'id_verified'

/**
 * Identity verification banner. Verification is advisory rather than a
 * navigation gate (see `middleware.ts`), so this component is shared across
 * every citizen surface where residents need the reminder instead of living
 * only on the dashboard.
 */
export function VerificationBanner({
  status,
  confidence,
  className,
}: VerificationBannerProps) {
  const normalizedStatus = status ?? 'unverified'

  if (isVerified(normalizedStatus)) {
    return (
      <Card className={`border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 ${className ?? ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Identity Verified
          </CardTitle>
          <CardDescription className="text-emerald-700 dark:text-emerald-400">
            {confidence !== null && confidence !== undefined
              ? `Your identity has been verified with ${Math.round(confidence)}% confidence.`
              : 'Your identity has been verified.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const presentation =
    normalizedStatus === 'needs_review'
      ? {
          Icon: Clock,
          cardClass: 'border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10',
          titleClass: 'text-orange-800 dark:text-orange-300',
          descriptionClass: 'text-orange-700 dark:text-orange-400',
          iconClass: 'text-orange-600',
          title: 'Identity Verification Under Review',
          description:
            "Your ID is being reviewed by an administrator. You'll be notified once approved.",
          action: null,
        }
      : normalizedStatus === 'rejected'
        ? {
            Icon: ShieldAlert,
            cardClass: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10',
            titleClass: 'text-rose-800 dark:text-rose-300',
            descriptionClass: 'text-rose-700 dark:text-rose-400',
            iconClass: 'text-rose-600',
            title: 'Identity Verification Rejected',
            description:
              'Your ID submission was rejected. Please upload a clearer image of a valid ID.',
            action: 'Re-upload ID',
          }
        : {
            Icon: Shield,
            cardClass: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
            titleClass: 'text-amber-800 dark:text-amber-300',
            descriptionClass: 'text-amber-700 dark:text-amber-400',
            iconClass: 'text-amber-600',
            title: 'Complete Your Identity Verification',
            description:
              'Verify your identity to access all civic services. Upload a valid government ID.',
            action: 'Verify Now',
          }

  const { Icon, cardClass, titleClass, descriptionClass, iconClass, title, description, action } =
    presentation

  return (
    <Card className={`${cardClass} ${className ?? ''}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-lg ${titleClass}`}>
          <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className={descriptionClass}>{description}</CardDescription>
      </CardHeader>
      {action ? (
        <CardContent>
          <Link href="/citizen/verify-id">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              {action}
            </Button>
          </Link>
        </CardContent>
      ) : null}
    </Card>
  )
}
