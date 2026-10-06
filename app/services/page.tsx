import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getServiceCategories } from '@/lib/db'
import { ServiceDirectory, type DirectoryService } from '@/components/public/service-directory'
import { Button } from '@/components/ui/button'
import { BARANGAY_DISPLAY_NAME } from '@/lib/barangay'

export const revalidate = 300

export const metadata: Metadata = {
  title: `Services | LingkodBayan`,
  description: `Browse the services and requirements available at ${BARANGAY_DISPLAY_NAME}.`,
}

/**
 * Public service directory.
 *
 * The landing page's "View All Services" link used to point at /auth/sign-up,
 * which labelled a browse action as a registration step. This page is the honest
 * destination: the full charter catalog is readable without an account, and
 * filing a request still happens behind sign-in.
 *
 * `getServiceCategories` returns only active rows and swallows query errors
 * (returns []), so an unreachable database degrades to an honest empty state
 * rather than a 500 on a public page. `incident` is excluded because complaint
 * categories are filed through /citizen/file-complaint, not the service catalog.
 */
export default async function ServicesPage() {
  const categories = await getServiceCategories()

  const services: DirectoryService[] = (categories as any[])
    .filter((row) => row.category_type !== 'incident')
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description ?? null,
      category_type: row.category_type,
      directory_category: row.directory_category ?? null,
      fee_type: row.fee_type ?? null,
      fee_amount_min: row.fee_amount_min ?? null,
      fee_amount_max: row.fee_amount_max ?? null,
      fee_description: row.fee_description ?? null,
      processing_time_text: row.processing_time_text ?? null,
    }))

  return (
    <main id="main-content" className="min-h-screen">
      <div className="bg-linear-to-br from-[#001a4d] to-[#0d2d66] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/">
            <Button
              variant="ghost"
              className="mb-4 text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">Services</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-300 sm:text-base">
            Everything {BARANGAY_DISPLAY_NAME} offers, with the fees and processing
            times published in the Citizen&apos;s Charter.
          </p>
        </div>
      </div>

      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="font-medium">The service directory is unavailable right now.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please check back shortly, or visit the barangay office for assistance.
              </p>
            </div>
          ) : (
            <ServiceDirectory services={services} />
          )}

          <div className="mt-12 rounded-lg border border-border bg-muted/40 p-6 text-center">
            <p className="font-medium">Ready to file a request?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an account to submit a service request and track its status.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/auth/sign-up">
                <Button className="bg-[#218838] text-white hover:bg-[#1E7E34]">Sign Up</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline">Log In</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}