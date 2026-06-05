import { useEffect, useState, FormEvent } from 'react'
import { 
  Plus, 
  User, 
  Edit, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Search,
  Filter,
  MoreVertical,
  GraduationCap,
  Phone,
  Mail
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi } from '../contexts/AuthContext'
import { useNavigate } from 'react-router'
import { Badge } from '../components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu'

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  grade: string;
  status: 'active' | 'inactive' | 'graduated';
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
}

type StudentFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  admission_number: string;
  grade: string;
  enrollment_date: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  relationship: string;
}

const EMPTY_FORM: StudentFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'male',
  address: '',
  admission_number: '',
  grade: 'Grade 1',
  enrollment_date: '',
  parent_name: '',
  parent_phone: '',
  parent_email: '',
  relationship: 'guardian'
}

export default function Students() {
  const api = useApi()
  const navigate = useNavigate()

  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false)
  const [enrollForm, setEnrollForm] = useState<StudentFormData>(EMPTY_FORM)
  const [step, setStep] = useState(1)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<Student | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api('/api/students')
        if (!res.ok) throw new Error('Failed to fetch students')
        const data = await res.json()
        setStudents(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchStudents()
  }, [api])

  const handleEnrollDialogChange = (open: boolean) => {
    if (!open) {
      setEnrollForm(EMPTY_FORM)
      setStep(1)
      setFormError(null)
    }
    setIsEnrollDialogOpen(open)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await api('/api/students', {
        method: 'POST',
        body: JSON.stringify(enrollForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setStudents(prev => [data.data, ...prev])
      handleEnrollDialogChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if(!editForm) return
    setIsSubmitting(true)
    try {
      const response = await api(`/api/students/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setStudents(prev => prev.map(s => s.id === data.data.id ? data.data : s))
      setIsEditDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivateStudent = async (studentId: string) => {
    try {
      const response = await api(`/api/students/${studentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'inactive' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setStudents(prev => prev.map(s => s.id === data.data.id ? data.data : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deactivating student')
    }
  }

  const filteredStudents = students.filter(student =>
    student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'graduated': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Students</h1>
        <p className="text-slate-600">Manage student enrollment and records</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, admission number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent placeholder:text-slate-400 focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <Dialog open={isEnrollDialogOpen} onOpenChange={handleEnrollDialogChange}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Enroll Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Enroll New Student</DialogTitle>
                    <DialogDescription>
                      Complete the steps to add a new student to the school
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-4 space-y-4">
                    {step === 1 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input id="first_name" value={enrollForm.first_name} onChange={(e) => setEnrollForm({...enrollForm, first_name: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input id="last_name" value={enrollForm.last_name} onChange={(e) => setEnrollForm({...enrollForm, last_name: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={enrollForm.email} onChange={(e) => setEnrollForm({...enrollForm, email: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" value={enrollForm.phone} onChange={(e) => setEnrollForm({...enrollForm, phone: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="date_of_birth">Date of Birth</Label>
                            <Input id="date_of_birth" type="date" value={enrollForm.date_of_birth} onChange={(e) => setEnrollForm({...enrollForm, date_of_birth: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={enrollForm.gender} onValueChange={(value) => setEnrollForm({...enrollForm, gender: value})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Address</Label>
                          <Input id="address" value={enrollForm.address} onChange={(e) => setEnrollForm({...enrollForm, address: e.target.value})} />
                        </div>
                      </div>
                    )}
                    
                    {step === 2 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="admission_number">Admission Number</Label>
                            <Input id="admission_number" value={enrollForm.admission_number} onChange={(e) => setEnrollForm({...enrollForm, admission_number: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="enrollment_date">Enrollment Date</Label>
                            <Input id="enrollment_date" type="date" value={enrollForm.enrollment_date} onChange={(e) => setEnrollForm({...enrollForm, enrollment_date: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="grade">Grade</Label>
                          <Input id="grade" value={enrollForm.grade} onChange={(e) => setEnrollForm({...enrollForm, grade: e.target.value})} />
                        </div>
                      </div>
                    )}
                    
                    {step === 3 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="parent_name">Parent/Guardian Name</Label>
                            <Input id="parent_name" value={enrollForm.parent_name} onChange={(e) => setEnrollForm({...enrollForm, parent_name: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="relationship">Relationship</Label>
                            <Select value={enrollForm.relationship} onValueChange={(value) => setEnrollForm({...enrollForm, relationship: value})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="father">Father</SelectItem>
                                <SelectItem value="mother">Mother</SelectItem>
                                <SelectItem value="guardian">Guardian</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="parent_phone">Parent Phone</Label>
                            <Input id="parent_phone" value={enrollForm.parent_phone} onChange={(e) => setEnrollForm({...enrollForm, parent_phone: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parent_email">Parent Email</Label>
                            <Input id="parent_email" type="email" value={enrollForm.parent_email} onChange={(e) => setEnrollForm({...enrollForm, parent_email: e.target.value})} />
                          </div>
                        </div>
                        {formError && (
                          <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                            <AlertCircle className="w-4 h-4" /> {formError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <DialogFooter className="flex justify-between">
                    {step > 1 ? (
                      <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    ) : <div />}
                    
                    {step < 3 ? (
                      <Button type="button" onClick={() => setStep(step + 1)}>
                        Next
                      </Button>
                    ) : (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enroll Student'}
                      </Button>
                    )}
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading students...
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-lg border border-slate-200">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600">No students found</p>
            </div>
          ) : (
            filteredStudents.map((student) => (
              <Card key={student.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{student.first_name} {student.last_name}</h3>
                        <p className="text-sm text-slate-500">ID: {student.admission_number}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-wrap justify-end">
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{student.grade}</p>
                        <p className="text-xs text-slate-500">Grade</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-900 flex items-center gap-1 justify-end">
                          <Mail className="w-3 h-3" />
                          {student.email}
                        </p>
                        <p className="text-sm text-slate-900 flex items-center gap-1 justify-end">
                          <Phone className="w-3 h-3" />
                          {student.phone}
                        </p>
                      </div>
                      <Badge className={getStatusColor(student.status)}>
                        {student.status}
                      </Badge>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/students/${student.id}`)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditForm(student);
                            setIsEditDialogOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {student.status !== 'inactive' && (
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeactivateStudent(student.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>Update student details</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">First Name</Label>
                    <Input id="edit_first_name" value={editForm?.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value} as Student)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">Last Name</Label>
                    <Input id="edit_last_name" value={editForm?.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value} as Student)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input id="edit_email" type="email" value={editForm?.email} onChange={(e) => setEditForm({...editForm, email: e.target.value} as Student)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_phone">Phone</Label>
                    <Input id="edit_phone" value={editForm?.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value} as Student)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_admission_number">Admission Number</Label>
                    <Input id="edit_admission_number" value={editForm?.admission_number} onChange={(e) => setEditForm({...editForm, admission_number: e.target.value} as Student)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_grade">Grade</Label>
                    <Input id="edit_grade" value={editForm?.grade} onChange={(e) => setEditForm({...editForm, grade: e.target.value} as Student)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select value={editForm?.status} onValueChange={(value) => setEditForm({...editForm, status: value} as Student)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                    <AlertCircle className="w-4 h-4" /> {formError}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
