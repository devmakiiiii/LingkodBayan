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
import { AlertCircle, MapPin, Upload, X, ImageIcon, Zap } from 'lucide-react'
import { MapPicker } from '@/components/citizen/map-picker'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { complaintCategories, type ComplaintCategory, analyzeComplaintPriority, complaintCategoryFallbackPriorities } from '@/lib/complaint-categories'
import { Badge } from '@/components/ui/badge'

export default function FileComplaintPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ComplaintCategory>('Sanitation')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationAddress, setLocationAddress] = useState<string | null>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const detectedPriority = analyzeComplaintPriority(
    title,
    description,
    complaintCategoryFallbackPriorities[category]
  ).priority

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

      let evidenceUrl = null

      // Upload evidence if selected
      if (evidenceFile) {
        const formData = new FormData()
        formData.append('file', evidenceFile)

        const uploadResponse = await fetch('/api/citizen/evidence', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error('Failed to upload evidence image: ' + errorData.error)
        }

        const uploadResult = await uploadResponse.json()
        evidenceUrl = uploadResult.url
      }

      // Create complaint with location
      const priorityAnalysis = analyzeComplaintPriority(
        title,
        description,
        complaintCategoryFallbackPriorities[category]
      )
      const complaintData: Record<string, any> = {
        resident_id: resident.id,
        title,
        description,
        category,
        status: 'open',
        priority_level: priorityAnalysis.priority,
      }

      // Add optional geolocation fields
      if (latitude) complaintData.latitude = latitude
      if (longitude) complaintData.longitude = longitude
      if (locationAddress) complaintData.location_address = locationAddress
      if (evidenceUrl) complaintData.evidence_url = evidenceUrl

      const { error: insertError, data: insertData } = await supabase.from('complaints').insert([complaintData])

      if (insertError) {
        console.error('Complaint insert error:', insertError)
        throw new Error(insertError.message || 'Failed to create complaint')
      }

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
              <Select value={category} onValueChange={(value) => setCategory(value as ComplaintCategory)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {complaintCategories.map((cat) => (
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

            {/* NLP Priority Detection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap size={18} className="text-amber-600" />
                Detected Priority Level
              </Label>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={
                    detectedPriority === 'critical'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : detectedPriority === 'high'
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : detectedPriority === 'medium'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {detectedPriority.charAt(0).toUpperCase() + detectedPriority.slice(1)} Priority
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Auto-detected based on your description
                </p>
              </div>
            </div>

            {/* Location Geotagging */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin size={18} />
                Pinpoint Complaint Location on Map
              </Label>
              <p className="text-xs text-muted-foreground">
                Click on the map to mark the exact location of your complaint within Barangay Barretto
              </p>
              <div className="relative">
                <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md">
                  <p className="text-sm font-medium text-primary">Barangay Barretto Map</p>
                </div>
                <Suspense fallback={<div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>}>
                  <MapPicker
                    onLocationSelect={(lat, lng, address) => {
                      setLatitude(lat)
                      setLongitude(lng)
                      setLocationAddress(address)
                    }}
                  />
                </Suspense>
              </div>
              {locationAddress && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Selected Location:</strong> {locationAddress}
                  </p>
                </div>
              )}
            </div>

            {/* Evidence Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon size={18} />
                Upload Evidence Photo (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Attach an image to support your complaint (max 5MB)
              </p>
              
              {!evidencePreview ? (
                <div className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG or WEBP</p>
                  <Input
                    id="evidence"
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          setError('File size must be less than 5MB')
                          return
                        }
                        setError(null)
                        setEvidenceFile(file)
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setEvidencePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={evidencePreview} alt="Evidence preview" className="w-full h-48 object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full"
                    onClick={() => {
                      setEvidenceFile(null)
                      setEvidencePreview(null)
                      const fileInput = document.getElementById('evidence') as HTMLInputElement
                      if (fileInput) fileInput.value = ''
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
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