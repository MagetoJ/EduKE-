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
  departmentsList?: Department[]
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  teachersList,
  departmentsList = [],
}) => {
  const [formData, setFormData] = useState<Department>({
    name: '',
    code: '',
    hod_id: null,
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({ name: '', code: '', hod_id: null, description: '' })
    }
    setError(null)
  }, [initialData, isOpen])

  // Map hod_id -> the name of the (other) department they currently head,
  // so we can warn/disable in the dropdown before the admin even submits.
  const hodAssignments = new Map<number, string>()
  departmentsList.forEach((dept) => {
    if (dept.hod_id && dept.id !== initialData?.id) {
      hodAssignments.set(dept.hod_id, dept.name)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err: any) {
      console.error('Failed to save department:', err)
      setError(err?.message || 'Failed to save department. Please try again.')
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
              {teachersList.map((teacher) => {
                const otherDept = hodAssignments.get(teacher.id)
                return (
                  <option key={teacher.id} value={teacher.id} disabled={Boolean(otherDept)}>
                    {teacher.name} ({teacher.role})
                    {otherDept ? ` — already HOD of ${otherDept}` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

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