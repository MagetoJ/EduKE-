import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { DepartmentModal } from '../components/DepartmentModal'
import { Trash2, Edit, ShieldCheck, ShieldAlert, Building2 } from 'lucide-react'
import { useApi } from '../contexts/AuthContext'

export const Departments = () => {
  const api = useApi()
  const [departments, setDepartments] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const deptRes = await api('/api/admin/departments')
      if (!deptRes.ok) {
        throw new Error('Failed to load departments')
      }
      const deptData = await deptRes.json()
      setDepartments(Array.isArray(deptData) ? deptData : [])

      const staffRes = await api('/api/staff')
      const staffJson = await staffRes.json()
      setTeachers(Array.isArray(staffJson?.data) ? staffJson.data : [])
    } catch (err) {
      console.error('Error loading department data:', err)
      setError('Could not load departments. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async (deptData: any) => {
    const isEdit = Boolean(deptData.id)
    const url = isEdit
      ? `/api/admin/departments/${deptData.id}`
      : `/api/admin/departments`
    const method = isEdit ? 'PUT' : 'POST'

    const response = await api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deptData),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.detail || 'Failed to save department')
    }

    await fetchData()
  }

  const handleDelete = async (deptId: number) => {
    if (confirm('Are you sure you want to delete this department? The assigned HOD will be demoted to a regular teacher.')) {
      const response = await api(`/api/admin/departments/${deptId}`, { method: 'DELETE' })
      if (!response.ok) {
        console.error('Failed to delete department')
        return
      }
      await fetchData()
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Departments & HOD Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Appoint or revoke Head of Department (HOD) administrative authority and manage subject departments.
          </p>
        </div>
        <Button onClick={() => { setSelectedDept(null); setIsModalOpen(true); }}>
          + Add Department
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : departments.length === 0 && !error ? (
        <div className="text-center py-16 text-muted-foreground">
          No departments yet. Click "Add Department" to create your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <Card key={dept.id} className="relative shadow-sm border hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">{dept.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => { setSelectedDept(dept); setIsModalOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(dept.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3 font-mono">{dept.code || 'NO CODE'}</p>
                <p className="text-sm mb-4 min-h-[40px] text-slate-600">{dept.description || 'No description provided.'}</p>

                <div className="flex items-center space-x-2 border-t pt-3 text-sm">
                  {dept.hod_name ? (
                    <>
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>HOD: <strong className="text-emerald-900">{dept.hod_name}</strong></span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span className="text-muted-foreground italic">No HOD Assigned</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={selectedDept}
        teachersList={teachers}
      />
    </div>
  )
}

export default Departments
