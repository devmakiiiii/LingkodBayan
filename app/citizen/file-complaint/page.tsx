'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, MapPin } from 'lucide-react'
import { MapPicker } from '@/components/citizen/map-picker'
import { getOrCreateResidentProfile } from '@/lib/residents'

const categories = [
  'Abuse of Power',
  'Corruption',
  'Poor Service',
  'Mismanagement',
  'Unsafe Conditions',
  'Environmental Issue',
  'Discrimination',
  'Other',
]

export default function FileComplaintPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationAddress, setLocationAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // Get user and resident
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const resident = await getOrCreateResidentProfile(supabase, user)
      if (!resident) throw new Error('Resident profile not found')

      // Create complaint with location
      const { error: insertError } = await supabase.from('complaints').insert([
        {
          resident_id: resident.id,
          title,
          description,
          category,
          status: 'pending',
          latitude: latitude || null,
          longitude: longitude || null,
          location_address: locationAddress || null,
        },
      ])

      if (insertError) throw insertError

      router.push('/citizen/my-complaints?success=Complaint filed successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to file complaint')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8 p-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">File a Complaint</h1>
        <p className="text-muted-foreground mt-2">Report issues or concerns with government services</p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Complaint Details</CardTitle>
          <CardDescription>
            Provide detailed information to help us address your concern promptly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Complaint Title</Label>
              <Input
                id="title"
                placeholder="Brief summary of your complaint"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Provide a clear and concise title
              </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea
                id="description"
                placeholder="Explain your complaint in detail. Include dates, names, and specific incidents..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="min-h-40"
              />
              <p className="text-xs text-muted-foreground">
                The more details you provide, the better we can assist you
              </p>
            </div>

            {/* Location Geotagging */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin size={18} />
                Pinpoint Complaint Location on Map
              </Label>
              <p className="text-xs text-muted-foreground">
                Click on the map to mark the exact location of your complaint
              </p>
              <Suspense fallback={<div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>}>
                <MapPicker
                  onLocationSelect={(lat, lng, address) => {
                    setLatitude(lat)
                    setLongitude(lng)
                    setLocationAddress(address)
                  }}
                />
              </Suspense>
              {locationAddress && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Selected Location:</strong> {locationAddress}
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? 'Filing...' : 'File Complaint'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
