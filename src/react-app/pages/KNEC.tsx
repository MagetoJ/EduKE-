import { useEffect, useState, FormEvent, useCallback } from 'react'
import { Plus, Search, AlertCircle, Loader2, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAuth, useApi } from '../contexts/AuthContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'

type KNECRegistration = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  exam_type: 'KCSE' | 'KCPE' | 'KPSEA';
  subjects: string[];
  registration_number?: string;
  status: 'pending' | 'registered' | 'submitted';
  created_at: string;
}

type KNECStudent = {
  id: string | number;
  first_name: string;
  last_name: string;
  student_id_number: string;
}

const EXAM_SUBJECTS = {
  KCSE: [
    'English', 'Kiswahili', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Geography', 'History', 'CRE', 'IRE', 'Computer Science', 'Business Studies',
    'Agriculture', 'Art & Design', 'Music', 'Home Science', 'Building Technology'
  ],
  KCPE: [
    'English', 'Kiswahili', 'Mathematics', 'Science', 'Social Studies', 'Religion'
  ],
  KPSEA: [
    'English', 'Mathematics', 'Science', 'Social Studies'
  ]
}

const initialForm = {
  student_id: '',
  exam_type: 'KCSE' as 'KCSE' | 'KCPE' | 'KPSEA',
  subjects: [] as string[]
}

export default function KNEC() {
  const { user } = useAuth()
  const api = useApi()

  const [activeTab, setActiveTab] = useState('registrations')
  const [registrations, setRegistrations] = useState<KNECRegistration[]>([])
  const [students, setStudents] = useState<KNECStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [regsRes, studentsRes] = await Promise.all([
        api('/api/kenya-features/knec/registrations'),
        api('/api/students')
      ])

      if (regsRes.ok) {
        const data = await regsRes.json()
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
      if (!form.student_id || !form.exam_type || form.subjects.length === 0) {
        throw new Error('All fields are required')
      }

      const response = await api('/api/kenya-features/knec/register-candidate', {
        method: 'POST',
        body: JSON.stringify({
          student_id: form.student_id,
          exam_type: form.exam_type,
          subjects: form.subjects
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to register')

      setRegistrations(prev => [...prev, data.data])
      setIsDialogOpen(false)
      setForm(initialForm)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRegistration = async (id: string) => {
    try {
      const response = await api(`/api/kenya-features/knec/registrations/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete registration')
      setRegistrations(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filteredRegistrations = registrations.filter(reg =>
    reg.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.exam_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const unregisteredStudents = students.filter(student =>
    !registrations.some(reg => reg.student_id === student.id.toString())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <div className="flex items-center gap-2 text-green-700 bg-green-50 px-2 py-1 rounded text-sm"><CheckCircle className="w-4 h-4" /> Registered</div>
      case 'submitted':
        return <div className="flex items-center gap-2 text-green-700 bg-green-50 px-2 py-1 rounded text-sm"><CheckCircle className="w-4 h-4" /> Submitted</div>
      case 'pending':
        return <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm"><Clock className="w-4 h-4" /> Pending</div>
      default:
        return status
    }
  }

  const currentExamSubjects = EXAM_SUBJECTS[form.exam_type]

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
          <h1 className="text-3xl font-bold">KNEC Registration</h1>
          <p className="text-gray-600">Kenya National Examinations Council Candidate Registration</p>
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
                placeholder="Search by name or exam type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {user?.role === 'admin' && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Register Candidate
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Register KNEC Candidate</DialogTitle>
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
                      <Label htmlFor="exam-type">Exam Type *</Label>
                      <Select value={form.exam_type} onValueChange={(value) => setForm(prev => ({ ...prev, exam_type: value as 'KCSE' | 'KCPE' | 'KPSEA', subjects: [] }))}>
                        <SelectTrigger id="exam-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KCSE">KCSE (Secondary)</SelectItem>
                          <SelectItem value="KCPE">KCPE (Primary)</SelectItem>
                          <SelectItem value="KPSEA">KPSEA (Post-Primary)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subjects *</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border rounded">
                        {currentExamSubjects.map(subject => (
                          <label key={subject} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.subjects.includes(subject)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm(prev => ({ ...prev, subjects: [...prev.subjects, subject] }))
                                } else {
                                  setForm(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== subject) }))
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{subject}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600">
                        Selected: {form.subjects.length}
                      </p>
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
          </div>

          <div className="grid gap-4">
            {filteredRegistrations.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  {registrations.length === 0 ? 'No candidates registered yet' : 'No matching registrations'}
                </CardContent>
              </Card>
            ) : (
              filteredRegistrations.map(reg => (
                <Card key={reg.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{reg.first_name} {reg.last_name}</CardTitle>
                        <CardDescription>{reg.exam_type} Exam</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(reg.status)}
                        {user?.role === 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Registration</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this KNEC registration?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRegistration(reg.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Subjects</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {reg.subjects.map(subject => (
                            <span key={subject} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                      {reg.registration_number && (
                        <div>
                          <p className="text-sm text-gray-600">Registration Number: <span className="font-mono">{reg.registration_number}</span></p>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        Registered: {new Date(reg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
                              onClick={() => setForm({ ...initialForm, student_id: student.id.toString() })}
                            >
                              Register
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Register {student.first_name} for KNEC</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                              {formError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                                  {formError}
                                </div>
                              )}
                              <div className="space-y-2">
                                <Label htmlFor="quick-exam-type">Exam Type *</Label>
                                <Select value={form.exam_type} onValueChange={(value) => setForm(prev => ({ ...prev, exam_type: value as 'KCSE' | 'KCPE' | 'KPSEA', subjects: [] }))}>
                                  <SelectTrigger id="quick-exam-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="KCSE">KCSE (Secondary)</SelectItem>
                                    <SelectItem value="KCPE">KCPE (Primary)</SelectItem>
                                    <SelectItem value="KPSEA">KPSEA (Post-Primary)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Subjects *</Label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
                                  {currentExamSubjects.map(subject => (
                                    <label key={subject} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={form.subjects.includes(subject)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setForm(prev => ({ ...prev, subjects: [...prev.subjects, subject] }))
                                          } else {
                                            setForm(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== subject) }))
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{subject}</span>
                                    </label>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-600">
                                  Selected: {form.subjects.length}
                                </p>
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
