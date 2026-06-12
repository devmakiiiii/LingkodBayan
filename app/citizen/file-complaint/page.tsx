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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const resident = await getOrCreateResidentProfile(supabase, user)
      if (!resident) throw new Error('Resident profile not found')

      let evidenceUrl = null

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

      if (latitude) complaintData.latitude = latitude
      if (longitude) complaintData.longitude = longitude
      if (locationAddress) complaintData.location_address = locationAddress
      if (evidenceUrl) complaintData.evidence_url = evidenceUrl

      const { error: insertError } = await supabase.from('complaints').insert([complaintData])

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
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">File a Complaint</h1>
        <p className="text-muted-foreground mt-2">Report issues or concerns with government services</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complaint Details</CardTitle>
          <CardDescription>
            Provide detailed information to help us address your concern promptly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea
                id="description"
                placeholder="Explain your complaint in detail. Include dates, names, and specific incidents..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                The more details you provide, the better we can assist you
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50/50 border">
                <Label className="flex items-center gap-2 mb-0">
                  <Zap size={18} className="text-amber-600" />
                  Detected Priority
                </Label>
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
                  {detectedPriority.charAt(0).toUpperCase() + detectedPriority.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin size={18} />
                  Pinpoint Complaint Location
                </Label>
                <div>
                  <Suspense fallback={<div className="h-[250px] bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>}>
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
                  <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong>Selected:</strong> {locationAddress}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon size={18} />
                  Evidence Photo (Optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Attach an image to support your complaint (max 5MB)
                </p>
                
                {!evidencePreview ? (
                  <div className="relative border-2 border-dashed rounded-lg p-4 h-32 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <Upload className="h-5 w-5 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-600 font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">PNG, JPG or WEBP</p>
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
                    <img src={evidencePreview} alt="Evidence preview" className="w-full h-32 object-cover" />
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
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-3">
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