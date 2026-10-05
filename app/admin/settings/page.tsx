'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CheckCircle, CalendarX, Megaphone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  barangayInfoSchema,
  missionVisionSchema,
  officeClosuresSchema,
  siteBannerSchema,
  BARANGAY_DISPLAY_NAME,
} from '@/lib/schemas'
import * as z from 'zod'

interface BarangayInfo {
  barangay_name: string
  address: string
  contact_number: string
  email: string
  office_hours: string
}

interface PledgeItem {
  title: string
  description: string
}

interface ClosureItem {
  date: string
  end_date: string
  reason: string
}

interface MissionVision {
  mission: string
  vision: string
  service_pledge: PledgeItem[]
}

interface SiteBanner {
  enabled: boolean
  message: string
  variant: 'info' | 'warning' | 'critical'
}

interface SystemSettings {
  [key: string]: any
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form states — the barangay name is a fixed system constant, so the form is
  // pre-filled with it instead of starting from an empty, guessable placeholder.
  const [barangayInfo, setBarangayInfo] = useState<BarangayInfo>({
    barangay_name: BARANGAY_DISPLAY_NAME,
    address: '',
    contact_number: '',
    email: '',
    office_hours: '',
  })

  const [missionVision, setMissionVision] = useState<MissionVision>({
    mission: '',
    vision: '',
    service_pledge: [],
  })

  const [closures, setClosures] = useState<ClosureItem[]>([])
  const [siteBanner, setSiteBanner] = useState<SiteBanner>({
    enabled: false,
    message: '',
    variant: 'info',
  })

