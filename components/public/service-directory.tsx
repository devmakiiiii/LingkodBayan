'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  Heart,
  PhilippinePeso,
  Scale,
  Search,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  NOT_SPECIFIED,
  directoryCategories,
  formatProcessingTime,
  formatServiceFee,
  getDirectoryCategoryLabel,
  getServiceTypeLabel,
} from '@/lib/charter-services'

export interface DirectoryService {
  slug: string
  title: string
  description: string | null
  category_type: string
  directory_category: string | null
  fee_type: string | null
  fee_amount_min: number | null
  fee_amount_max: number | null
  fee_description: string | null
  processing_time_text: string | null
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  appointment: <Calendar className="w-5 h-5" />,
  health: <Heart className="w-5 h-5" />,
  emergency: <AlertTriangle className="w-5 h-5" />,
  justice: <Scale className="w-5 h-5" />,
  program: <Users className="w-5 h-5" />,
}

function FeeBadge({ service }: { service: DirectoryService }) {
  if (!service.fee_type || service.fee_type === 'unspecified') return null
  const label = formatServiceFee(service)
  if (!label || label === NOT_SPECIFIED) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-muted-foreground">
      <PhilippinePeso className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

function TimeBadge({ service }: { service: DirectoryService }) {
  if (!service.processing_time_text) return null
  const label = formatProcessingTime(service)
  if (!label || label === NOT_SPECIFIED) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-muted-foreground">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * Searchable, filterable list of the services the barangay offers.
 *
 * This is the public face of the Citizen's Charter: everything shown comes from
 * the charter-seeded `service_categories` rows, and any value the charter does
 * not specify is omitted rather than invented (see lib/charter-services.ts).
 */
export function ServiceDirectory({ services }: { services: DirectoryService[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((service) => {
      const matchesQuery =
        q.length === 0 ||
        service.title.toLowerCase().includes(q) ||
        (service.description || '').toLowerCase().includes(q)
      const matchesCategory =
        activeCategory === 'all' ||
        (service.directory_category ?? 'general') === activeCategory
      return matchesQuery && matchesCategory
    })
  }, [services, query, activeCategory])

  // Only offer a category chip when at least one service sits under it, so the
  // filter row never advertises an empty group.
  const availableCategories = useMemo(() => {
    const present = new Set(services.map((s) => s.directory_category ?? 'general'))
    return directoryCategories.filter((c) => present.has(c.value))
  }, [services])

  const grouped = useMemo(() => {
    const groups = new Map<string, DirectoryService[]>()
    filtered.forEach((service) => {
      const key = service.directory_category ?? 'general'
      const list = groups.get(key)
      if (list) list.push(service)
      else groups.set(key, [service])
    })
    // Charter groupings first, uncategorised last — matches the portal's order.
    const ordered: Array<[string, DirectoryService[]]> = []
    directoryCategories.forEach((category) => {
      const list = groups.get(category.value)
      if (list) ordered.push([category.value, list])
    })
    const general = groups.get('general')
    if (general) ordered.push(['general', general])
    return ordered
  }, [filtered])

  const total = filtered.length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services…"
            aria-label="Search services"
            className="pl-9"
          />
        </div>

        {availableCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('all')}
              className={activeCategory === 'all' ? 'bg-[#218838] text-white hover:bg-[#1E7E34]' : ''}
            >
              All
            </Button>
            {availableCategories.map((category) => (
              <Button
                key={category.value}
                type="button"
                size="sm"
                variant={activeCategory === category.value ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category.value)}
                className={
                  activeCategory === category.value ? 'bg-[#218838] text-white hover:bg-[#1E7E34]' : ''
                }
              >
                {category.label}
              </Button>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground" role="status">
          {total} {total === 1 ? 'service' : 'services'}
          {query.trim() || activeCategory !== 'all' ? ' matching your filters' : ' available'}
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="font-medium">No services match your search.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different term, or clear the filters to see everything on offer.
          </p>
        </div>
      ) : (
        grouped.map(([key, list]) => (
          <section key={key} className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              {getDirectoryCategoryLabel(key === 'general' ? null : key)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((service) => (
                <article
                  key={service.slug}
                  className="flex flex-col rounded-lg border border-border bg-card p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#28A745]/10 text-[#28A745]">
                      {CATEGORY_ICONS[service.category_type] ?? <FileText className="w-5 h-5" />}
                    </span>
                    <span className="rounded-md border border-[#28A745]/20 bg-[#28A745]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1B6630]">
                      {getServiceTypeLabel(service.category_type)}
                    </span>
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold text-card-foreground">{service.title}</h3>
                  <p className="grow text-sm leading-relaxed text-muted-foreground">
                    {service.description || 'No description available.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <FeeBadge service={service} />
                    <TimeBadge service={service} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

