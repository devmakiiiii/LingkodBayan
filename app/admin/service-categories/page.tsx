'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, CheckCircle, Edit2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { serviceCategorySchema } from '@/lib/schemas'
import * as z from 'zod'

interface ServiceCategory {
  id: string
  slug: string
  title: string
  description: string | null
  category_type: 'document' | 'appointment' | 'incident'
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface FormData {
  slug: string
  title: string
  description: string
  category_type: 'document' | 'appointment' | 'incident'
  is_active: boolean
  sort_order: number
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  document: { label: 'Document Request', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  appointment: { label: 'Appointment Type', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  incident: { label: 'Incident/Blotter', color: 'bg-orange-100 text-orange-800 border-orange-300' },
}

export default function AdminServiceCategoriesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // Dialog state
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    slug: '',
    title: '',
    description: '',
    category_type: 'document',
    is_active: true,
    sort_order: 999,
  })

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      setLoadError(null)
      setLoading(true)
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true })

      if (error) {
        setLoadError(error?.message || 'Failed to load categories')
        toast.error('Failed to load service categories')
        return
      }

      setCategories(data || [])
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingId(null)
    setFormData({
      slug: '',
      title: '',
      description: '',
      category_type: 'document',
      is_active: true,
      sort_order: 999,
    })
    setShowDialog(true)
  }

  function openEditDialog(category: ServiceCategory) {
    setEditingId(category.id)
    setFormData({
      slug: category.slug,
      title: category.title,
      description: category.description || '',
      category_type: category.category_type,
      is_active: category.is_active,
      sort_order: category.sort_order,
    })
    setShowDialog(true)
  }

  async function handleSave() {
    try {
      setSaving(true)
      const validated = serviceCategorySchema.parse(formData)

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('service_categories')
          .update({
            ...validated,
            updated_at: new Date(),
          })
          .eq('id', editingId)

        if (error) {
          toast.error(`Failed to update: ${error.message}`)
          return
        }

        toast.success('Service category updated')
      } else {
        // Create new
        const { error } = await supabase
          .from('service_categories')
          .insert([validated])

        if (error) {
          toast.error(`Failed to create: ${error.message}`)
          return
        }

        toast.success('Service category created')
      }

      setShowDialog(false)
      await loadCategories()
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message || 'Validation failed')
      } else {
        toast.error('Failed to save service category')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({ is_active: !isActive, updated_at: new Date() })
        .eq('id', id)

      if (error) {
        toast.error(`Failed to update: ${error.message}`)
        return
      }

      setCategories(categories.map((c) => (c.id === id ? { ...c, is_active: !isActive } : c)))
      toast.success(isActive ? 'Category deactivated' : 'Category activated')
    } catch (err) {
      toast.error('Failed to update category')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const { error } = await supabase.from('service_categories').delete().eq('id', id)

      if (error) {
        toast.error(`Failed to delete: ${error.message}`)
        return
      }

      setCategories(categories.filter((c) => c.id !== id))
      toast.success('Category deleted')
    } catch (err) {
      toast.error('Failed to delete category')
    }
  }

  async function handleReorderUp(category: ServiceCategory) {
    const newSort = Math.max(0, category.sort_order - 1)
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({ sort_order: newSort, updated_at: new Date() })
        .eq('id', category.id)

      if (error) {
        toast.error(`Failed to reorder: ${error.message}`)
        return
      }

      await loadCategories()
    } catch (err) {
      toast.error('Failed to reorder')
    }
  }

  async function handleReorderDown(category: ServiceCategory) {
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({ sort_order: category.sort_order + 1, updated_at: new Date() })
        .eq('id', category.id)

      if (error) {
        toast.error(`Failed to reorder: ${error.message}`)
        return
      }

      await loadCategories()
    } catch (err) {
      toast.error('Failed to reorder')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-gray-500">Loading service categories...</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-4 text-sm text-amber-900">
            {loadError.includes('schema cache')
              ? 'Database tables are not ready yet. Run scripts/06_add_system_settings.sql in your Supabase SQL editor, then refresh.'
              : loadError}
          </div>
        </Card>
      </div>
    )
  }

  const documentCategories = categories.filter((c) => c.category_type === 'document')
  const appointmentCategories = categories.filter((c) => c.category_type === 'appointment')
  const incidentCategories = categories.filter((c) => c.category_type === 'incident')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Categories</h1>
          <p className="text-gray-500 mt-2">Manage document requests, appointment types, and incident categories</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {/* Document Requests */}
      <Card className="border-l-4 border-l-blue-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            Document Requests
          </h2>

          {documentCategories.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No document categories yet</p>
          ) : (
            <div className="space-y-2">
              {documentCategories.map((category, idx) => (
                <div key={category.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{category.title}</h3>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {category.description && <p className="text-sm text-gray-600 mt-1">{category.description}</p>}
                    <p className="text-xs text-gray-500 mt-1">Slug: {category.slug}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => handleToggleActive(category.id, category.is_active)}
                    />

                    <Button
                      onClick={() => handleReorderUp(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      className="gap-1"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>

                    <Button
                      onClick={() => handleReorderDown(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === documentCategories.length - 1}
                      className="gap-1"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => openEditDialog(category)} variant="ghost" size="sm" className="gap-1">
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => handleDelete(category.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Appointment Types */}
      <Card className="border-l-4 border-l-purple-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-purple-600" />
            Appointment Types
          </h2>

          {appointmentCategories.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No appointment types yet</p>
          ) : (
            <div className="space-y-2">
              {appointmentCategories.map((category, idx) => (
                <div key={category.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{category.title}</h3>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {category.description && <p className="text-sm text-gray-600 mt-1">{category.description}</p>}
                    <p className="text-xs text-gray-500 mt-1">Slug: {category.slug}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => handleToggleActive(category.id, category.is_active)}
                    />

                    <Button
                      onClick={() => handleReorderUp(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      className="gap-1"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>

                    <Button
                      onClick={() => handleReorderDown(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === appointmentCategories.length - 1}
                      className="gap-1"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => openEditDialog(category)} variant="ghost" size="sm" className="gap-1">
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => handleDelete(category.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Incident/Blotter Categories */}
      <Card className="border-l-4 border-l-orange-600">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-orange-600" />
            Incident &amp; Blotter Categories
          </h2>

          {incidentCategories.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No incident categories yet</p>
          ) : (
            <div className="space-y-2">
              {incidentCategories.map((category, idx) => (
                <div key={category.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{category.title}</h3>
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {category.description && <p className="text-sm text-gray-600 mt-1">{category.description}</p>}
                    <p className="text-xs text-gray-500 mt-1">Slug: {category.slug}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => handleToggleActive(category.id, category.is_active)}
                    />

                    <Button
                      onClick={() => handleReorderUp(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      className="gap-1"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>

                    <Button
                      onClick={() => handleReorderDown(category)}
                      variant="ghost"
                      size="sm"
                      disabled={idx === incidentCategories.length - 1}
                      className="gap-1"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => openEditDialog(category)} variant="ghost" size="sm" className="gap-1">
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button onClick={() => handleDelete(category.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Edit/Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingId ? 'Edit Service Category' : 'Create New Service Category'}
              </h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="slug">Slug (URL-friendly)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., barangay-clearance"
                    disabled={!!editingId}
                  />
                </div>

                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Barangay Clearance"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this service"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="category_type">Category Type</Label>
                  <select
                    id="category_type"
                    value={formData.category_type}
                    onChange={(e) => setFormData({ ...formData, category_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="document">Document Request</option>
                    <option value="appointment">Appointment Type</option>
                    <option value="incident">Incident/Blotter</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="mb-0">
                    Active
                  </Label>
                </div>

                <div>
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 999 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button onClick={() => setShowDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
