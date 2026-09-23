'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload, Search, Users, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface PreRegisteredResident {
  id: string
  first_name: string
  last_name: string
  middle_name: string | null
  date_of_birth: string | null
  email: string
  phone: string | null
  street_address: string | null
  barangay: string
  city_municipality: string | null
  province: string | null
  postal_code: string | null
  national_id: string | null
  id_type: string | null
  source: string
  import_batch_id: string | null
  is_verified: boolean
  verified_at: string | null
  created_at: string
  updated_at: string
}

export default function PreRegisteredResidentsPage() {
  const [residents, setResidents] = useState<PreRegisteredResident[]>([])
  const [filteredResidents, setFilteredResidents] = useState<PreRegisteredResident[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    fetchResidents()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredResidents(residents)
      return
    }

    const q = searchQuery.toLowerCase()
    const filtered = residents.filter(
      (r) =>
        r.first_name?.toLowerCase().includes(q) ||
        r.last_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone?.includes(q) ||
        r.national_id?.includes(q) ||
        r.barangay?.toLowerCase().includes(q)
    )
    setFilteredResidents(filtered)
  }, [searchQuery, residents])

  async function fetchResidents() {
    try {
      const res = await fetch('/api/admin/pre-registered-residents')
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch residents`)
      }
      const data = await res.json()
      setResidents(data.residents || [])
      setFilteredResidents(data.residents || [])
    } catch (err) {
      console.error('Error fetching residents:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load pre-registered residents')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!importFile) {
      toast.error('Please select a CSV file')
      return
    }

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const res = await fetch('/api/admin/pre-registered-residents', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || `HTTP ${res.status}: Import failed`)
      }

      const data = await res.json()
      toast.success(`${data.imported} residents imported successfully`)
      setShowImportDialog(false)
      setImportFile(null)
      fetchResidents()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  const expectedCsvHeaders = [
    'first_name', 'last_name', 'middle_name', 'date_of_birth', 'email',
    'phone', 'street_address', 'barangay', 'city_municipality',
    'province', 'postal_code', 'national_id', 'id_type'
  ]

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pre-Registered Residents</h1>
          <p className="text-muted-foreground mt-1">
            Manage pre-saved resident data for identity verification
          </p>
        </div>
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Pre-Registered Residents</DialogTitle>
              <DialogDescription className="break-words max-w-full overflow-wrap-anywhere">
                Upload a CSV file with resident data. Expected columns: {expectedCsvHeaders.join(', ')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <div className="text-xs text-muted-foreground">
                <p>CSV format example:</p>
                <code className="block mt-1 p-2 bg-gray-100 dark:bg-muted rounded break-all max-w-full whitespace-pre-wrap overflow-wrap-anywhere">
                  first_name,last_name,middle_name,date_of_birth,email,phone,street_address,barangay,city_municipality,province,postal_code,national_id,id_type<br />
                  Juan,Dela Cruz,Santos,1985-03-15,juan@example.com,09171234567,"Block 10 Lot 5","San Antonio","Quezon City","Metro Manila",1112,123456789012,philsys
                </code>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Pre-Registered Residents</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search residents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <CardDescription>
            {filteredResidents.length} of {residents.length} pre-registered resident(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : filteredResidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pre-registered residents found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Barangay</TableHead>
                    <TableHead>National ID</TableHead>
                    <TableHead>ID Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResidents.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {resident.first_name} {resident.middle_name || ''} {resident.last_name}
                          </p>
                          {resident.date_of_birth && (
                            <p className="text-xs text-muted-foreground">
                              DOB: {new Date(resident.date_of_birth).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="break-all">{resident.email}</TableCell>
                      <TableCell>{resident.phone || '-'}</TableCell>
                      <TableCell>{resident.barangay}</TableCell>
                      <TableCell>{resident.national_id || '-'}</TableCell>
                      <TableCell>
                        {resident.id_type ? (
                          <Badge variant="outline">{resident.id_type}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {resident.is_verified ? (
                          <Badge className="bg-green-100 text-green-800">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(resident.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
