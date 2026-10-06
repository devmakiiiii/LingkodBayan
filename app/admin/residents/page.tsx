'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Users, Mail, MapPin, CheckCircle2, Clock, ShieldAlert, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format-date'
import { BARANGAY_DISPLAY_NAME } from '@/lib/barangay'

const COLLAPSED_GROUPS_STORAGE_KEY = 'lb-admin-residents-collapsed-groups'

interface Resident {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: string | null
  barangay: string
  created_at: string
  verification_status?: string | null
}

const PAGE_SIZE = 20

/** Best-effort purok label pulled out of a stored address ("Purok 3", ...). */
function purokLabel(address: string | null | undefined) {
  const match = (address ?? '').match(/purok\s*[^,;]+/i)
  return match ? match[0].replace(/\s+/g, ' ').trim() : 'Unassigned purok'
}

const ResidentCard = React.memo(function ResidentCard({ resident }: { resident: Resident }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {resident.first_name} {resident.last_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="break-all">{resident.email}</span>
        </div>

        {resident.phone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Phone:</span>
            <span>{resident.phone}</span>
          </div>
        )}

        {resident.address && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Address:</span>
            <span>{resident.address}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Badge variant="outline">{resident.barangay}</Badge>
        </div>

        {resident.verification_status && (
          <div className="flex items-center gap-2 pt-2">
            {resident.verification_status === 'auto_verified' || resident.verification_status === 'id_verified' ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : resident.verification_status === 'needs_review' ? (
              <Badge className="bg-yellow-100 text-yellow-800">
                <Clock className="h-3 w-3 mr-1" />
                Under Review
              </Badge>
            ) : resident.verification_status === 'rejected' ? (
              <Badge className="bg-red-100 text-red-800">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Rejected
              </Badge>
            ) : (
              <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground">
                Unverified
              </Badge>
            )}
          </div>
        )}

                <p className="text-xs text-muted-foreground pt-2">
                  Registered: {formatDate(resident.created_at)}
                </p>
      </CardContent>
    </Card>
  )
})

export default function AdminResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY)
      if (stored) setCollapsedGroups(JSON.parse(stored) as Record<string, boolean>)
    } catch {
      // Ignore corrupt/unavailable localStorage — start expanded.
    }
  }, [])

  const updateCollapsedGroups = useCallback((next: Record<string, boolean>) => {
    setCollapsedGroups(next)
    try {
      window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage may be unavailable (private mode) — collapse state is session-only then.
    }
  }, [])

  const groupedResidents = useMemo(() => {
    const groups: Record<string, Resident[]> = {}
    for (const resident of residents) {
      const key = purokLabel(resident.address)
      ;(groups[key] ??= []).push(resident)
    }
    // Sort groups naturally: Purok 1, Purok 2, ... then Unassigned last.
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Unassigned purok') return 1
      if (b === 'Unassigned purok') return -1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [residents])


  /**
   * Loads one page of residents. `append` separates "Load More" (keep the rows
   * already on screen) from a first load / retry (replace them).
   *
   * Previously the fetcher was pinned to `range(0, PAGE_SIZE - 1)` and Load More
   * only called `mutate()`, so the button re-rendered the same first page and
   * residents past the twentieth were unreachable.
   */
  const loadResidents = useCallback(async (pageIndex: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      setError(null)

      const supabase = createClient()
      const from = pageIndex * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error: queryError, count } = await supabase
        .from('residents')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false })

      if (queryError) {
        throw new Error(queryError.message || 'Failed to load residents')
      }

      const pageRows = (data || []) as Resident[]
      setTotalCount(count ?? 0)
      setResidents((current) => (append ? [...current, ...pageRows] : pageRows))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError : new Error('Failed to load residents'))
      if (!append) setResidents([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    loadResidents(0, false)
  }, [loadResidents])

  const hasMore = residents.length < totalCount

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    loadResidents(nextPage, true)
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Residents Management</h1>
            <p className="text-muted-foreground mt-1">View all registered citizens of {BARANGAY_DISPLAY_NAME}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Total Registered Residents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">{totalCount.toLocaleString()}</div>
        </CardContent>
      </Card>

      {/* Residents List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading residents...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Failed to load residents</p>
          <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadResidents(page, false)}
            className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
          >
            Retry
          </Button>
        </div>
      ) : residents.length === 0 ? (
        <Empty title="No residents" description="No residents have registered yet" />
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              const anyCollapsed = groupedResidents.some(([key]) => collapsedGroups[key])
              updateCollapsedGroups(anyCollapsed ? {} : Object.fromEntries(groupedResidents.map(([key]) => [key, true])))
            }}
          >
            <ChevronsUpDown className="mr-1 h-4 w-4" />
            {groupedResidents.some(([key]) => collapsedGroups[key]) ? 'Expand All' : 'Collapse All'}
          </Button>

          <div className="space-y-6">
            {groupedResidents.map(([key, items]) => {
              const isCollapsed = collapsedGroups[key] === true

              return (
                <div key={key} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => updateCollapsedGroups({ ...collapsedGroups, [key]: !isCollapsed })}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center gap-3 text-left rounded-lg py-1"
                  >
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <h2 className="text-xl font-semibold">{key}</h2>
                    <Badge variant="outline">{items.length} resident(s)</Badge>
                  </button>

                  {!isCollapsed && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {items.map((resident) => (
                        <ResidentCard key={resident.id} resident={resident} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {isLoadingMore ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
