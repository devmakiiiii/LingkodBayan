'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, X, Home, FileText, AlertCircle, Megaphone, Plus, Bell, Loader2, ShieldCheck, Sun, Moon } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useNotifications } from '@/hooks/use-notifications'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/citizen/dashboard', label: 'Dashboard', icon: Home },
  { href: '/citizen/verify-id', label: 'Identity Verification', icon: ShieldCheck },
  { href: '/citizen/my-requests', label: 'My Requests', icon: FileText },
  { href: '/citizen/request-service', label: 'Request Service', icon: Plus },
  { href: '/citizen/my-complaints', label: 'My Complaints', icon: AlertCircle },
  { href: '/citizen/announcements', label: 'Announcements', icon: Megaphone },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string>('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const { unreadCount } = useNotifications()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.first_name || user.email?.split('@')[0] || 'Resident')
      }
    }
    loadUser()
  }, [])

  // Close the mobile sidebar after navigating to a new page
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Let keyboard users dismiss the mobile sidebar with Escape
  useEffect(() => {
    if (!isOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

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

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls="citizen-sidebar"
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-md"
      >
        {isOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>

      {/* Sidebar */}
      <aside id="citizen-sidebar" aria-label="Citizen navigation" className={`
        fixed md:relative inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        z-40 md:z-auto flex flex-col h-screen
      `}>
        {/* Logo Section */}
        <div className="p-6 text-center border-b border-sidebar-border">
          <Link href="/citizen/dashboard" onClick={() => setIsOpen(false)}>
            <h1 className="text-2xl font-bold text-sidebar-foreground tracking-wider">LINGKOD BAYAN</h1>
            <p className="text-xs text-sidebar-foreground/70 mt-1">Citizen Portal</p>
          </Link>
        </div>

        {/* User Welcome */}
        <div className="px-6 py-4 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60">Welcome,</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sidebar-foreground truncate">{userName}</p>
            <Link href="/citizen/notifications" onClick={() => setIsOpen(false)}>
              <button className="relative rounded-full p-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors" aria-label="Open notifications">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
                    {unreadCount}
                  </Badge>
                )}
              </button>
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-current={isActive ? 'page' : undefined}
              >
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </Link>
            )
          })}
        </nav>

        {/* Sign Out Button */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <ThemeToggle />
          <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <DialogTrigger asChild>
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#e8dcc8] text-gray-900 font-semibold hover:bg-[#d9cdb8] transition-colors"
              >
                <LogOut size={20} />
                Sign Out
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
                    <Button variant="outline" disabled={isLoggingOut} className="flex-1">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={handleLogout}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Logout
                  </Button>
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
