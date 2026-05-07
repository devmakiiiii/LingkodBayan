'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const TinyMCEEditor = dynamic(() => import('@tinymce/tinymce-react').then((mod) => mod.Editor), {
  ssr: false,
})

const categories = ['Event', 'Update', 'Alert', 'Maintenance', 'News']

function isContentEmpty(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim() === ''
}

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
      const { error: insertError } = await supabase.from('announcements').insert([
        {
          title,
          content,
          category,
          is_published: isPublished,
        },
      ])

      if (insertError) throw insertError

      setTitle('')
      setContent('')
      setCategory('')
      setIsPublished(false)
      setSuccess(true)

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create announcement')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8 p-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Create Announcement</h1>
        <p className="text-muted-foreground mt-2">Share important updates with your barangay residents</p>
      </div>

      {/* Form Card */}
      <Card>
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
    </div>
  )
}
