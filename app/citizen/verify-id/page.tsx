'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, CheckCircle2, AlertCircle, Clock, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ID_TYPE_OPTIONS = [
  { value: 'philsys', label: 'PhilSys (National ID)' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voter', label: "Voter's ID" },
  { value: 'passport', label: 'Passport' },
  { value: 'umid', label: 'UMID' },
  { value: 'sss', label: 'SSS ID' },
  { value: 'tin', label: 'TIN ID' },
]

export default function VerifyIdPage() {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [idType, setIdType] = useState('philsys')
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrResult, setOcrResult] = useState<{
    extractedFields: Record<string, string>
    matchScore: number
    action: string
    verificationStatus: string
  } | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<
    'unverified' | 'auto_verified' | 'id_verified' | 'needs_review' | 'rejected'
  >('unverified')
  const [appealNote, setAppealNote] = useState('')
  const [isAppealing, setIsAppealing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkExistingStatus()
  }, [])

  async function checkExistingStatus() {
    try {
      const res = await fetch('/api/verification/status')
      if (res.ok) {
        const data = await res.json()
        if (data.verificationStatus) {
          setVerificationStatus(data.verificationStatus)
          if (data.verificationStatus !== 'unverified') {
            setOcrResult({
              extractedFields: data.verificationDetails?.ocrExtractedFields || {},
              matchScore: data.verificationConfidence || 0,
              action: data.verificationMethod || 'unknown',
              verificationStatus: data.verificationStatus,
            })
          }
        }
      }
    } catch (err) {
      console.error('Failed to check verification status:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an ID document first')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('idType', idType)

      const uploadPromise = fetch('/api/verification/upload-id', {
        method: 'POST',
        body: formData,
      })

      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Please try again.')), 30000)
      )

      const res = await Promise.race([uploadPromise, timeoutPromise])

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      await processId(data.signedUrl, data.idType)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  async function processId(signedUrl: string, idType: string) {
    setIsProcessing(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const expectedValues: Record<string, string> = {}
      if (user) {
        const { data: resident } = await supabase
          .from('residents')
          .select('first_name, last_name, middle_name, email, phone, address, barangay')
          .eq('user_id', user.id)
          .single()

        if (resident) {
          Object.assign(expectedValues, {
            firstName: resident.first_name,
            lastName: resident.last_name,
            middleName: resident.middle_name || '',
            email: resident.email,
            phone: resident.phone || '',
            address: resident.address || '',
            barangay: resident.barangay,
          })
        }
      }

      const processPromise = fetch('/api/verification/process-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedUrl,
          idType,
          expectedValues,
        }),
      })

      const processTimeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('ID processing timed out. Please try again.')), 30000)
      )

      const res = await Promise.race([processPromise, processTimeoutPromise])

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'OCR processing failed')
      }

      const data = await res.json()

      if (data.jobId) {
        await pollForOcrResult(data.jobId)
        return
      }

      setOcrResult({
        extractedFields: data.extractedFields,
        matchScore: data.matchScore,
        action: data.action,
        verificationStatus: data.verificationStatus,
      })
      setVerificationStatus(data.verificationStatus)

      if (data.action === 'auto_verify') {
        toast.success('Your ID has been verified automatically!')
        setTimeout(() => router.push('/citizen/dashboard'), 1500)
      } else if (data.action === 'id_verify') {
        toast.success('Your ID has been verified! You now have full access.')
      } else {
        toast('Your ID requires manual review. An admin will review it shortly.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'OCR processing failed'
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  async function pollForOcrResult(jobId: string) {
    const maxAttempts = 20
    const interval = 3000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, interval))

      const statusRes = await fetch(`/api/verification/process-id/status?jobId=${jobId}`)

      if (!statusRes.ok) {
        const data = await statusRes.json()
        throw new Error(data.error || 'Failed to check processing status')
      }

      const statusData = await statusRes.json()

      if (statusData.status === 'completed') {
        const result = statusData.result
        setOcrResult({
          extractedFields: result.extractedFields,
          matchScore: result.matchScore,
          action: result.action,
          verificationStatus: result.verificationStatus,
        })
        setVerificationStatus(result.verificationStatus)

        if (result.action === 'auto_verify') {
          toast.success('Your ID has been verified automatically!')
          setTimeout(() => router.push('/citizen/dashboard'), 1500)
        } else if (result.action === 'id_verify') {
          toast.success('Your ID has been verified! You now have full access.')
        } else {
          toast('Your ID requires manual review. An admin will review it shortly.')
        }
        return
      }

      if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'OCR processing failed')
      }
    }

    throw new Error('ID processing timed out. Please try again.')
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Appeal a rejection to a human reviewer instead of re-running the same
  // automated checks. The API moves the resident back to `needs_review` and
  // queues a manual_review attempt for the admin review queue.
  const handleAppeal = async () => {
    setIsAppealing(true)
    try {
      const res = await fetch('/api/verification/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: appealNote.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit appeal')
      }

      setVerificationStatus('needs_review')
      setAppealNote('')
      toast.success('Your appeal was submitted. An administrator will review your verification.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit appeal'
      toast.error(message)
    } finally {
      setIsAppealing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_verified':
      case 'id_verified':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
      case 'needs_review':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" /> Under Review</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><X className="h-3 w-3 mr-1" /> Rejected</Badge>
      default:
        return <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground"><AlertCircle className="h-3 w-3 mr-1" /> Not Verified</Badge>
    }
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Identity Verification</h1>
          <p className="text-muted-foreground mt-1">
            Upload a valid government ID to verify your identity
          </p>
        </div>
        {getStatusBadge(verificationStatus)}
      </div>

      {verificationStatus === 'auto_verified' && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Your account is verified!</span>
          </div>
          <p className="text-sm mt-1">You can now access all citizen portal features.</p>
        </div>
      )}

      {verificationStatus === 'needs_review' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Under Manual Review</CardTitle>
            <CardDescription className="text-yellow-700">
              Your verification is being reviewed by an administrator. You will be notified once it's approved.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {verificationStatus === 'rejected' && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Verification Rejected</CardTitle>
            <CardDescription className="text-red-700">
              Your ID submission was rejected. You can upload a clearer image to try again, or
              request a manual review by an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appeal-note" className="text-sm font-medium text-red-900">
                Message for the reviewer (optional)
              </Label>
              <Textarea
                id="appeal-note"
                value={appealNote}
                onChange={(e) => setAppealNote(e.target.value)}
                placeholder="Explain why your verification should be re-reviewed..."
                rows={3}
                maxLength={1000}
                className="bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setVerificationStatus('unverified')} variant="outline">
                Try Again (Re-upload ID)
              </Button>
              <Button
                onClick={handleAppeal}
                disabled={isAppealing}
                className="bg-primary hover:bg-primary/90"
              >
                {isAppealing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Request Human Review'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(verificationStatus === 'unverified' || verificationStatus === 'needs_review' || verificationStatus === 'rejected') && (
        <>
          {/* ID Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Your ID Type</CardTitle>
              <CardDescription>Choose the government-issued ID you will upload</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Upload Your ID</CardTitle>
              <CardDescription>
                Upload a clear, well-lit photo of your {ID_TYPE_OPTIONS.find((o) => o.value === idType)?.label || 'ID'}.
                Supported formats: JPG, PNG, WEBP (max 5MB).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-input rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-gray-400 dark:text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Click to upload or drag and drop your ID image</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="ID preview"
                    className="max-w-xs max-h-64 object-contain rounded-lg border border-gray-200 dark:border-border"
                  />
                  <button
                    onClick={handleRemoveFile}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Process Button */}
          {selectedFile && (
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleUpload}
                disabled={isUploading || isProcessing}
                className="bg-primary hover:bg-primary/90"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing ID (OCR)...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Verify My ID
                  </>
                )}
              </Button>
            </div>
          )}

          {/* OCR Results */}
          {ocrResult && (verificationStatus !== "rejected" && verificationStatus !== "unverified") && (
            <Card>
              <CardHeader>
                <CardTitle>Verification Results</CardTitle>
                <CardDescription>
                  System extracted the following fields from your ID and compared them with your account data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(ocrResult.extractedFields).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">{key}</Label>
                      <p className="text-sm font-medium">{value || 'N/A'}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Match Score</span>
                    <Badge variant={ocrResult.matchScore >= 75 ? 'default' : 'secondary'}>
                      {Math.round(ocrResult.matchScore)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium">Result</span>
                    <span className="text-sm">
                      {ocrResult.action === 'auto_verify' ? 'Auto-verified' :
                       ocrResult.action === 'id_verify' ? 'ID verified' :
                       ocrResult.action === 'needs_review' ? 'Needs manual review' :
                       'No match'}
                    </span>
                  </div>
                </div>

                {ocrResult.action === 'needs_review' && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Your verification requires manual review. An administrator will check your ID and approve it within 24-48 hours.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
