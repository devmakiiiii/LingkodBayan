'use client'

import { useState, useEffect, Suspense } from 'react'
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
import { useSearchParams } from 'next/navigation'
import { AlertCircle, MapPin, Upload, X, ImageIcon, Zap } from 'lucide-react'
import { MapPicker } from '@/components/citizen/map-picker'
import { getOrCreateResidentProfile } from '@/lib/residents'
import { complaintCategories, type ComplaintCategory, analyzeComplaintPriority, complaintCategoryFallbackPriorities, complaintCategoryKeywords } from '@/lib/complaint-categories'
import { Badge } from '@/components/ui/badge'

interface IncidentCategory {
  id: string
  slug: string
  title: string
  description: string | null
  is_active: boolean
}

export default function FileComplaintPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationAddress, setLocationAddress] = useState<string | null>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const searchParams = useSearchParams()
  const preselectedCategory = searchParams.get('category')
  const router = useRouter()

  // Default incident categories when DB is unavailable
  const defaultCategories = complaintCategories.map((cat, idx) => ({
    id: `default-${idx}`,
    slug: cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    title: cat,
    description: cat,
    is_active: true,
  }))

  const activeCategories = incidentCategories.length > 0 ? incidentCategories : defaultCategories
  const selectedCategoryObj = activeCategories.find((c) => c.title === category)

  const detectedPriority = analyzeComplaintPriority(
    title,
    description,
    category ? complaintCategoryFallbackPriorities[category as ComplaintCategory] : 'low'
  ).priority

  useEffect(() => {
    loadIncidentCategories()
  }, [])

  async function loadIncidentCategories() {
    try {
      setLoadingCategories(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, slug, title, description, is_active')
        .eq('category_type', 'incident')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) {
        console.warn('Database unavailable, using default categories:', error.message)
        setIncidentCategories([])
        return
      }

      setIncidentCategories(data || [])
    } catch (err) {
      setIncidentCategories([])
    } finally {
      setLoadingCategories(false)
    }
  }

  // Initialize category with first available or preselected from URL
  useEffect(() => {
    if (activeCategories.length > 0) {
      if (preselectedCategory && activeCategories.some(c => c.title === preselectedCategory)) {
        setCategory(preselectedCategory)
      } else if (!category) {
        setCategory(activeCategories[0].title)
      }
    }
  }, [activeCategories, preselectedCategory])

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
        category ? complaintCategoryFallbackPriorities[category as ComplaintCategory] || 'low' : 'low'
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
<div className="p-4 md:p-6 max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">File a Complaint</h1>
        <p className="text-muted-foreground text-sm mt-1">Report issues or concerns with government services</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Complaint Details</CardTitle>
          <CardDescription className="text-xs">
            Provide detailed information to help us address your concern promptly
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="title" className="text-xs font-semibold">Complaint Title</Label>
              <Input
                id="title"
                placeholder="Brief summary of your complaint"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-semibold">Detailed Description</Label>
              <Textarea
                id="description"
                placeholder="Explain your complaint in detail. Include dates, names, and specific incidents..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="min-h-20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs font-semibold">Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.title}>
                        {cat.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between h-9 px-3 rounded-md bg-gray-50/50 border">
                <Label className="flex items-center gap-1.5 mb-0 text-xs font-semibold">
                  <Zap size={16} className="text-amber-600" />
                  Detected Priority
                </Label>
                <Badge
                  variant="secondary"
                  className={`text-xs px-2 py-0 ${
                    detectedPriority === 'critical'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : detectedPriority === 'high'
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : detectedPriority === 'medium'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {detectedPriority.charAt(0).toUpperCase() + detectedPriority.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <MapPin size={16} />
                  Pinpoint Complaint Location
                </Label>
                <div>
                  <Suspense fallback={<div className="h-[200px] bg-gray-100 rounded-md flex items-center justify-center text-xs">Loading map...</div>}>
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
                  <div className="bg-blue-50 p-1.5 rounded-md border border-blue-200">
                    <p className="text-xs text-blue-900 truncate">
                      <strong>Selected:</strong> {locationAddress}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <ImageIcon size={16} />
                  Evidence Photo (Optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Attach an image to support your complaint (max 5MB)
                </p>

                {!evidencePreview ? (
                  <div className="relative border-2 border-dashed rounded-lg p-3 h-24 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <Upload className="h-4 w-4 text-gray-400 mb-0.5" />
                    <p className="text-xs text-gray-600 font-medium">Click to upload</p>
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
                    <img src={evidencePreview} alt="Evidence preview" className="w-full h-24 object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full"
                      onClick={() => {
                        setEvidenceFile(null)
                        setEvidencePreview(null)
                        const fileInput = document.getElementById('evidence') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? 'Filing...' : 'File Complaint'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
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