  async function loadSettings() {
    try {
      setLoadError(null)
      const supabase = createClient()

      const { data, error } = await supabase.from('system_settings').select('*')

      if (error) {
        setLoadError(error?.message || 'Failed to load settings')
        return
      }

      const settingsMap: SystemSettings = {}
      data?.forEach((item: { setting_key: string; value: unknown }) => {
        settingsMap[item.setting_key] = item.value
      })

      setSettings(settingsMap)

      // Populate forms
      if (settingsMap.barangay_info) {
        const stored = settingsMap.barangay_info as BarangayInfo
        setBarangayInfo({
          ...stored,
          barangay_name: stored.barangay_name || BARANGAY_DISPLAY_NAME,
        })
      } else if (settingsMap.barangay_identity) {
        // No admin-saved info yet: pre-fill from the charter seed so the
        // form starts with the barangay's official contact details instead
        // of empty fields.
        const identity = settingsMap.barangay_identity as {
          address?: string
          phone?: string
          email?: string
        }
        setBarangayInfo((prev) => ({
          ...prev,
          address: identity.address || prev.address,
          contact_number: identity.phone || prev.contact_number,
          email: identity.email || prev.email,
        }))
      }
      if (settingsMap.mission_vision) {
        setMissionVision(settingsMap.mission_vision)
      }
      if (settingsMap.office_closures) {
        const stored = settingsMap.office_closures as { closures?: { date: string; end_date?: string; reason: string }[] }
        setClosures(
          (stored.closures || []).map((item) => ({
            date: item.date || '',
            end_date: item.end_date || '',
            reason: item.reason || '',
          }))
        )
      }
      if (settingsMap.site_banner) {
        const stored = settingsMap.site_banner as Partial<SiteBanner>
        setSiteBanner({
          enabled: stored.enabled === true,
          message: typeof stored.message === 'string' ? stored.message : '',
          variant: stored.variant === 'warning' || stored.variant === 'critical' ? stored.variant : 'info',
        })
      }
      // Legacy 'signature_uploads' key is intentionally ignored (feature removed).
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  async function handleSaveBarangayInfo() {
    try {
      setSaving(true)
      const validated = barangayInfoSchema.parse(barangayInfo)

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'barangay_info',
        value: validated,
        updated_at: new Date(),
      })

      if (error) {
        toast.error(`Failed to save: ${error.message}`)
        return
      }

      toast.success('Barangay information saved')
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save barangay information')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveMissionVision() {
    try {
      setSaving(true)
      const validated = missionVisionSchema.parse(missionVision)

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'mission_vision',
        value: validated,
        updated_at: new Date(),
      })

      if (error) {
        toast.error(`Failed to save: ${error.message}`)
        return
      }

      toast.success('Mission and vision saved')
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save mission and vision')
      }
    } finally {
      setSaving(false)
    }
  }

  function addPledgeItem() {
    setMissionVision({
      ...missionVision,
      service_pledge: [...missionVision.service_pledge, { title: '', description: '' }],
    })
  }

  function removePledgeItem(index: number) {
    setMissionVision({
      ...missionVision,
      service_pledge: missionVision.service_pledge.filter((_, i) => i !== index),
    })
  }

  function updatePledgeItem(index: number, field: 'title' | 'description', value: string) {
    setMissionVision({
      ...missionVision,
      service_pledge: missionVision.service_pledge.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    })
  }

  async function handleSaveClosures() {
    try {
      setSaving(true)
      const validated = officeClosuresSchema.parse({ closures })

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'office_closures',
        value: validated,
        updated_at: new Date(),
      })

      if (error) {
        toast.error(`Failed to save: ${error.message}`)
        return
      }

      toast.success('Office closures saved')
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save office closures')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSiteBanner() {
    try {
      setSaving(true)
      const validated = siteBannerSchema.parse(siteBanner)

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'site_banner',
        value: validated,
        updated_at: new Date(),
      })

      if (error) {
        toast.error(`Failed to save: ${error.message}`)
        return
      }

      toast.success(validated.enabled ? 'Announcement banner published' : 'Announcement banner turned off')
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save announcement banner')
      }
    } finally {
      setSaving(false)
    }
  }

  function addClosure() {
    setClosures([...closures, { date: '', end_date: '', reason: '' }])
  }

  function removeClosure(index: number) {
    setClosures(closures.filter((_, i) => i !== index))
  }

  function updateClosure(index: number, field: 'date' | 'end_date' | 'reason', value: string) {
    setClosures(closures.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-5xl mx-auto w-full">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto w-full">
      {loadError && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-4 text-sm text-amber-900">
            {loadError.includes('schema cache')
              ? 'Database tables are not ready yet. Run scripts/06_add_system_settings.sql in your Supabase SQL editor, then refresh.'
              : loadError}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">System Settings</h1>
          <p className="text-gray-500 dark:text-muted-foreground mt-2">Configure barangay information, mission, and vision</p>
        </div>
      </div>

      {/* Barangay Information */}
      <Card className="border-l-4 border-l-green-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Barangay Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="barangay_name">Barangay Name</Label>
              <Input
                id="barangay_name"
                value={barangayInfo.barangay_name}
                onChange={(e) => setBarangayInfo({ ...barangayInfo, barangay_name: e.target.value })}
                placeholder="Barangay Barretto"
              />
            </div>
            <div>
              <Label htmlFor="contact_number">Contact Number</Label>
              <Input
                id="contact_number"
                value={barangayInfo.contact_number}
                onChange={(e) => setBarangayInfo({ ...barangayInfo, contact_number: e.target.value })}
                placeholder="+63 2 1234 5678"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={barangayInfo.email}
                onChange={(e) => setBarangayInfo({ ...barangayInfo, email: e.target.value })}
                placeholder="barangay@example.com"
              />
            </div>
            <div>
              <Label htmlFor="office_hours">Office Hours</Label>
              <Input
                id="office_hours"
                value={barangayInfo.office_hours}
                onChange={(e) => setBarangayInfo({ ...barangayInfo, office_hours: e.target.value })}
                placeholder="Monday-Friday, 8:00 AM - 5:00 PM"
              />
            </div>
          </div>

          <div className="mb-6">
            <Label htmlFor="address">Complete Address</Label>
            <Textarea
              id="address"
              value={barangayInfo.address}
              onChange={(e) => setBarangayInfo({ ...barangayInfo, address: e.target.value })}
              placeholder="Full address of the barangay office"
              rows={3}
            />
          </div>

          <Button onClick={handleSaveBarangayInfo} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Barangay Information
          </Button>
        </div>
      </Card>

      {/* Mission & Vision */}
      <Card className="border-l-4 border-l-green-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Mission & Vision
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="mission">Mission Statement</Label>
              <Textarea
                id="mission"
                value={missionVision.mission}
                onChange={(e) => setMissionVision({ ...missionVision, mission: e.target.value })}
                placeholder="Enter the barangay mission statement"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="vision">Vision Statement</Label>
              <Textarea
                id="vision"
                value={missionVision.vision}
                onChange={(e) => setMissionVision({ ...missionVision, vision: e.target.value })}
                placeholder="Enter the barangay vision statement"
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Service Pledge</Label>
                <Button onClick={addPledgeItem} variant="outline" size="sm" className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add Commitment
                </Button>
              </div>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mb-3">
                The commitments the barangay makes to its residents (e.g., &quot;Prompt and Courteous Service&quot;).
              </p>

              {missionVision.service_pledge.length === 0 ? (
                <div className="border border-dashed border-gray-300 dark:border-border rounded-lg p-6 text-center text-sm text-gray-500 dark:text-muted-foreground">
                  No pledge commitments yet. Click &quot;Add Commitment&quot; to add one.
                </div>
              ) : (
                <div className="space-y-3">
                  {missionVision.service_pledge.map((item, index) => (
                    <div key={index} className="border border-gray-200 dark:border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-green-600/10 text-green-700 dark:text-green-500 flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <Input
                          value={item.title}
                          onChange={(e) => updatePledgeItem(index, 'title', e.target.value)}
                          placeholder="Commitment title (e.g., Prompt and Courteous Service)"
                        />
                        <button
                          onClick={() => removePledgeItem(index)}
                          className="text-gray-400 hover:text-red-600 shrink-0"
                          aria-label={`Remove commitment ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updatePledgeItem(index, 'description', e.target.value)}
                        placeholder="Describe this commitment"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSaveMissionVision} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Mission & Vision
          </Button>
        </div>
      </Card>

      {/* Office Closures */}
      <Card className="border-l-4 border-l-red-600">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground flex items-center gap-2">
              <CalendarX className="w-5 h-5 text-red-600" />
              Office Closures
            </h2>
            <Button onClick={addClosure} variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add Closure
            </Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4">
            Announce days the barangay office is closed (holidays, maintenance, emergencies). Upcoming closures are shown
            to residents on the homepage.
          </p>

          {closures.length === 0 ? (
            <div className="border border-dashed border-gray-300 dark:border-border rounded-lg p-6 text-center text-sm text-gray-500 dark:text-muted-foreground mb-4">
              No closures configured. Click &quot;Add Closure&quot; to announce one.
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {closures.map((item, index) => (
                <div key={index} className="border border-gray-200 dark:border-border rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`closure-start-${index}`} className="text-xs">
                        Start date
                      </Label>
                      <Input
                        id={`closure-start-${index}`}
                        type="date"
                        value={item.date}
                        onChange={(e) => updateClosure(index, 'date', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`closure-end-${index}`} className="text-xs">
                        End date (optional)
                      </Label>
                      <Input
                        id={`closure-end-${index}`}
                        type="date"
                        value={item.end_date}
                        onChange={(e) => updateClosure(index, 'end_date', e.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="grow">
                        <Label htmlFor={`closure-reason-${index}`} className="text-xs">
                          Reason
                        </Label>
                        <Input
                          id={`closure-reason-${index}`}
                          value={item.reason}
                          onChange={(e) => updateClosure(index, 'reason', e.target.value)}
                          placeholder="e.g., Regular holiday — All Saints' Day"
                        />
                      </div>
                      <button
                        onClick={() => removeClosure(index)}
                        className="text-gray-400 hover:text-red-600 shrink-0 pb-2"
                        aria-label={`Remove closure ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleSaveClosures} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Office Closures
          </Button>
        </div>
      </Card>

      {/* Announcement Banner */}
      <Card className="border-l-4 border-l-amber-500">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            Announcement Banner
          </h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4">
            An urgent notice displayed at the top of the public homepage — ideal for typhoon advisories, sudden office
            closures, or system maintenance. For regular news, publish an announcement instead.
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <Switch
                id="banner_enabled"
                checked={siteBanner.enabled}
                onCheckedChange={(checked) => setSiteBanner({ ...siteBanner, enabled: checked })}
              />
              <Label htmlFor="banner_enabled">Show banner on the homepage</Label>
            </div>

            <div>
              <Label htmlFor="banner_message">Banner message</Label>
              <Textarea
                id="banner_message"
                value={siteBanner.message}
                onChange={(e) => setSiteBanner({ ...siteBanner, message: e.target.value })}
                placeholder="e.g., The barangay office is closed today, November 1, due to All Saints' Day."
                rows={2}
                maxLength={300}
              />
            </div>

            <div>
              <Label htmlFor="banner_variant">Style</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'info', label: 'Info (blue)' },
                    { value: 'warning', label: 'Warning (amber)' },
                    { value: 'critical', label: 'Critical (red)' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSiteBanner({ ...siteBanner, variant: option.value })}
                    className={`rounded-md border px-3 py-1.5 text-sm transition ${
                      siteBanner.variant === option.value
                        ? 'border-green-600 bg-green-600/10 font-medium text-green-700 dark:text-green-500'
                        : 'border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleSaveSiteBanner} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Banner
          </Button>
        </div>
      </Card>
    </div>
  )
}
