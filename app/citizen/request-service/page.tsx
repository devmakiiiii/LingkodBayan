'use client'

import { useState, useEffect } from 'react'
import { DynamicServiceCard } from '@/components/citizen/service-card'
import { ServiceDetailDialog } from '@/components/citizen/service-detail-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Loader2 } from 'lucide-react'
import { RequestFormDialog } from '@/components/citizen/request-form-dialog'
import type { RequestType } from '@/lib/request-types'
import type { DynamicServiceInfo } from '@/lib/request-types'
import {
  directoryCategories,
  type CharterService,
  type Office,
} from '@/lib/charter-services'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ServiceCategory = CharterService

const filterOptions = [
  { value: 'all', label: 'All Services' },
  ...directoryCategories,
  { value: 'general', label: 'General Services' },
]

export default function RequestServicePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(null)
  const [selectedServiceInfo, setSelectedServiceInfo] = useState<DynamicServiceInfo | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [services, setServices] = useState<ServiceCategory[]>([])
  const [officesByKey, setOfficesByKey] = useState<Record<string, Office>>({})
  const [detailService, setDetailService] = useState<ServiceCategory | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadServices()
  }, [])

  async function loadServices() {
    try {
      setLoading(true)
      setLoadError(null)
      const supabase = createClient()

      const [{ data, error }, { data: officesData }] = await Promise.all([
        supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .neq('category_type', 'incident')
          .order('sort_order', { ascending: true }),
        supabase
          .from('offices')
          .select('*')
          .eq('is_active', true),
      ])

      if (error) {
        setLoadError(error?.message || 'Failed to load services')
        return
      }

      setServices(data || [])
      const officeMap: Record<string, Office> = {}
      ;(officesData || []).forEach((office: Office) => {
        officeMap[office.office_key] = office
      })
      setOfficesByKey(officeMap)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  // Use dynamic services from database, fallback to static for development
  const staticDefaults = {
    office_key: null, classification: null, transaction_types: null, who_may_avail: null,
    fee_type: 'unspecified' as const, fee_amount_min: null, fee_amount_max: null,
    fee_description: null, processing_time_text: null, responsible_personnel: null,
    charter_section: null, directory_category: null, is_active: true,
  }
  const servicesList: ServiceCategory[] = services.length > 0 ? services : [
    { id: 'static-1', slug: 'barangay-clearance', title: 'Barangay Clearance', description: 'Official document required for various transactions', category_type: 'document', sort_order: 1, ...staticDefaults },
    { id: 'static-2', slug: 'certificate-residency', title: 'Certificate of Residency', description: 'Legal document certifying local residency', category_type: 'document', sort_order: 2, ...staticDefaults },
    { id: 'static-3', slug: 'business-permit', title: 'Business Permit', description: 'For new applications and renewals of local businesses', category_type: 'document', sort_order: 3, ...staticDefaults },
    { id: 'static-4', slug: 'good-moral', title: 'Good Moral Certificate', description: 'Certifies good character for school or employment', category_type: 'document', sort_order: 4, ...staticDefaults },
    { id: 'static-5', slug: 'indigency', title: 'Indigency Certificate', description: 'Required for welfare benefits and assistance programs', category_type: 'document', sort_order: 5, ...staticDefaults },
  ]

  // Filter services based on search and directory category
  const filteredServices = servicesList.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      selectedFilter === 'all' ||
      (service.directory_category ?? 'general') === selectedFilter

    return matchesSearch && matchesFilter
  })

  // Group by directory category (charter groupings first, uncategorized last)
  const groupedServices = (() => {
    const groups = new Map<string, { label: string; services: ServiceCategory[] }>()
    directoryCategories.forEach((category) => {
      const servicesInGroup = filteredServices.filter((s) => s.directory_category === category.value)
      if (servicesInGroup.length > 0) groups.set(category.value, { label: category.label, services: servicesInGroup })
    })
    const uncategorized = filteredServices.filter(
      (s) => !s.directory_category || !directoryCategories.some((c) => c.value === s.directory_category)
    )
    if (uncategorized.length > 0) groups.set('general', { label: 'General Services', services: uncategorized })
    return Array.from(groups.values())
  })()

  const handleServiceRequest = (service: ServiceCategory) => {
    const knownTypes = ['barangay-clearance', 'certificate-residency', 'business-permit', 'good-moral', 'indigency']
    const isKnownType = knownTypes.includes(service.slug)

    setSelectedRequestType(isKnownType ? (service.slug as RequestType) : null)
    setSelectedServiceInfo({
      slug: service.slug,
      title: service.title,
      category: service.category_type,
      description: service.description || '',
      fee_type: service.fee_type,
      fee_amount_min: service.fee_amount_min,
      fee_amount_max: service.fee_amount_max,
      fee_description: service.fee_description,
    })
    setIsFormOpen(true)
  }

  const handleServiceDetails = (slug: string) => {
    const service = servicesList.find((s) => s.slug === slug)
    if (!service) return
    setDetailService(service)
    setIsDetailOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted">
      <RequestFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        requestType={selectedRequestType}
        serviceInfo={selectedServiceInfo}
      />
      <ServiceDetailDialog
        service={detailService}
        office={detailService?.office_key ? officesByKey[detailService.office_key] : null}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRequest={(slug) => {
          const service = servicesList.find((s) => s.slug === slug)
          if (service) handleServiceRequest(service)
        }}
      />

      {/* Main Content */}
      <main className="w-full">
        <div className="min-h-screen p-6 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-2">
              Request Services
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground">
              Browse and request available barangay services and documents
            </p>
            {loadError && (
              <p className="text-amber-600 text-sm mt-2">Note: Showing default services. Database unavailable.</p>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white dark:bg-card rounded-[12px] shadow-sm p-6 mb-8 border border-gray-100 dark:border-border">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search Bar */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-muted-foreground w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-input bg-white dark:bg-card focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-gray-300 dark:text-muted-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Dropdown */}
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="rounded-lg border border-gray-300 dark:border-input bg-white dark:bg-card focus:ring-2 focus:ring-[#28A745]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters Display */}
            {(searchQuery || selectedFilter !== 'all') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 bg-[#28A745]/10 text-[#228039] px-3 py-1 rounded-full text-sm">
                    Search: {searchQuery}
                    <button
                      onClick={() => setSearchQuery('')}
                      className="hover:text-[#228039]/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
                {selectedFilter !== 'all' && (
                  <span className="inline-flex items-center gap-2 bg-[#28A745]/10 text-[#228039] px-3 py-1 rounded-full text-sm">
                    Category: {filterOptions.find((o) => o.value === selectedFilter)?.label}
                    <button
                      onClick={() => setSelectedFilter('all')}
                      className="hover:text-[#228039]/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Services Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-muted-foreground mb-4">
                <Loader2 className="w-12 h-12 mx-auto opacity-50 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2">
                Loading services...
              </h3>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="space-y-10">
              {groupedServices.map((group) => (
                <section key={group.label}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-4 border-b border-gray-200 dark:border-border pb-2">
                    {group.label}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.services.map((service) => (
                      <DynamicServiceCard
                        key={service.id}
                        service={service}
                        onRequestClick={() => handleServiceRequest(service)}
                        onDetailsClick={() => handleServiceDetails(service.slug)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-muted-foreground mb-4">
                <Search className="w-12 h-12 mx-auto opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-2">
                No services found
              </h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-6">
                Try adjusting your search or filters
              </p>
              <Button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedFilter('all')
                }}
                className="bg-[#28A745] hover:bg-[#228039] text-white"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}