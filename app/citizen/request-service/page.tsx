'use client'

import { useState } from 'react'
import { ServiceCard, servicesList } from '@/components/citizen/service-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { RequestFormDialog } from '@/components/citizen/request-form-dialog'
import { type RequestType } from '@/lib/request-types'

const filterOptions = [
  { value: 'all', label: 'All Services' },
  { value: 'certificates', label: 'Certificates & Documents' },
  { value: 'clearances', label: 'Clearances' },
  { value: 'permits', label: 'Permits' },
  { value: 'assistance', label: 'Social Assistance' },
]

const serviceFilters: Record<string, string[]> = {
  all: ['barangay-clearance', 'certificate-residency', 'business-permit', 'good-moral', 'indigency'],
  certificates: ['certificate-residency', 'good-moral'],
  clearances: ['barangay-clearance'],
  permits: ['business-permit'],
  assistance: ['indigency'],
}

export default function RequestServicePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Filter services based on search and category
  const filteredServices = servicesList.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = serviceFilters[selectedFilter]?.includes(service.id) ?? true
    
    return matchesSearch && matchesFilter
  })

  const handleServiceRequest = (serviceId: string) => {
    setSelectedRequestType(serviceId as RequestType)
    setIsFormOpen(true)
  }

  const handleExploreAll = () => {
    // Reset filters to show all
    setSearchQuery('')
    setSelectedFilter('all')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RequestFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        requestType={selectedRequestType}
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
          {filteredServices.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  {...service}
                  onRequestClick={() => handleServiceRequest(service.id)}
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
