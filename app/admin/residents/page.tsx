'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Users, Mail, MapPin } from 'lucide-react'

interface Resident {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  barangay: string
  created_at: string
}

export default function AdminResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResidents()
  }, [])

  async function loadResidents() {
    try {
      const supabase = createClient()
      
      const { data } = await supabase
        .from('residents')
        .select('*')
        .order('created_at', { ascending: false })

      setResidents(data || [])
    } catch (error) {
      console.error('Error loading residents:', error)
    } finally {
      setLoading(false)
    }
  }

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
          <div className="text-4xl font-bold text-primary">{residents.length}</div>
        </CardContent>
      </Card>

      {/* Residents List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading residents...</p>
        </div>
      ) : residents.length === 0 ? (
        <Empty title="No residents" description="No residents have registered yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {residents.map((resident) => (
            <Card key={resident.id} className="hover:shadow-lg transition-shadow">
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

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Badge variant="outline">{resident.barangay}</Badge>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Registered: {new Date(resident.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
