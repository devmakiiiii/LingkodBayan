'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { barangayInfoSchema, missionVisionSchema, signatureUploadSchema } from '@/lib/schemas'
import * as z from 'zod'

interface BarangayInfo {
  barangay_name: string
  address: string
  contact_number: string
  email: string
  office_hours: string
}

interface MissionVision {
  mission: string
  vision: string
  core_values: string[]
}

interface SignatureUploads {
  captain_signature_url: string | null
  secretary_signature_url: string | null
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

  // Form states
  const [barangayInfo, setBarangayInfo] = useState<BarangayInfo>({
    barangay_name: '',
    address: '',
    contact_number: '',
    email: '',
    office_hours: '',
  })

  const [missionVision, setMissionVision] = useState<MissionVision>({
    mission: '',
    vision: '',
    core_values: [],
  })

  const [signatureUploads, setSignatureUploads] = useState<SignatureUploads>({
    captain_signature_url: null,
    secretary_signature_url: null,
  })

  const [newCoreValue, setNewCoreValue] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoadError(null)
      const supabase = createClient()

      const { data, error } = await supabase.from('system_settings').select('*')

      if (error) {
        setLoadError(error?.message || 'Failed to load settings')
        return
      }

      console.log('Loaded settings:', data?.length || 0)

      const settingsMap: SystemSettings = {}
      data?.forEach((item) => {
        settingsMap[item.setting_key] = item.value
      })

      setSettings(settingsMap)

      // Populate forms
      if (settingsMap.barangay_info) {
        setBarangayInfo(settingsMap.barangay_info)
      }
      if (settingsMap.mission_vision) {
        setMissionVision(settingsMap.mission_vision)
      }
      if (settingsMap.signature_uploads) {
        setSignatureUploads(settingsMap.signature_uploads)
      }
    } finally {
      setLoading(false)
    }
  }

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

  async function handleSaveSignatures() {
    try {
      setSaving(true)
      const validated = signatureUploadSchema.parse(signatureUploads)

      const { error } = await supabase.from('system_settings').upsert({
        setting_key: 'signature_uploads',
        value: validated,
        updated_at: new Date(),
      })

      if (error) {
        toast.error(`Failed to save: ${error.message}`)
        return
      }

      toast.success('Signature uploads saved')
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save signature uploads')
      }
    } finally {
      setSaving(false)
    }
  }

  function addCoreValue() {
    if (newCoreValue.trim()) {
      setMissionVision({
        ...missionVision,
        core_values: [...missionVision.core_values, newCoreValue.trim()],
      })
      setNewCoreValue('')
    }
  }

  function removeCoreValue(index: number) {
    setMissionVision({
      ...missionVision,
      core_values: missionVision.core_values.filter((_, i) => i !== index),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
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
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-2">Configure barangay information, mission, vision, and official signatures</p>
        </div>
      </div>

      {/* Barangay Information */}
      <Card className="border-l-4 border-l-green-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                placeholder="e.g., Barangay Sampaguita"
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
              <Label>Core Values</Label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newCoreValue}
                  onChange={(e) => setNewCoreValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCoreValue()}
                  placeholder="Add a new core value"
                />
                <Button onClick={addCoreValue} variant="outline" size="sm" className="gap-1">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {missionVision.core_values.map((value, index) => (
                  <Badge key={index} variant="secondary" className="gap-2">
                    {value}
                    <button onClick={() => removeCoreValue(index)} className="text-xs hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleSaveMissionVision} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Mission & Vision
          </Button>
        </div>
      </Card>

      {/* Official Signatures */}
      <Card className="border-l-4 border-l-green-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Official Signatures
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                <strong>Phase 2 Feature:</strong> Upload signature images or URLs that will be automatically included in printed documents and reports. For now, enter the image URL or file path.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="captain_signature">Captain Signature URL</Label>
              <Input
                id="captain_signature"
                value={signatureUploads.captain_signature_url || ''}
                onChange={(e) => setSignatureUploads({ ...signatureUploads, captain_signature_url: e.target.value })}
                placeholder="https://example.com/signatures/captain.png"
              />
            </div>
            <div>
              <Label htmlFor="secretary_signature">Secretary Signature URL</Label>
              <Input
                id="secretary_signature"
                value={signatureUploads.secretary_signature_url || ''}
                onChange={(e) => setSignatureUploads({ ...signatureUploads, secretary_signature_url: e.target.value })}
                placeholder="https://example.com/signatures/secretary.png"
              />
            </div>
          </div>

          <Button onClick={handleSaveSignatures} disabled={saving} className="bg-green-600 hover:bg-green-700">
            Save Signature URLs
          </Button>
        </div>
      </Card>
    </div>
  )
}
