'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

/** Human-friendly labels for known route segments. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'verify-id': 'Identity Verification',
  'my-requests': 'My Requests',
  'request-service': 'Request Service',
  'my-complaints': 'My Complaints',
  'file-complaint': 'File a Complaint',
  announcements: 'Announcements',
  notifications: 'Notifications',
  officials: 'Officials List',
  designations: 'Designations',
  residents: 'All Residents',
  'pre-registered-residents': 'Pre-Registered Data',
  'resident-reports': 'Resident Reports',
  analytics: 'Analytics',
  'generated-reports': 'Generated Reports',
  requests: 'Request List',
  complaints: 'Complaints List',
  verification: 'Identity Verification',
  settings: 'System Settings',
  'service-categories': 'Service Categories',
}

/** Where "Home" points for each portal. */
const PORTAL_HOME: Record<string, string> = {
  citizen: '/citizen/dashboard',
  admin: '/admin/dashboard',
}

/**
 * Renders breadcrumbs derived from the current pathname so users always know
 * where they are and can jump back up the hierarchy. Dynamic route segments
 * (e.g. record IDs) are shown as "Details".
 */
export function PageBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const portal = segments[0]
  const homeHref = portal ? PORTAL_HOME[portal] : undefined
  if (!homeHref) return null

  const crumbs = segments.slice(1).map((segment, index) => ({
    href: '/' + segments.slice(0, index + 2).join('/'),
    label: SEGMENT_LABELS[segment] ?? 'Details',
  }))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={homeHref}>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
