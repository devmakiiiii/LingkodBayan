'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  FileText,
  Heart,
  Mail,
  MapPin,
  Megaphone,
  PhilippinePeso,
  Phone,
  Scale,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import { InstallAppButton } from '@/components/install-app-button'
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client'
import { NOT_SPECIFIED, formatServiceFee, getServiceTypeLabel } from '@/lib/charter-services'
import { getAnnouncementCategoryColor } from '@/lib/announcement-categories'
import { formatDate } from '@/lib/format-date'

interface FeaturedService {
  slug: string
  title: string
  description: string | null
  category_type: string
  fee_type?: string | null
  fee_amount_min?: number | null
  fee_amount_max?: number | null
  fee_description?: string | null
}

/**
 * Static fallback shown until (or unless) service_categories responds.
 * Titles and descriptions mirror the Citizen's Charter seed data in
 * scripts/23_seed_charter_data.sql and scripts/07_seed_service_categories.sql.
 */
const FALLBACK_FEATURED_SERVICES: FeaturedService[] = [
  {
    slug: 'barangay-clearance',
    title: 'Barangay Clearance',
    description: 'Official document required for various transactions, confirming local residency in good standing.',
    category_type: 'document',
  },
  {
    slug: 'certificate-residency',
    title: 'Certificate of Residency',
    description: 'Certifies that the applicant is a resident of Barangay Barretto.',
    category_type: 'document',
  },
  {
    slug: 'indigency',
    title: 'Certificate of Indigency',
    description: 'Certifies that the applicant is indigent; for residents of Barangay Barretto.',
    category_type: 'document',
  },
  {
    slug: 'cedula-community-tax-certificate',
    title: 'Cedula / Community Tax Certificate',
    description: 'Community Tax Certificate issued based on declared income.',
    category_type: 'document',
  },
  {
    slug: 'medical-consultation-medicine',
    title: 'Medical Consultation and Dispensing of Medicine',
    description: 'Medical consultation with prescription and dispensing of available medicine.',
    category_type: 'health',
  },
  {
    slug: 'lupon-dispute-settlement',
    title: 'Lupong Tagapamayapa Dispute Settlement',
    description: 'Settles community disputes peacefully and outside court through mediation and conciliation (Katarungang Pambarangay).',
    category_type: 'justice',
  },
  {
    slug: 'emergency-response-fire-rescue',
    title: 'Emergency Response (Fire, Rescue, Disaster)',
    description: 'Fire suppression, rescue operations, and disaster response by the official emergency response team of Barangay Barretto.',
    category_type: 'emergency',
  },
  {
    slug: 'cdc-enrollment',
    title: 'Child Development Center (CDC) Enrollment',
    description: 'Early childhood care and development services addressing health, nutrition, early education, and social development for children aged 0–4 years.',
    category_type: 'program',
  },
]

const categoryIcons: Record<string, ReactNode> = {
  document: <FileText className="w-6 h-6" />,
  appointment: <Calendar className="w-6 h-6" />,
  health: <Heart className="w-6 h-6" />,
  emergency: <AlertTriangle className="w-6 h-6" />,
  justice: <Scale className="w-6 h-6" />,
  program: <Users className="w-6 h-6" />,
}

interface HomeAnnouncement {
  id: string
  title: string
  content?: string | null
  excerpt?: string | null
  category: string
  published_at?: string | null
  created_at: string
  image_url?: string | null
}

interface PublicContact {
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export default function Home() {
  const [featuredServices, setFeaturedServices] = useState<FeaturedService[]>(FALLBACK_FEATURED_SERVICES)
  const [newsItems, setNewsItems] = useState<HomeAnnouncement[]>([])
  const [contact, setContact] = useState<PublicContact | null>(null)

  // Upgrade the fallback list to live data when Supabase is reachable.
  // Any failure (missing config, network, RLS) simply keeps the fallback.
  useEffect(() => {
    let cancelled = false

    async function loadFeaturedServices() {
      if (!hasSupabaseConfig()) return

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .neq('category_type', 'incident')
          .order('sort_order', { ascending: true })
          .limit(8)

        if (!cancelled && !error && data && data.length > 0) {
          setFeaturedServices(data as FeaturedService[])
        }
      } catch {
        // Keep the static fallback list if the fetch fails.
      }
    }

    loadFeaturedServices()
    return () => {
      cancelled = true
    }
  }, [])

