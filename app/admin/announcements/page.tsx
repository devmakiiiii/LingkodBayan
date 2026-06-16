'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { AlertCircle, CheckCircle2, Edit, Trash2, Eye, EyeOff, Megaphone, Search, Loader2, Upload, X, ImageIcon } from 'lucide-react'

const TinyMCEEditor = dynamic(() => import('@tinymce/tinymce-react').then((mod) => mod.Editor), {
  ssr: false,
})

const categories = ['Event', 'Update', 'Alert', 'Maintenance', 'News']

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  is_published: boolean
  image_url?: string | null
}

function isContentEmpty(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim() === ''
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    'event': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    'update': 'bg-primary/10 text-primary border-primary/20',
    'alert': 'bg-red-500/10 text-red-700 border-red-500/20',
    'maintenance': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    'news': 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  }
  return colors[category.toLowerCase()] || 'bg-gray-500/10 text-gray-700 border-gray-500/20'
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
  const [category, setCategory] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editIsPublished, setEditIsPublished] = useState(false)
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)

  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadAnnouncements()
  }, [])

  async function loadAnnouncements() {
    setLoadingAnnouncements(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('announcements')
        .select('id, title, content, category, created_at, is_published, image_url')
        .order('created_at', { ascending: false })

      setAnnouncements(data || [])
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  const filteredAnnouncements = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return announcements.filter((announcement) => {
      const matchesSearch =
        !query ||
        announcement.title.toLowerCase().includes(query) ||
        stripHtml(announcement.content).toLowerCase().includes(query) ||
        announcement.category.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && announcement.is_published) ||
        (statusFilter === 'draft' && !announcement.is_published)

      return matchesSearch && matchesStatus
    })
  }, [announcements, searchQuery, statusFilter])

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

    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      let imageUrl: string | null = null

      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      const { error: insertError } = await supabase.from('announcements').insert([
        {
          title,
          content,
          category,
          is_published: isPublished,
          image_url: imageUrl,
        },
      ])

      if (insertError) throw insertError

      setTitle('')
      setContent('')
      setCategory('')
      setIsPublished(false)
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
    setEditCategory(announcement.category)
    setEditIsPublished(announcement.is_published)
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
      const supabase = createClient()

      let finalImageUrl = editImageUrl

      if (editImageFile) {
        finalImageUrl = await uploadImage(editImageFile)
      }

      const { error: updateError } = await supabase
        .from('announcements')
        .update({
          title: editTitle,
          content: editContent,
          category: editCategory,
          is_published: editIsPublished,
          image_url: finalImageUrl,
        })
        .eq('id', editingAnnouncement.id)

      if (updateError) throw updateError

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

  async function deleteAnnouncement(announcement: Announcement) {
    if (!confirm(`Delete "${announcement.title}"? This action cannot be undone.`)) return

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcement.id)

      if (deleteError) throw deleteError

      loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement')
    }
  }

  async function togglePublish(announcement: Announcement) {
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('announcements')
        .update({ is_published: !announcement.is_published })
        .eq('id', announcement.id)

      if (updateError) throw updateError

      loadAnnouncements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update announcement status')
    }
  }

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
                    <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors h-32">
                      <Upload className="h-5 w-5 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-600 font-medium">Click to upload image</p>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP, or GIF</p>
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
                    Publish immediately
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {isPublished ? 'Published' : 'Draft'}
                  </span>
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
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'published' | 'draft')}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {loadingAnnouncements ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading announcements...</p>
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
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnnouncements.map((announcement) => (
                        <TableRow key={announcement.id}>
                          <TableCell>
                            <div className="font-medium">{announcement.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                              {truncateText(announcement.content)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(announcement.category)} variant="outline">
                              {announcement.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                announcement.is_published
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-gray-500/10 text-gray-700 border-gray-500/20'
                              }
                              variant="outline"
                            >
                              {announcement.is_published ? 'Published' : 'Draft'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(announcement.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePublish(announcement)}
                                title={announcement.is_published ? 'Unpublish' : 'Publish'}
                              >
                                {announcement.is_published ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(announcement)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAnnouncement(announcement)}
                                title="Delete"
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
                <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors h-32">
                  <Upload className="h-5 w-5 text-gray-400 mb-1" />
                  <p className="text-xs text-gray-600 font-medium">Click to upload image</p>
                  <p className="text-xs text-gray-500">PNG, JPG, WEBP, or GIF</p>
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
              <span className="text-xs text-muted-foreground">
                {editIsPublished ? 'Published' : 'Draft'}
              </span>
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
    </div>
  )
}