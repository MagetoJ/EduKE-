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

// Standard Kenyan CBC academic departments and their codes (kept in sync with
// server/seed_departments.py). Selecting one of these auto-fills the code;
// picking "Custom" reveals a free-text code field for genuinely new departments.
const STANDARD_DEPARTMENTS: { name: string; code: string }[] = [
  { name: 'Mathematics Department', code: 'MATH' },
  { name: 'Languages Department', code: 'LANG' },
  { name: 'Sciences Department', code: 'SCI' },
  { name: 'Humanities Department', code: 'HUM' },
  { name: 'Technical & Applied Sciences', code: 'TECH' },
]

const CUSTOM_OPTION = '__custom__'

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
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Standard departments already created in this school shouldn't be offered
  // again in the dropdown (that would trigger the duplicate-name check),
  // except the one currently being edited.
  const availableStandardDepartments = STANDARD_DEPARTMENTS.filter(
    (std) =>
      !departmentsList.some(
        (dept) => dept.code === std.code && dept.id !== initialData?.id
      )
  )

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      const matched = STANDARD_DEPARTMENTS.find(
        (std) => std.code === initialData.code && std.name === initialData.name
      )
      setSelectedOption(matched ? matched.code : CUSTOM_OPTION)
    } else {
      setFormData({ name: '', code: '', hod_id: null, description: '' })
      setSelectedOption('')
    }
    setError(null)
  }, [initialData, isOpen])

  const handleDeptOptionChange = (value: string) => {
    setSelectedOption(value)
    if (value === CUSTOM_OPTION) {
      // New/custom department: clear name & code so the admin supplies their own.
      setFormData((prev) => ({ ...prev, name: '', code: '' }))
    } else if (value === '') {
      setFormData((prev) => ({ ...prev, name: '', code: '' }))
    } else {
      const std = STANDARD_DEPARTMENTS.find((s) => s.code === value)
      if (std) {
        setFormData((prev) => ({ ...prev, name: std.name, code: std.code }))
      }
    }
  }

  const isCustom = selectedOption === CUSTOM_OPTION

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
            <label className="text-sm font-medium">Department *</label>
            <p className="text-xs text-muted-foreground mb-1">
              Choose a standard CBC department (its code is filled in automatically), or add a
              custom department with its own code.
            </p>
            <select
              required
              className="w-full border rounded-md p-2 bg-background text-sm"
              value={selectedOption}
              onChange={(e) => handleDeptOptionChange(e.target.value)}
            >
              <option value="" disabled>
                -- Select a Department --
              </option>
              {availableStandardDepartments.map((std) => (
                <option key={std.code} value={std.code}>
                  {std.name} ({std.code})
                </option>
              ))}
              <option value={CUSTOM_OPTION}>+ Add New / Custom Department</option>
            </select>
          </div>

          {isCustom && (
            <div>
              <label className="text-sm font-medium">Department Name *</label>
              <Input
                required
                placeholder="e.g. Humanities & Social Sciences"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Department Code</label>
            {isCustom ? (
              <>
                <Input
                  placeholder="e.g. HUM-SOC"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to auto-generate a code from the department name.
                </p>
              </>
            ) : (
              <Input value={formData.code} readOnly disabled placeholder="Auto-generated" />
            )}
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