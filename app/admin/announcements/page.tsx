'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useMemo } from 'react'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Calendar, CheckCircle2, Edit, Trash2, Eye, EyeOff, Megaphone, Pin, Search, Loader2, Upload, X, ImageIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ANNOUNCEMENT_CATEGORIES, getAnnouncementCategoryColor } from '@/lib/announcement-categories'
import { sanitizeRichText } from '@/lib/html-sanitize'
import {
  ANNOUNCEMENT_STATUS_CLASSES,
  ANNOUNCEMENT_STATUS_LABELS,
  getAnnouncementStatus,
  toDateTimeLocalValue,
  type AnnouncementStatus,
} from '@/lib/announcements'

const TinyMCEEditor = dynamic(() => import('@tinymce/tinymce-react').then((mod) => mod.Editor), {
  ssr: false,
})

// Shared with the citizen views so the picker can never offer a category the
// public pages have no badge colour for.
const categories = ANNOUNCEMENT_CATEGORIES

const MAX_EXCERPT_LENGTH = 500

interface Announcement {
  id: string
  title: string
  content: string
  excerpt?: string | null
  category: string
  created_at: string
  updated_at?: string | null
  published_at?: string | null
  expires_at?: string | null
  pinned?: boolean | null
  is_published: boolean
  image_url?: string | null
}

/** Rows in the Manage table, sorted the way the citizen feed is sorted. */
type AnnouncementRow = Announcement & { status: AnnouncementStatus }

function isContentEmpty(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim() === ''
}

function formatAdminDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
}