  // Latest News: top 3 published announcements from the public API. The
  // section stays hidden when there is nothing to show (empty database or
  // fetch error), so the homepage never displays placeholder news.
  useEffect(() => {
    let cancelled = false

    async function loadNews() {
      try {
        const res = await fetch('/api/public/announcements')
        if (!res.ok) return
        const json = await res.json()
        const announcements: HomeAnnouncement[] = Array.isArray(json.announcements)
          ? json.announcements
          : []
        if (!cancelled) setNewsItems(announcements.slice(0, 3))
      } catch {
        // Leave the section hidden if the fetch fails.
      }
    }

    loadNews()
    return () => {
      cancelled = true
    }
  }, [])

  // Footer contact details come from system_settings (admin-only under RLS)
  // through a whitelisted public endpoint; the contact column stays hidden
  // when it is unavailable.
  useEffect(() => {
    let cancelled = false

    async function loadContact() {
      try {
        const res = await fetch('/api/public/settings')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json.contact) setContact(json.contact)
      } catch {
        // Keep the footer without the contact column.
      }
    }

    loadContact()
    return () => {
      cancelled = true
    }
  }, [])

  const showContact = Boolean(contact && (contact.address || contact.phone || contact.email))

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="bg-white dark:bg-card border-b border-gray-200 dark:border-border px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Image
            src="/lingkod-logo.png"
            alt="LingkodBayan logo"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-foreground">LingkodBayan</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10" />
          <Link href="/auth/login">
            <Button variant="outline" className="border-gray-300 dark:border-input dark:border-border">Login</Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button className="bg-[#28A745] hover:bg-[#228039] text-white">Sign Up</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-linear-to-br from-[#001a4d] via-[#001a4d] to-[#0d2d66] text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                Walang pila,<br />walang hintayan
              </h1>
              <p className="text-2xl sm:text-3xl font-bold text-[#28A745]">serbisyo&apos;y mabilis para sa bayan</p>
            </div>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
              Empowering communities through digital governance. Submit requests, report concerns, and access essential services with institutional trust.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Link href="/auth/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-[#28A745] hover:bg-[#228039] text-white">
                  Get Started
                </Button>
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full bg-transparent text-white border-white hover:bg-white/10 hover:text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Dashboard Mockup */}
          <div className="hidden md:block">
            <div className="bg-[#1a3a3a] rounded-lg p-6 border border-[#2d5a5a] shadow-2xl">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-gray-400 dark:text-muted-foreground">
                  <span>Community</span>
                  <span>••••</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-gray-600 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-600 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-600 rounded w-2/3"></div>
                </div>
                <div className="flex justify-around items-end pt-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full border-4 border-[#d4a574] border-t-[#28A745] border-r-[#28A745] flex items-center justify-center">
                      <span className="text-[#d4a574] font-bold text-sm">3.8%</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[40, 60, 35, 50].map((h, i) => (
                      <div key={i} className="w-2 bg-[#28A745]" style={{height: `${h}px`}}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use LingkodBayan */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white dark:bg-card dark:bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-foreground mb-4">Why use LingkodBayan?</h2>
            <p className="text-gray-600 dark:text-muted-foreground text-sm sm:text-base">
              Designed for administrative oversight and community accessibility, ensuring every resident is heard.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: <Zap className="w-8 h-8 text-orange-500" />,
                title: 'Fast Processing',
                description: 'Automated workflows ensure your requests are routed to the right department instantly for rapid resolution.',
              },
              {
                icon: <Shield className="w-8 h-8 text-green-600" />,
                title: 'Institutional Trust',
                description: 'Secure identification and transparent tracking provide a dependable channel for government transactions.',
              },
              {
                icon: <Sparkles className="w-8 h-8 text-purple-500" />,
                title: 'AI-Enhanced Insights',
                description: 'Smart prioritization and insight generation help officials address the most critical community needs.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-muted dark:bg-card dark:border-border rounded-lg p-6 sm:p-8">
                <div className="mb-4">{item.icon}</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-foreground dark:text-card-foreground mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-muted-foreground text-sm sm:text-base leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50 dark:bg-muted/40">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-foreground">Featured Services</h2>
            <Link href="/auth/sign-up" className="text-[#28A745] font-semibold hover:underline text-sm sm:text-base">
              View All Services →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {featuredServices.map((service) => {
              const hasFeeData = Boolean(service.fee_type) && service.fee_type !== 'unspecified'
              const feeLabel = hasFeeData ? formatServiceFee(service) : null
              const showFee = feeLabel != null && feeLabel !== NOT_SPECIFIED

              return (
                <div
                  key={service.slug}
                  className="group flex flex-col bg-white dark:bg-card border border-gray-100 dark:border-border rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="w-11 h-11 shrink-0 rounded-lg bg-linear-to-br from-[#28A745]/10 to-[#28A745]/5 flex items-center justify-center text-[#28A745]">
                      {categoryIcons[service.category_type] ?? <CheckCircle className="w-6 h-6" />}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#28A745]/10 text-[#228039] whitespace-nowrap">
                      {getServiceTypeLabel(service.category_type)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-foreground dark:text-card-foreground mb-2 text-sm sm:text-base">
                    {service.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground leading-relaxed grow line-clamp-3">
                    {service.description || 'No description available'}
                  </p>
                  {showFee && (
                    <span className="mt-4 inline-flex items-center gap-1 self-start rounded-md border border-gray-200 dark:border-border px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-muted-foreground">
                      <PhilippinePeso className="h-3 w-3" aria-hidden="true" />
                      {feeLabel}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Latest News — hidden until real announcements load */}
      {newsItems.length > 0 && (
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white dark:bg-card dark:bg-background">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-foreground mb-12">Latest News & Announcements</h2>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {newsItems.map((announcement) => {
                const preview = announcement.excerpt || stripHtml(announcement.content || '')

                return (
                  <Link
                    key={announcement.id}
                    href={`/citizen/announcements/${announcement.id}`}
                    className="group block bg-gray-100 dark:bg-muted dark:bg-card dark:border-border rounded-lg overflow-hidden hover:shadow-lg transition"
                  >
                    <div className="relative h-32 sm:h-40 bg-linear-to-br from-[#001a4d] to-[#0d2d66]">
                      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Megaphone className="w-8 h-8 text-white/50" />
                      </div>
                      {announcement.image_url && (
                        <img
                          src={announcement.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <span className={`inline-block border px-3 py-1 rounded text-xs font-semibold mb-3 ${getAnnouncementCategoryColor(announcement.category)}`}>
                        {announcement.category}
                      </span>
                      <h3 className="font-bold text-gray-900 dark:text-foreground dark:text-card-foreground mb-2 text-sm sm:text-base group-hover:text-[#28A745] transition-colors">{announcement.title}</h3>
                      {preview && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground mb-2 line-clamp-2">{preview}</p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-muted-foreground">
                        {formatDate(announcement.published_at || announcement.created_at)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-linear-to-br from-[#001a4d] to-[#0d2d66] text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6 text-4xl">📡</div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Stay Connected with Your Community</h2>
          <p className="text-base sm:text-lg mb-8 text-gray-300">
            Join residents in your community using LingkodBayan to build a more efficient and responsive barangay.
          </p>
          <InstallAppButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-card dark:border-t dark:border-border text-gray-400 dark:text-muted-foreground py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4 text-sm sm:text-base">LingkodBayan</h3>
              <p className="text-xs sm:text-sm">© {new Date().getFullYear()} LINGKODBAYAN CITIZEN PORTAL. ALL RIGHTS RESERVED.</p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4 text-sm sm:text-base">Quick Links</h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li><Link href="/auth/login" className="hover:text-white">Login</Link></li>
                <li><Link href="/auth/sign-up" className="hover:text-white">Sign Up</Link></li>
                <li><Link href="/auth/forgot-password" className="hover:text-white">Forgot Password</Link></li>
              </ul>
            </div>
            {showContact && (
              <div>
                <h3 className="text-white font-bold mb-4 text-sm sm:text-base">Contact Us</h3>
                <ul className="space-y-2 text-xs sm:text-sm">
                  {contact?.address && (
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{contact.address}</span>
                    </li>
                  )}
                  {contact?.phone && (
                    <li className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{contact.phone}</span>
                    </li>
                  )}
                  {contact?.email && (
                    <li className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-xs sm:text-sm">
            <p>Crafted to empower communities and strengthen civic engagement</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
