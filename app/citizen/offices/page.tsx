'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Facebook, Loader2, Mail, MapPin, Phone } from 'lucide-react'
import { NOT_SPECIFIED, type Office } from '@/lib/charter-services'

function ContactRow({ icon, value }: { icon: React.ReactNode; value?: string | null }) {
  const display = value && value.trim() !== '' ? value : NOT_SPECIFIED
  const isFallback = display === NOT_SPECIFIED
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-[#28A745] shrink-0" aria-hidden="true">{icon}</span>
      <span className={isFallback ? 'italic text-muted-foreground' : 'text-foreground'}>{display}</span>
    </div>
  )
}

function OfficeCard({ office }: { office: Office }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{office.name}</CardTitle>
        {office.charter_category && (
          <CardDescription>{office.charter_category}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        <ContactRow icon={<MapPin className="h-4 w-4" />} value={office.address} />
        <ContactRow icon={<Phone className="h-4 w-4" />} value={office.phone} />
        <ContactRow icon={<Mail className="h-4 w-4" />} value={office.email} />
        {office.facebook && (
          <ContactRow icon={<Facebook className="h-4 w-4" />} value={office.facebook} />
        )}
      </CardContent>
    </Card>
  )
}

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOffices() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('offices')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        setOffices(data || [])
      } catch (error) {
        console.error('Error loading offices:', error)
      } finally {
        setLoading(false)
      }
    }
    loadOffices()
  }, [])

  const emergencyOffices = offices.filter((o) => ['bbfru', 'bpat'].includes(o.office_key))
  const directoryOffices = offices.filter((o) => !['bbfru', 'bpat'].includes(o.office_key))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted">
      <main className="w-full">
        <div className="min-h-screen p-6 md:p-8 space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-2">
              Offices Directory
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground">
              Contact details and service hours for barangay offices, based on the Citizen&apos;s Charter 2025.
            </p>
          </div>

          {/* Emergency hotline-first banner */}
          <div className="flex items-start gap-3 rounded-xl border border-[#DC3545]/30 bg-[#DC3545]/5 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#DC3545] mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#DC3545]">For emergencies, call first</p>
              <p className="text-sm text-gray-700 dark:text-muted-foreground mt-1">
                BBFRU Hotline <strong>0946-214-2438</strong> &middot; BPAT{' '}
                <strong>0938-949-5840</strong> &middot; National Emergency{' '}
                <strong>911</strong>. Online channels are only for follow-up and documentation.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading offices…
            </div>
          ) : (
            <>
              {/* Emergency units */}
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">
                    Emergency Units
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">
                    Call these numbers directly for urgent assistance.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {emergencyOffices.map((office) => (
                    <OfficeCard key={office.id} office={office} />
                  ))}
                </div>
              </section>

              {/* All other offices */}
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">
                    Barangay Offices
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">
                    {directoryOffices.length} offices listed.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {directoryOffices.map((office) => (
                    <OfficeCard key={office.id} office={office} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