function truncateText(text: string, length = 80) {
  const stripped = stripHtml(text)
  if (stripped.length <= length) return stripped
  return stripped.slice(0, length) + '...'
}

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [category, setCategory] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [pinned, setPinned] = useState(false)
  // Empty = publish immediately when "publish" is on; a future value schedules it.
  const [publishAt, setPublishAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AnnouncementStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editExcerpt, setEditExcerpt] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editIsPublished, setEditIsPublished] = useState(false)
  const [editPinned, setEditPinned] = useState(false)
  const [editPublishAt, setEditPublishAt] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)

  const [savingEdit, setSavingEdit] = useState(false)

  const [publishBusyId, setPublishBusyId] = useState<string | null>(null)
  const [previewAnnouncement, setPreviewAnnouncement] = useState<AnnouncementRow | null>(null)
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function loadAnnouncements() {
    setLoadingAnnouncements(true)
    setConfigError(null)

    if (!hasSupabaseConfig()) {
      setConfigError('Supabase environment variables are missing. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart pnpm dev.')
      setAnnouncements([])
      setLoadingAnnouncements(false)
      return
    }

    try {
      const response = await fetch('/api/admin/announcements')

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch announcements: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setAnnouncements(result.announcements || [])
    } catch (error: any) {
      console.error('Error loading announcements:', error)
      setError(error.message || 'Failed to load announcements')
      setAnnouncements([])
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  const filteredAnnouncements = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return announcements
      .map<AnnouncementRow>((announcement) => ({
        ...announcement,
        status: getAnnouncementStatus(announcement),
      }))
      .filter((announcement) => {
        const matchesSearch =
          !query ||
          announcement.title.toLowerCase().includes(query) ||
          stripHtml(announcement.content).toLowerCase().includes(query) ||
          announcement.category.toLowerCase().includes(query)

        const matchesStatus = statusFilter === 'all' || statusFilter === announcement.status

        const matchesCategory =
          categoryFilter === 'all' ||
          announcement.category.toLowerCase() === categoryFilter.toLowerCase()

        return matchesSearch && matchesStatus && matchesCategory
      })
      // Pinned first, then the newest publish time — mirrors the citizen feed.
      .sort((a, b) => {
        const pinnedDiff = Number(b.pinned ?? false) - Number(a.pinned ?? false)
        if (pinnedDiff !== 0) return pinnedDiff

        return (
          new Date(b.published_at || b.created_at).getTime() -
          new Date(a.published_at || a.created_at).getTime()
        )
      })
  }, [announcements, searchQuery, statusFilter, categoryFilter])

  async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)

    const uploadResponse = await fetch('/api/admin/announcement-images', {
      method: 'POST',
      body: formData,
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      throw new Error('Failed to upload image: ' + errorData.error)
    }

    const uploadResult = await uploadResponse.json()
    return uploadResult.url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isContentEmpty(content)) {
      setError('Content is required.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          excerpt: excerpt || null,
          category,
          is_published: isPublished,
          image_url: imageUrl,
          publish_at: publishAt || null,
          expires_at: expiresAt || null,
          pinned,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create announcement')
      }

      setTitle('')
      setContent('')
      setExcerpt('')
      setCategory('')
      setIsPublished(false)
      setPinned(false)
      setPublishAt('')
      setExpiresAt('')
      setImageFile(null)
      setImagePreview(null)
      setSuccess(true)

      setTimeout(() => setSuccess(false), 3000)
      loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create announcement')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEdit(announcement: Announcement) {
    setEditingAnnouncement(announcement)
    setEditTitle(announcement.title)
    setEditContent(announcement.content)
    setEditExcerpt(announcement.excerpt || '')
    setEditCategory(announcement.category)
    setEditIsPublished(announcement.is_published)
    setEditPinned(Boolean(announcement.pinned))
    setEditPublishAt(toDateTimeLocalValue(announcement.published_at))
    setEditExpiresAt(toDateTimeLocalValue(announcement.expires_at))
    setEditImageUrl(announcement.image_url || null)
    setEditDialogOpen(true)
  }

  async function saveEdit() {
    if (!editingAnnouncement) return

    if (isContentEmpty(editContent)) {
      setError('Content is required.')
      return
    }

    setSavingEdit(true)
    setError(null)

    try {
      let finalImageUrl = editImageUrl

      if (editImageFile) {
        finalImageUrl = await uploadImage(editImageFile)
      }

      const response = await fetch('/api/admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAnnouncement.id,
          title: editTitle,
          content: editContent,
          excerpt: editExcerpt || null,
          category: editCategory,
          is_published: editIsPublished,
          image_url: finalImageUrl,
          publish_at: editPublishAt || null,
          expires_at: editExpiresAt || null,
          pinned: editPinned,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update announcement')
      }

      setEditDialogOpen(false)
      setEditImageFile(null)
      setEditImagePreview(null)
      loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update announcement')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDeleteAnnouncement() {
    if (!announcementToDelete) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: announcementToDelete.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete announcement')
      }

      toast.success('Announcement deleted.')
      setAnnouncementToDelete(null)
      loadAnnouncements()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete announcement'
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  async function togglePublish(announcement: Announcement) {
    const nextPublished = !announcement.is_published
    setPublishBusyId(announcement.id)
    setError(null)

    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: announcement.id,
          is_published: nextPublished,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update announcement status')
      }

      toast.success(nextPublished ? 'Announcement published.' : 'Announcement moved back to draft.')
      loadAnnouncements()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update announcement status'
      setError(message)
      toast.error(message)
    } finally {
      setPublishBusyId(null)
    }
  }

  // Live status of the form so the admin sees Draft/Scheduled/Published/Expired
  // reflected before saving.
  const formStatus = getAnnouncementStatus({
    is_published: isPublished,
    published_at: publishAt ? new Date(publishAt).toISOString() : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  })

  const editFormStatus = getAnnouncementStatus({
    is_published: editIsPublished,
    published_at: editPublishAt ? new Date(editPublishAt).toISOString() : null,
    expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
  })

  const previewStatusText = !previewAnnouncement
    ? ''
    : previewAnnouncement.status === 'draft'
      ? 'Draft — not visible to residents'
      : previewAnnouncement.status === 'scheduled'
        ? `Scheduled for ${formatAdminDate(previewAnnouncement.published_at)}`
        : previewAnnouncement.status === 'expired'
          ? `Expired ${formatAdminDate(previewAnnouncement.expires_at)}`
          : `Published on ${formatAdminDate(previewAnnouncement.published_at)}`

  return (
    <div className="space-y-8 p-8 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground mt-1">Manage barangay announcements for residents</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
        </TabsList>

        {/* Create Tab */}
        <TabsContent value="create">
          {/* Form Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>New Announcement</CardTitle>
              <CardDescription>
                Create and publish announcements that will be visible to all residents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Barangay Health Fair This Weekend"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
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

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <TinyMCEEditor
                    licenseKey="gpl"
                    tinymceScriptSrc="/tinymce/tinymce.min.js"
                    value={content}
                    onEditorChange={(value) => setContent(value)}
                    init={{
                      height: 320,
                      menubar: false,
                      branding: false,
                      plugins: ['lists', 'link', 'table', 'code', 'wordcount'],
                      toolbar:
                        'undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist | link table | removeformat | code',
                      content_style:
                        'body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.6; }',
                      placeholder: 'Write your announcement here...',
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rich text content will be saved and shown to residents with formatting.
                  </p>
                </div>

                {/* Excerpt */}
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt / Summary (Optional)</Label>
                  <textarea
                    id="excerpt"
                    placeholder="Brief summary for the announcement preview... (auto-generated if left empty)"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    rows={3}
                    maxLength={MAX_EXCERPT_LENGTH}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      A short preview text shown on announcement cards. If empty, the first few lines of content will be used.
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {excerpt.length}/{MAX_EXCERPT_LENGTH}
                    </span>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <ImageIcon size={16} />
                    Announcement Image (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload an image to include with your announcement (max 5MB)
                  </p>

                  {!imagePreview ? (
                    <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-muted/50 hover:bg-gray-50 dark:hover:bg-muted dark:hover:bg-muted transition-colors h-32">
                      <Upload className="h-5 w-5 text-gray-400 dark:text-muted-foreground mb-1" />
                      <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">Click to upload image</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">PNG, JPG, WEBP, or GIF</p>
                      <Input
                        id="announcement-image"
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
                            setImageFile(file)
                            const reader = new FileReader()
                            reader.onloadend = () => {
                              setImagePreview(reader.result as string)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border max-w-xs">
                      <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full"
                        onClick={() => {
                          setImageFile(null)
                          setImagePreview(null)
                          const fileInput = document.getElementById('announcement-image') as HTMLInputElement
                          if (fileInput) fileInput.value = ''
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Publish Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border">
                  <input
                    type="checkbox"
                    id="published"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="published" className="flex-1 cursor-pointer">
                    Publish this announcement
                  </Label>
                  <Badge className={ANNOUNCEMENT_STATUS_CLASSES[formStatus]} variant="outline">
                    {ANNOUNCEMENT_STATUS_LABELS[formStatus]}
                  </Badge>
                </div>

                {/* Schedule & expiry */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="publish-at">Publish date &amp; time</Label>
                    <Input
                      id="publish-at"
                      type="datetime-local"
                      value={publishAt}
                      onChange={(e) => setPublishAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to publish now. A future date and time schedules it.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires-at">Expires at</Label>
                    <Input
                      id="expires-at"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Hidden from residents after this time.
                    </p>
                  </div>
                </div>

                {/* Pin to top */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border">
                  <input
                    type="checkbox"
                    id="pinned"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="pinned" className="flex-1 cursor-pointer">
                    Pin to the top of the citizen announcements list
                  </Label>
                  <Pin className={`h-4 w-4 ${pinned ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                </div>

                {/* Messages */}
                {error && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-primary">Announcement created successfully!</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create Announcement'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage Tab */}
        <TabsContent value="manage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Announcements</CardTitle>
              <CardDescription>View, edit, and manage all announcements</CardDescription>
            </CardHeader>
            {configError && (
              <div className="px-6 pb-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{configError}</p>
                </div>
              </div>
            )}
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as 'all' | AnnouncementStatus)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {loadingAnnouncements ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : filteredAnnouncements.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No announcements found.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnnouncements.map((announcement) => (
                        <TableRow key={announcement.id}>
                          <TableCell>
                            <div className="font-medium flex items-center gap-1.5">
                              {announcement.pinned && (
                                <Pin className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Pinned" />
                              )}
                              <span className="truncate">{announcement.title}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                              {truncateText(announcement.content)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getAnnouncementCategoryColor(announcement.category)} variant="outline">
                              {announcement.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={ANNOUNCEMENT_STATUS_CLASSES[announcement.status]}
                              variant="outline"
                            >
                              {ANNOUNCEMENT_STATUS_LABELS[announcement.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              {announcement.published_at
                                ? formatAdminDate(announcement.published_at)
                                : 'Not published'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {announcement.expires_at
                                ? `Expires ${formatAdminDate(announcement.expires_at)}`
                                : `Created ${formatAdminDate(announcement.created_at)}`}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewAnnouncement(announcement)}
                                title="Preview"
                                aria-label={`Preview ${announcement.title}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePublish(announcement)}
                                disabled={publishBusyId === announcement.id}
                                title={announcement.is_published ? 'Unpublish' : 'Publish'}
                                aria-label={
                                  announcement.is_published
                                    ? `Unpublish ${announcement.title}`
                                    : `Publish ${announcement.title}`
                                }
                              >
                                {publishBusyId === announcement.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : announcement.is_published ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(announcement)}
                                title="Edit"
                                aria-label={`Edit ${announcement.title}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAnnouncementToDelete(announcement)}
                                title="Delete"
                                aria-label={`Delete ${announcement.title}`}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update announcement details and publish status
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory} required>
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

            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <TinyMCEEditor
                licenseKey="gpl"
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                value={editContent}
                onEditorChange={(value) => setEditContent(value)}
                init={{
                  height: 280,
                  menubar: false,
                  branding: false,
                  plugins: ['lists', 'link', 'table', 'code', 'wordcount'],
                  toolbar:
                    'undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist | link table | removeformat | code',
                  content_style:
                    'body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.6; }',
                  placeholder: 'Write your announcement here...',
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-excerpt">Excerpt / Summary (Optional)</Label>
              <textarea
                id="edit-excerpt"
                placeholder="Brief summary for the announcement preview..."
                value={editExcerpt}
                onChange={(e) => setEditExcerpt(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                rows={3}
                maxLength={MAX_EXCERPT_LENGTH}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  A short preview text shown on announcement cards. If empty, the first few lines of content will be used.
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {editExcerpt.length}/{MAX_EXCERPT_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ImageIcon size={16} />
                Announcement Image
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload a new image or keep the existing one (max 5MB)
              </p>

              {editImagePreview ? (
                <div className="relative rounded-lg overflow-hidden border max-w-xs">
                  <img src={editImagePreview} alt="Preview" className="w-full h-32 object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full"
                    onClick={() => {
                      setEditImageFile(null)
                      setEditImagePreview(null)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : editImageUrl ? (
                <div className="relative rounded-lg overflow-hidden border max-w-xs">
                  <img src={editImageUrl} alt="Current image" className="w-full h-32 object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full"
                    onClick={() => setEditImageUrl(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-muted/50 hover:bg-gray-50 dark:hover:bg-muted dark:hover:bg-muted transition-colors h-32">
                  <Upload className="h-5 w-5 text-gray-400 dark:text-muted-foreground mb-1" />
                  <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">Click to upload image</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">PNG, JPG, WEBP, or GIF</p>
                  <Input
                    id="edit-announcement-image"
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
                        setEditImageFile(file)
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setEditImagePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border">
              <input
                type="checkbox"
                id="edit-published"
                checked={editIsPublished}
                onChange={(e) => setEditIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="edit-published" className="flex-1 cursor-pointer">
                Publish announcement
              </Label>
              <Badge className={ANNOUNCEMENT_STATUS_CLASSES[editFormStatus]} variant="outline">
                {ANNOUNCEMENT_STATUS_LABELS[editFormStatus]}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-publish-at">Publish date &amp; time</Label>
                <Input
                  id="edit-publish-at"
                  type="datetime-local"
                  value={editPublishAt}
                  onChange={(e) => setEditPublishAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to publish now. A future date and time schedules it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expires-at">Expires at</Label>
                <Input
                  id="edit-expires-at"
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Hidden from residents after this time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border">
              <input
                type="checkbox"
                id="edit-pinned"
                checked={editPinned}
                onChange={(e) => setEditPinned(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="edit-pinned" className="flex-1 cursor-pointer">
                Pin to the top of the citizen announcements list
              </Label>
              <Pin
                className={`h-4 w-4 ${editPinned ? 'text-primary' : 'text-muted-foreground'}`}
                aria-hidden="true"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingEdit}>Cancel</Button>
            </DialogClose>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewAnnouncement}
        onOpenChange={(open) => {
          if (!open) setPreviewAnnouncement(null)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>
              This is how the announcement appears to residents.
              {previewAnnouncement && previewAnnouncement.status !== 'published'
                ? ` Residents cannot see it while it is ${ANNOUNCEMENT_STATUS_LABELS[previewAnnouncement.status].toLowerCase()}.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {previewAnnouncement && (
            <article className="space-y-4">
              {previewAnnouncement.image_url ? (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <img
                    src={previewAnnouncement.image_url}
                    alt={previewAnnouncement.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-2xl font-bold text-balance">{previewAnnouncement.title}</h2>
                <Badge
                  className={getAnnouncementCategoryColor(previewAnnouncement.category)}
                  variant="outline"
                >
                  {previewAnnouncement.category}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{previewStatusText}</span>
                {previewAnnouncement.updated_at &&
                  new Date(previewAnnouncement.updated_at).getTime() -
                    new Date(
                      previewAnnouncement.published_at || previewAnnouncement.created_at,
                    ).getTime() >
                    60_000 && (
                    <span className="text-xs text-muted-foreground/80">
                      · Updated {formatAdminDate(previewAnnouncement.updated_at)}
                    </span>
                  )}
              </div>

              {previewAnnouncement.excerpt ? (
                <p className="text-muted-foreground italic">{previewAnnouncement.excerpt}</p>
              ) : null}

              <div
                className="prose prose-slate max-w-none text-foreground prose-p:my-3 prose-headings:mb-3 prose-headings:mt-0 prose-ul:my-3 prose-ol:my-3"
                // Stored HTML is sanitised on write; re-sanitising here also covers
                // rows created before that guard existed.
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(previewAnnouncement.content) }}
              />
            </article>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!announcementToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setAnnouncementToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              {announcementToDelete
                ? `"${announcementToDelete.title}" will be permanently deleted, including its image. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmDeleteAnnouncement()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}