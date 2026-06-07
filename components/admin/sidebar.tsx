'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, X, Home, Users, BarChart3, List, AlertCircle, Settings, ChevronDown, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: Home },
  { 
    label: 'Barangay Officials',
    icon: Users,
    hasDropdown: true,
    items: [
      { label: 'Officials List', href: '/admin/officials' },
      { label: 'Designations', href: '/admin/designations' },
    ]
  },
  { 
    label: 'Resident',
    icon: Users,
    hasDropdown: true,
    items: [
      { label: 'All Residents', href: '/admin/residents' },
      { label: 'Resident Reports', href: '/admin/resident-reports' },
    ]
  },
  { 
    label: 'Reports',
    icon: BarChart3,
    hasDropdown: true,
    items: [
      { label: 'Analytics', href: '/admin/analytics' },
      { label: 'Generated Reports', href: '/admin/generated-reports' },
    ]
  },
  { label: 'Request List', href: '/admin/requests', icon: List },
  { label: 'Complaints List', href: '/admin/complaints', icon: AlertCircle },
  { 
    label: 'Settings',
    icon: Settings,
    hasDropdown: true,
    items: [
      { label: 'System Settings', href: '/admin/settings' },
      { label: 'Service Categories', href: '/admin/service-categories' },
    ]
  },
]

interface DropdownItemType {
  label: string
  href: string
}

interface NavItemType {
  label: string
  href?: string
  icon: any
  hasDropdown?: boolean
  items?: DropdownItemType[]
}

export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  function isSubItemActive(href: string) {
    if (href.includes('?')) {
      const [path, queryString] = href.split('?')

      return pathname === path && searchParams.toString() === queryString
    }

    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setIsLoggingOut(false)
      setShowLogoutDialog(false)
    }
  }

  function toggleDropdown(label: string) {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    )
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#001a4d] text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 w-72 bg-[#001a4d] transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        z-40 md:z-auto flex flex-col h-screen
      `}>
        {/* Logo Section */}
        <div className="p-6 text-center border-b border-[#0d2d66]">
          <Link href="/admin/dashboard" onClick={() => setIsOpen(false)}>
            <h1 className="text-2xl font-bold text-white tracking-wider">LINGKOD BAYAN</h1>
            <p className="text-xs text-gray-300 mt-1">Admin Portal</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item: NavItemType, index) => {
            const Icon = item.icon
            const isExpanded = expandedMenus.includes(item.label)
            const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
            const hasActiveChild = item.items && item.items.some((subItem) => pathname === subItem.href)

            return (
              <div key={index}>
                {item.hasDropdown ? (
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isExpanded || hasActiveChild
                        ? 'bg-[#0d2d66] text-white'
                        : 'text-gray-300 hover:bg-[#0d2d66]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <Link href={item.href!} onClick={() => setIsOpen(false)}>
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#0d2d66] text-white'
                          : 'text-gray-300 hover:bg-[#0d2d66]/50'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </Link>
                )}

                {/* Dropdown Items */}
                {item.hasDropdown && isExpanded && item.items && (
                  <div className="mt-1 pl-4">
                    <div className="relative space-y-1">
                      {(() => {
                        const activeIndex = item.items.findIndex((subItem) => isSubItemActive(subItem.href))

                        return (
                          <>
                            {activeIndex >= 0 && (
                              <div
                                className="pointer-events-none absolute inset-x-0 h-10 rounded-lg bg-[#28A745] transition-transform duration-300 ease-out"
                                style={{ transform: `translateY(${activeIndex * 2.75}rem)` }}
                              />
                            )}
                            {item.items.map((subItem: DropdownItemType, subIndex) => (
                              <Link
                                key={subIndex}
                                href={subItem.href}
                                onClick={() => setIsOpen(false)}
                              >
                                <button
                                  className={`relative z-10 w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors ${
                                    isSubItemActive(subItem.href)
                                      ? 'text-white'
                                      : 'text-gray-300 hover:bg-[#0d2d66]/50'
                                  }`}
                                >
                                  {subItem.label}
                                </button>
                              </Link>
                            ))}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#0d2d66]">
          <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <DialogTrigger asChild>
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#e8dcc8] text-gray-900 font-semibold hover:bg-[#d9cdb8] transition-colors"
              >
                <LogOut size={20} />
                Logout
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md text-center p-6" showCloseButton={false}>
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-red-100 p-3">
                  <LogOut className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <DialogHeader className="flex flex-col items-center">
                  <DialogTitle className="text-xl">Confirm Logout</DialogTitle>
                  <DialogDescription className="text-center text-base pt-2">
                    Are you sure you want to log out of your account?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-center w-full gap-3 mt-4">
                  <DialogClose asChild>
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </DialogClose>
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={handleLogout}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Logout
                  </button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
