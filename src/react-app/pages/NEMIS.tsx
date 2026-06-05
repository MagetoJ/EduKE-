import { useEffect, useState, FormEvent, useCallback } from 'react'
import { Plus, Search, Download, AlertCircle, Loader2, CheckCircle, Clock } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAuth, useApi } from '../contexts/AuthContext'

type NEMISRegistration = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  upi: string;
  birth_certificate_no: string;
  registration_status: 'registered' | 'pending' | 'rejected';
  created_at: string;
}

interface Student {
  id: number | string;
  first_name: string;
  last_name: string;
  student_id_number?: string;
}

const initialForm = {
  student_id: '',
  upi: '',
  birth_certificate_no: ''
}

export default function NEMIS() {
  const { user } = useAuth()
  const api = useApi()

  const [activeTab, setActiveTab] = useState('registrations')
  const [registrations, setRegistrations] = useState<NEMISRegistration[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [searchTerm, setSearchTerm] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [registrationsRes, studentsRes] = await Promise.all([
        api('/api/kenya-features/nemis/registrations'),
        api('/api/students')
      ])

      if (registrationsRes.ok) {
        const data = await registrationsRes.json()
        setRegistrations(data.data || [])
      } else {
        setRegistrations([])
      }

      if (studentsRes.ok) {
        const data = await studentsRes.json()
        setStudents(data.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    try {
      if (!form.student_id || !form.upi) {
        throw new Error('Student and UPI are required')
      }

      const response = await api('/api/kenya-features/nemis/register-student', {
        method: 'POST',
        body: JSON.stringify({
          student_id: form.student_id,
          upi: form.upi,
          birth_certificate_no: form.birth_certificate_no
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to register')

      setRegistrations(prev => {
        const existing = prev.find(r => r.student_id === form.student_id)
        if (existing) {
          return prev.map(r => r.student_id === form.student_id ? data.data : r)
        }
        return [...prev, data.data]
      })

      setIsDialogOpen(false)
      setForm(initialForm)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await api('/api/kenya-features/nemis/export')
      if (!response.ok) throw new Error('Failed to export')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nemis-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  const filteredRegistrations = registrations.filter(reg =>
    reg.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.upi.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const unregisteredStudents = students.filter(student =>
    !registrations.some(reg => reg.student_id === student.id.toString())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <div className="flex items-center gap-2 text-green-700 bg-green-50 px-2 py-1 rounded text-sm"><CheckCircle className="w-4 h-4" /> Registered</div>
      case 'pending':
        return <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm"><Clock className="w-4 h-4" /> Pending</div>
      case 'rejected':
        return <div className="flex items-center gap-2 text-red-700 bg-red-50 px-2 py-1 rounded text-sm"><AlertCircle className="w-4 h-4" /> Rejected</div>
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">NEMIS Registration</h1>
          <p className="text-gray-600">National Education Management Information System</p>
        </div>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="registrations">Registrations ({registrations.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({unregisteredStudents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by name or UPI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Register Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register Student with NEMIS</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {formError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                          {formError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="student">Student *</Label>
                        <Select value={form.student_id} onValueChange={(value) => setForm(prev => ({ ...prev, student_id: value }))}>
                          <SelectTrigger id="student">
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                          <SelectContent>
                            {unregisteredStudents.map(student => (
                              <SelectItem key={student.id} value={student.id.toString()}>
                                {student.first_name} {student.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="upi">UPI (Unique Personal Identifier) *</Label>
                        <Input
                          id="upi"
                          value={form.upi}
                          onChange={(e) => setForm(prev => ({ ...prev, upi: e.target.value }))}
                          placeholder="e.g., 12345678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birth-cert">Birth Certificate Number</Label>
                        <Input
                          id="birth-cert"
                          value={form.birth_certificate_no}
                          onChange={(e) => setForm(prev => ({ ...prev, birth_certificate_no: e.target.value }))}
                          placeholder="Optional"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => {
                          setIsDialogOpen(false)
                          setForm(initialForm)
                        }}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Register
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting || registrations.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Student Name</th>
                  <th className="px-4 py-2 text-left font-semibold">UPI</th>
                  <th className="px-4 py-2 text-left font-semibold">Birth Certificate</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Date Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                      {registrations.length === 0 ? 'No students registered yet' : 'No matching registrations'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map(reg => (
                    <tr key={reg.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{reg.first_name} {reg.last_name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{reg.upi}</td>
                      <td className="px-4 py-3 text-gray-600">{reg.birth_certificate_no || '—'}</td>
                      <td className="px-4 py-3">{getStatusBadge(reg.registration_status)}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(reg.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {user?.role === 'admin' && (
            <div className="grid gap-4">
              {unregisteredStudents.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-gray-500">
                    All students are registered!
                  </CardContent>
                </Card>
              ) : (
                unregisteredStudents.map(student => (
                  <Card key={student.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{student.first_name} {student.last_name}</CardTitle>
                          <CardDescription>{student.student_id_number}</CardDescription>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setForm({ student_id: student.id.toString(), upi: '', birth_certificate_no: '' })}
                            >
                              Register
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Register {student.first_name} with NEMIS</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              {formError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                                  {formError}
                                </div>
                              )}
                              <div className="space-y-2">
                                <Label htmlFor="quick-upi">UPI (Unique Personal Identifier) *</Label>
                                <Input
                                  id="quick-upi"
                                  value={form.upi}
                                  onChange={(e) => setForm(prev => ({ ...prev, upi: e.target.value }))}
                                  placeholder="e.g., 12345678"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="quick-birth-cert">Birth Certificate Number</Label>
                                <Input
                                  id="quick-birth-cert"
                                  value={form.birth_certificate_no}
                                  onChange={(e) => setForm(prev => ({ ...prev, birth_certificate_no: e.target.value }))}
                                  placeholder="Optional"
                                />
                              </div>
                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setForm(initialForm)}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                  Register
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
