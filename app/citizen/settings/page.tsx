'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLocale, setLocale, type Locale } from '@/lib/i18n'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Languages,
  Bell,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '@/hooks/use-locale'

// Notification categories with citizen-facing copy. Keys double as i18n
// dictionary strings, matching the pattern used across the citizen portal.
const NOTIFICATION_CATEGORIES: Array<{
  key: keyof NotificationPreferences
  title: string
  description: string
}> = [
  {
    key: 'request_updates',
    title: 'Service request updates',
    description: 'Status changes and admin notes on your document requests',
  },
  {
    key: 'complaint_updates',
    title: 'Complaint updates',
    description: 'Replies and progress notes on complaints you filed',
  },
  {
    key: 'pickup_reminders',
    title: 'Document pickup reminders',
    description: 'Notices when your documents are ready for release',
  },
  {
    key: 'announcements',
    title: 'Barangay announcements',
    description: 'General announcements posted by the barangay hall',
  },
]

const VERIFICATION_LABELS: Record<string, string> = {
  unverified: 'Not verified',
  auto_verified: 'Verified (registry match)',
  id_verified: 'Verified (ID)',
  needs_review: 'Under review',
  rejected: 'Rejected',
}

type ResidentSummary = {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  barangay: string
  verification_status: string | null
}

export default function CitizenSettingsPage() {
  const { t } = useLocale()
  const router = useRouter()

  // Language — initialised from the existing cookie/localStorage layer.
  const [locale, setLocaleState] = useState<Locale>('en')
  const [isLocaleLoading, setIsLocaleLoading] = useState(true)

  // Notifications — null while loading, then the effective preference set.
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [prefsLoadFailed, setPrefsLoadFailed] = useState(false)

  // Account card.
  const [resident, setResident] = useState<ResidentSummary | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)

  useEffect(() => {
    setLocaleState(getLocale())
    setIsLocaleLoading(false)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [prefsResult, residentResult] = await Promise.all([
          supabase
            .from('user_notification_preferences')
            .select('request_updates, complaint_updates, pickup_reminders, announcements')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('residents')
            .select('first_name, last_name, email, phone, barangay, verification_status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (prefsResult.error) {
          console.warn('Preferences unavailable (migration 47 not applied?)')
          setPrefsLoadFailed(true)
        }
        setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(prefsResult.data ?? {}) })

        if (!residentResult.error && residentResult.data) {
          setResident(residentResult.data as ResidentSummary)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        setPrefsLoadFailed(true)
      } finally {
        setAccountLoaded(true)
      }
    }

    void load()
  }, [])

  function changeLocale(next: Locale) {
    if (next === locale) return
    setLocale(next)
    setLocaleState(next)
    window.dispatchEvent(new CustomEvent('lb-locale-changed'))

    // Same fire-and-forget persistence the sidebar LocaleToggle uses, so
    // server-side SMS notifications match the resident's choice.
    void fetch('/api/citizen/locale-preference', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {})
  }

  async function toggleCategory(key: keyof NotificationPreferences, enabled: boolean) {
    if (!prefs) return
    const next = { ...prefs, [key]: enabled }
    setPrefs(next) // Optimistic — revert below if the save fails.

    setIsSavingPrefs(true)
    try {
      const response = await fetch('/api/citizen/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) throw new Error(`Save failed (${response.status})`)
      toast.success(t('Notification preferences saved'))
    } catch {
      setPrefs(prefs)
      toast.error(t('Failed to save notification preferences'))
    } finally {
      setIsSavingPrefs(false)
    }
  }

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Language, notifications, and account details</p>
        </div>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            {t('Language')}
          </CardTitle>
          <CardDescription>
            {t('Choose the language used across the portal and in text notifications.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLocaleLoading ? (
            <Skeleton className="h-10 w-64" />
          ) : (
            <div className="flex gap-2" role="radiogroup" aria-label={t('Language')}>
              {([
                { value: 'en' as Locale, label: 'English' },
                { value: 'tl' as Locale, label: 'Filipino' },
              ]).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={locale === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => changeLocale(option.value)}
                  aria-pressed={locale === option.value}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t('Notifications')}
          </CardTitle>
          <CardDescription>
            {t('Choose which in-app notifications you receive.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {!accountLoaded || (prefs === null && !prefsLoadFailed) ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : prefsLoadFailed ? (
            <p className="text-sm text-muted-foreground">
              {t('Notification preferences are not available yet. Please try again later.')}
            </p>
          ) : (
            prefs && (
              <div className="divide-y">
                {NOTIFICATION_CATEGORIES.map((category) => (
                  <div key={category.key} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{t(category.title)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(category.description)}</p>
                    </div>
                    <Switch
                      checked={prefs[category.key]}
                      onCheckedChange={(checked) => toggleCategory(category.key, checked)}
                      disabled={isSavingPrefs}
                      aria-label={t(category.title)}
                    />
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t('Account')}
          </CardTitle>
          <CardDescription>
            {t('Your account details and verification status.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!accountLoaded ? (
            <Skeleton className="h-20 w-full" />
          ) : resident ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">{t('Name')}</p>
                <p className="text-sm font-medium">{resident.first_name} {resident.last_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">{t('Email')}</p>
                <p className="text-sm font-medium">{resident.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">{t('Phone')}</p>
                <p className="text-sm font-medium">{resident.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">{t('Verification status')}</p>
                <Badge
                  variant={
                    resident.verification_status === 'unverified' || resident.verification_status === 'rejected'
                      ? 'destructive'
                      : resident.verification_status
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {VERIFICATION_LABELS[resident.verification_status ?? ''] ?? t('Not verified')}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('Account details are unavailable.')}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => router.push('/citizen/verify-id')}>
              <ShieldCheck className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t('Identity verification')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.email) {
                  await supabase.auth.resetPasswordForEmail(user.email)
                  toast.success(t('Password reset email sent'))
                }
              }}
            >
              <KeyRound className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t('Change password')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

