'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, X, Home, FileText, AlertCircle, Megaphone, Plus, Bell, Loader2 } from 'lucide-react'
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

const navItems = [
  { href: '/citizen/dashboard', label: 'Dashboard', icon: Home },
  { href: '/citizen/my-requests', label: 'My Requests', icon: FileText },
  { href: '/citizen/request-service', label: 'Request Service', icon: Plus },
  { href: '/citizen/my-complaints', label: 'My Complaints', icon: AlertCircle },
  { href: '/citizen/announcements', label: 'Announcements', icon: Megaphone },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string>('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.first_name || user.email?.split('@')[0] || 'Resident')

        const { count, error } = await supabase
          .from('complaint_messages')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('recipient_user_id', user.id)

        if (error) {
          console.warn('Failed to load unread messages count:', error.message)
          setUnreadCount(0)
        } else {
          setUnreadCount(count || 0)
        }
      }
    }
    loadUser()
  }, [])

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
          <Link href="/citizen/dashboard" onClick={() => setIsOpen(false)}>
            <h1 className="text-2xl font-bold text-white tracking-wider">LINGKOD BAYAN</h1>
            <p className="text-xs text-gray-300 mt-1">Citizen Portal</p>
          </Link>
        </div>

        {/* User Welcome */}
        <div className="px-6 py-4 border-b border-[#0d2d66]">
          <p className="text-xs text-gray-400">Welcome,</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-white truncate">{userName}</p>
            <Link href="/citizen/notifications" onClick={() => setIsOpen(false)}>
              <button className="relative rounded-full p-2 text-white hover:bg-[#0d2d66] transition-colors" aria-label="Open notifications">
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
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
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
            )
          })}
        </nav>

        {/* Sign Out Button */}
        <div className="p-4 border-t border-[#0d2d66]">
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
