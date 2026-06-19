'use client'

import { useState, useEffect } from 'react'
import { ServiceCard, DynamicServiceCard } from '@/components/citizen/service-card'
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
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ServiceCategory {
  id: string
  slug: string
  title: string
  description: string | null
  category_type: 'document' | 'appointment' | 'incident'
  is_active: boolean
  sort_order: number
}

const filterOptions = [
  { value: 'all', label: 'All Services' },
  { value: 'document', label: 'Document Requests' },
  { value: 'appointment', label: 'Appointments' },
]

export default function RequestServicePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(null)
  const [selectedServiceInfo, setSelectedServiceInfo] = useState<DynamicServiceInfo | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [services, setServices] = useState<ServiceCategory[]>([])
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
      
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .neq('category_type', 'incident')
        .order('sort_order', { ascending: true })

      if (error) {
        setLoadError(error?.message || 'Failed to load services')
        return
      }

      setServices(data || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  // Use dynamic services from database, fallback to static for development
  const servicesList = services.length > 0 ? services : [
    { id: 'static-1', slug: 'barangay-clearance', title: 'Barangay Clearance', description: 'Official document required for various transactions', category_type: 'document' as const, is_active: true, sort_order: 1 },
    { id: 'static-2', slug: 'certificate-residency', title: 'Certificate of Residency', description: 'Legal document certifying local residency', category_type: 'document' as const, is_active: true, sort_order: 2 },
    { id: 'static-3', slug: 'business-permit', title: 'Business Permit', description: 'For new applications and renewals of local businesses', category_type: 'document' as const, is_active: true, sort_order: 3 },
    { id: 'static-4', slug: 'good-moral', title: 'Good Moral Certificate', description: 'Certifies good character for school or employment', category_type: 'document' as const, is_active: true, sort_order: 4 },
    { id: 'static-5', slug: 'indigency', title: 'Indigency Certificate', description: 'Required for welfare benefits and assistance programs', category_type: 'document' as const, is_active: true, sort_order: 5 },
  ]

  const serviceFilters: Record<string, string[]> = {
    all: servicesList.map((s) => s.slug),
    document: servicesList.filter((s) => s.category_type === 'document').map((s) => s.slug),
    appointment: servicesList.filter((s) => s.category_type === 'appointment').map((s) => s.slug),
  }

  // Filter services based on search and category
  const filteredServices = servicesList.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = serviceFilters[selectedFilter]?.includes(service.slug) ?? true
    
    return matchesSearch && matchesFilter
  })

  const handleServiceRequest = (service: ServiceCategory) => {
    const knownTypes = ['barangay-clearance', 'certificate-residency', 'business-permit', 'good-moral', 'indigency']
    const isKnownType = knownTypes.includes(service.slug)
    
    if (isKnownType) {
      setSelectedRequestType(service.slug as RequestType)
      setSelectedServiceInfo(null)
    } else {
      setSelectedRequestType(null)
      setSelectedServiceInfo({
        slug: service.slug,
        title: service.title,
        category: service.category_type,
        description: service.description || '',
      })
    }
    setIsFormOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RequestFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        requestType={selectedRequestType}
        serviceInfo={selectedServiceInfo}
      />

      {/* Main Content */}
      <main className="w-full">
        <div className="min-h-screen p-6 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Request Services
            </h1>
            <p className="text-gray-600">
              Browse and request available barangay services and documents
            </p>
            {loadError && (
              <p className="text-amber-600 text-sm mt-2">Note: Showing default services. Database unavailable.</p>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white rounded-[12px] shadow-sm p-6 mb-8 border border-gray-100">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search Bar */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Dropdown */}
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-[#28A745]">
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
              <div className="text-gray-400 mb-4">
                <Loader2 className="w-12 h-12 mx-auto opacity-50 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Loading services...
              </h3>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <DynamicServiceCard
                  key={service.id}
                  service={service}
                  onRequestClick={() => handleServiceRequest(service)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search className="w-12 h-12 mx-auto opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No services found
              </h3>
              <p className="text-gray-600 mb-6">
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