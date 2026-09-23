'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Users, Mail, MapPin, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format-date'

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
  const { data, error, isLoading, mutate } = useSWR<{ data: Resident[]; count: number }>(
    'admin-residents',
    async () => {
      const supabase = createClient()
      const from = 0
      const to = PAGE_SIZE - 1

      const { data, error, count } = await supabase
        .from('residents')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message || 'Failed to load residents')
      }

      return {
        data: (data || []) as Resident[],
        count: count ?? 0,
      }
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    },
  )

  const residents = data?.data ?? []
  const totalCount = data?.count ?? 0

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Residents Management</h1>
            <p className="text-muted-foreground mt-1">View all registered citizens in your barangay</p>
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
            onClick={() => mutate()}
            className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
          >
            Retry
          </Button>
        </div>
      ) : residents.length === 0 ? (
        <Empty title="No residents" description="No residents have registered yet" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {residents.map((resident) => (
              <ResidentCard key={resident.id} resident={resident} />
            ))}
          </div>

          {residents.length >= PAGE_SIZE && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => mutate()}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
