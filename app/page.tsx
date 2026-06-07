'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Zap, Shield, Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Image
            src="/lingkod-logo.png"
            alt="LingkodBayan logo"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <div className="text-xl sm:text-2xl font-bold text-gray-900">LingkodBayan</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="outline" className="border-gray-300">Login</Button>
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
                <Button size="lg" variant="outline" className="w-full text-black border-white hover:bg-white/10">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Dashboard Mockup */}
          <div className="hidden md:block">
            <div className="bg-[#1a3a3a] rounded-lg p-6 border border-[#2d5a5a] shadow-2xl">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-gray-400">
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
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Why use LingkodBayan?</h2>
            <p className="text-gray-600 text-sm sm:text-base">
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
              <div key={i} className="bg-gray-50 rounded-lg p-6 sm:p-8">
                <div className="mb-4">{item.icon}</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Featured Services</h2>
            <Link href="/auth/sign-up" className="text-[#28A745] font-semibold hover:underline text-sm sm:text-base">
              View All Services →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { title: 'Barangay Clearance', desc: 'Request official clearance for employment or business.' },
              { title: 'Resident ID', desc: 'Apply for your digital and physical identification.' },
              { title: 'Business Permit', desc: 'Streamlined application for local micro and small enterprises.' },
              { title: 'Health Services', desc: 'Book appointments at your local health center online.' },
            ].map((service, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="h-32 sm:h-40 bg-gray-300"></div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">{service.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600">{service.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest News */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12">Latest News & Announcements</h2>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { 
                tag: 'COMMUNITY HEALTH',
                title: 'Barangay-wide Vaccination Drive Scheduled',
                date: 'May 15, 2026'
              },
              { 
                tag: 'INFRASTRUCTURE',
                title: 'Main Avenue Road Repair and Improvement',
                date: 'May 10, 2026'
              },
              { 
                tag: 'ANNOUNCEMENT',
                title: 'New Online Permit System Launched',
                date: 'May 8, 2026'
              },
            ].map((news, i) => (
              <div key={i} className="bg-gray-100 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer">
                <div className="h-32 sm:h-40 bg-gray-300"></div>
                <div className="p-4">
                  <span className="inline-block bg-[#28A745] text-white text-xs font-semibold px-3 py-1 rounded mb-3">
                    {news.tag}
                  </span>
                  <h3 className="font-bold text-gray-900 mb-2 text-sm sm:text-base">{news.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{news.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-linear-to-br from-[#001a4d] to-[#0d2d66] text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6 text-4xl">📡</div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Stay Connected with Your Community</h2>
          <p className="text-base sm:text-lg mb-8 text-gray-300">
            Join over 15,000 residents using LingkodBayan to build a more efficient and responsive barangay.
          </p>
          <Link href="/auth/sign-up" className="inline-block">
            <Button size="lg" className="bg-white text-[#001a4d] hover:bg-gray-100">
              Download Mobile App
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4 text-sm sm:text-base">LingkodBayan</h3>
              <p className="text-xs sm:text-sm">© 2026 LINGKODBAYAN CITIZEN PORTAL. ALL RIGHTS RESERVED.</p>
            </div>
            <div>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li><a href="#" className="hover:text-white">CONTACT US</a></li>
                <li><a href="#" className="hover:text-white">PRIVACY POLICY</a></li>
              </ul>
            </div>
            <div>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li><a href="#" className="hover:text-white">TERMS OF SERVICE</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div className="text-left sm:text-right">
              <div className="flex gap-4">
                <a href="#" className="text-gray-500 hover:text-white">⚙️</a>
                <a href="#" className="text-gray-500 hover:text-white">📱</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-xs sm:text-sm">
            <p>Crafted to empower communities and strengthen civic engagement</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
