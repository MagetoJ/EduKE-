import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'

interface Staff {
  id: number
  name: string
  role: string
}

interface Department {
  id?: number
  name: string
  code: string
  hod_id?: number | null
  description: string
}

interface DepartmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (deptData: Department) => Promise<void>
  initialData?: Department | null
  teachersList: Staff[]
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  teachersList,
}) => {
  const [formData, setFormData] = useState<Department>({
    name: '',
    code: '',
    hod_id: null,
    description: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({ name: '', code: '', hod_id: null, description: '' })
    }
  }, [initialData, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save department:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Edit Department & HOD Assignment' : 'Create New Department'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">Department Name *</label>
            <Input
              required
              placeholder="e.g. Humanities & Social Sciences"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Department Code</label>
            <Input
              placeholder="e.g. HUM-SOC"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Head of Department (HOD)</label>
            <p className="text-xs text-muted-foreground mb-1">
              Assigning a staff member grants them HOD portal authority. Selecting "No HOD Assigned" revokes existing HOD permissions.
            </p>
            <select
              className="w-full border rounded-md p-2 bg-background text-sm"
              value={formData.hod_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  hod_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">-- No HOD Assigned (Revoke Authority) --</option>
              {teachersList.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Department duties, subject scope, and focus areas..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}