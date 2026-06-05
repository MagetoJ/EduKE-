import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Mail, Phone, Building2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi } from '../contexts/AuthContext'

type School = {
  id: string
  name: string
}

type SchoolAdmin = {
  id: string
  email: string
  name: string
  phone: string
  role: string
  status: string
  school_id: string
  schoolName?: string
}

type AdminFormState = {
  schoolId: string
  name: string
  email: string
  phone: string
  password: string
}

const createDefaultAdminForm = (): AdminFormState => ({
  schoolId: '',
  name: '',
  email: '',
  phone: '',
  password: ''
})

export default function SchoolAdmins() {
  const apiFetch = useApi()
  const [schools, setSchools] = useState<School[]>([])
  const [admins, setAdmins] = useState<SchoolAdmin[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<AdminFormState>(createDefaultAdminForm())
  const [editData, setEditData] = useState<{ id: string; name: string; phone: string }>({ id: '', name: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const loadSchools = useCallback(async () => {
    try {
      const response = await apiFetch('/api/schools')
      if (!response.ok) {
        throw new Error('Failed to load schools')
      }
      const data = await response.json()
      setSchools(
        Array.isArray(data)
          ? data.map((s: { id: unknown; name: string }) => ({ id: String(s.id), name: s.name }))
          : []
      )
    } catch (err) {
      console.error('Error loading schools:', err)
    }
  }, [apiFetch])

  const loadAdmins = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch('/api/school-admins')
      if (!response.ok) {
        throw new Error('Failed to load school administrators')
      }
      const data = await response.json()
      setAdmins(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading administrators'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadSchools()
    loadAdmins()
  }, [loadSchools, loadAdmins])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSchoolChange = (value: string) => {
    setFormData((prev) => ({ ...prev, schoolId: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (!formData.schoolId) {
        throw new Error('School is required')
      }

      const response = await apiFetch(`/api/schools/${formData.schoolId}/admin`, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'admin'
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create administrator')
      }

      await loadAdmins()
      setFormData(createDefaultAdminForm())
      setIsAddDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error creating administrator'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = (admin: SchoolAdmin) => {
    setEditData({ id: admin.id, name: admin.name, phone: admin.phone })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiFetch(`/api/school-admins/${editData.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editData.name,
          phone: editData.phone
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update administrator')
      }

      await loadAdmins()
      setEditData({ id: '', name: '', phone: '' })
      setIsEditDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating administrator'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (admin: SchoolAdmin) => {
    const newStatus = admin.status === 'active' ? 'inactive' : 'active'
    const message = newStatus === 'inactive' 
      ? 'Are you sure you want to deactivate this administrator?' 
      : 'Are you sure you want to activate this administrator?'

    if (!window.confirm(message)) {
      return
    }

    try {
      const response = await apiFetch(`/api/school-admins/${admin.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${newStatus === 'active' ? 'activate' : 'deactivate'} administrator`)
      }

      await loadAdmins()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error updating administrator status'
      setError(message)
    }
  }

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.schoolName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Administrators</h1>
          <p className="text-gray-600">Manage primary administrators for all schools</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Administrator
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create School Administrator</DialogTitle>
                <DialogDescription>Add a new administrator for a school</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schoolId">School *</Label>
                  <Select value={formData.schoolId} onValueChange={handleSchoolChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.filter(s => s.id && s.id.trim()).map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@school.edu"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1-555-0000"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && <p className="text-sm font-medium text-red-500">{error}</p>}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Administrator'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Administrator</DialogTitle>
              <DialogDescription>Update administrator information</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter full name"
                  value={editData.name}
                  onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  placeholder="+1-555-0000"
                  value={editData.phone}
                  onChange={(e) => setEditData((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            placeholder="Search by name, email, or school..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-500">{error}</p>}

      {isLoading && admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading administrators...</p>
      ) : (
        <div className="grid gap-4">
          {filteredAdmins.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No administrators found</CardTitle>
              </CardHeader>
            </Card>
          ) : (
            filteredAdmins.map((admin) => (
              <Card key={admin.id} className="transition-shadow hover:shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600">
                        <Building2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{admin.name}</CardTitle>
                        <p className="text-sm text-gray-600">{admin.schoolName || 'Unknown School'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                        {admin.status || 'Active'}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="mb-4 grid gap-2 md:grid-cols-2">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">{admin.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{admin.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(admin)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant={admin.status === 'active' ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggleStatus(admin)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {admin.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
