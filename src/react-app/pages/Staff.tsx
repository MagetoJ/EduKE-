import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Plus, Search, Filter, UserCheck, Mail, Phone, Calendar, CheckCircle, XCircle, DollarSign, Pencil, Trash2, Building } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useApi } from '../contexts/AuthContext'
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
} from "../components/ui/alert-dialog"

type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
  avatar_url?: string;
  employee_id?: string;
  hire_date: string;
  subject?: string;
  class_assigned?: string;
};

type LeaveRequest = {
  id: string;
  staffName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
};

const initialStaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  department: '',
  joinDate: '',
  password: '',
  classAssigned: '',
  subject: '',
  school_id: 1
}

export default function Staff() {
  const api = useApi()
  const [activeTab, setActiveTab] = useState('directory')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState(initialStaffForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isEditStaffDialogOpen, setIsEditStaffDialogOpen] = useState(false)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editStaffForm, setEditStaffForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    classAssigned: '',
    subject: '',
    joinDate: '',
    status: ''
  })

  const extractStaffArray = (data: any): any[] => {
    if (!data) return [];
    if (data.success && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true)
        const response = await api('/api/staff')
        const data = await response.json()

        if (response.ok) {
          const staffArray = extractStaffArray(data);
          const mappedStaff: StaffMember[] = staffArray.map((member: Record<string, unknown>) => {
            const rawRole = member.role as string || '';
            const rawStatus = member.status as string || 'Active';
            
            const formattedRole = rawRole
              ? rawRole.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
              : 'Staff';

            return {
              id: String(member.id),
              name: String(member.name || `${member.first_name || ''} ${member.last_name || ''}`).trim(),
              email: String(member.email || ''),
              phone: String(member.phone || ''),
              role: formattedRole,
              department: String(member.department || 'General'),
              hire_date: String(member.hire_date || new Date().toISOString()),
              status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase(),
              avatar_url: String(member.avatar_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'),
              class_assigned: member.class_assigned ? String(member.class_assigned) : undefined,
              subject: member.subject ? String(member.subject) : undefined
            }
          })
          setStaff(mappedStaff)
        } else {
          throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (err) {
        console.error('Error fetching staff:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [api])

  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        const response = await api('/api/leave-requests')
        const data = await response.json()

        if (response.ok && data.success) {
          const mappedRequests = data.data.map((request: Record<string, unknown>) => {
            const id = request.id as unknown as number
            const requestStatus = request.status as unknown as string
            return {
              id: id.toString(),
              staffName: request.staff_name || `${request.first_name || ''} ${request.last_name || ''}`.trim(),
              type: request.leave_type_name || 'Leave',
              startDate: request.start_date,
              endDate: request.end_date,
              reason: request.reason || '',
              status: requestStatus ? requestStatus.charAt(0).toUpperCase() + requestStatus.slice(1) : 'Pending'
            }
          })
          setLeaveRequests(mappedRequests)
        } else {
          throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (err) {
        console.error('Error fetching leave requests:', err)
      }
    }
    
    fetchLeaveRequests()
  }, [api])

  useEffect(() => {
    if (!isStaffDialogOpen) {
      setFormData(initialStaffForm)
      setError('')
      setIsSubmitting(false)
    }
  }, [isStaffDialogOpen])

  const handleLeaveAction = (requestId: string, action: 'approve' | 'deny') => {
    setLeaveRequests(prev => 
      prev.map(request => 
        request.id === requestId 
          ? { ...request, status: action === 'approve' ? 'Approved' : 'Denied' }
          : request
      )
    )
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEditStaffInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setEditStaffForm(prev => ({ ...prev, [id]: value }))
  }

  const handleEditStaffSelectChange = (field: string, value: string) => {
    setEditStaffForm(prev => ({ ...prev, [field]: value }))
  }

  const handleAddStaff = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.role) {
      setError('Please complete all required fields.')
      setIsSubmitting(false)
      return
    }

    if (formData.role === 'class_teacher' && !formData.classAssigned) {
      setError('Please assign a class for the Class Teacher role.')
      setIsSubmitting(false)
      return
    }

    try {
      if (['teacher', 'class_teacher', 'registrar', 'exam_officer', 'hod', 'timetable_manager', 'transport_manager', 'boarding_master', 'cbc_coordinator', 'hr_manager', 'admission_officer', 'nurse'].includes(formData.role)) {
        const response = await api('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            email: formData.email,
            password: formData.password || 'Temporary123!',
            role: formData.role,
            phone: formData.phone,
            school_id: formData.school_id,
            class_assigned: formData.role === 'class_teacher' ? formData.classAssigned : null,
            subject: formData.subject,
            department: formData.department
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to create user account.')
        }
      }

      const response = await api('/api/staff')
      const staffData = await response.json()
      
      if (response.ok) {
        const staffArray = extractStaffArray(staffData);
        const mappedStaff: StaffMember[] = staffArray.map((member: Record<string, unknown>) => {
          const rawRole = member.role as string || '';
          const rawStatus = member.status as string || 'Active';
          const formattedRole = rawRole
            ? rawRole.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
            : 'Staff';

          return {
            id: String(member.id),
            name: String(member.name || `${member.first_name || ''} ${member.last_name || ''}`).trim(),
            email: String(member.email || ''),
            phone: String(member.phone || ''),
            role: formattedRole,
            department: String(member.department || 'General'),
            hire_date: String(member.hire_date || new Date().toISOString()),
            status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase(),
            avatar_url: String(member.avatar_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'),
            class_assigned: member.class_assigned ? String(member.class_assigned) : undefined,
            subject: member.subject ? String(member.subject) : undefined
          }
        })
        setStaff(mappedStaff)
      }

      setIsStaffDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openStaffEdit = (member: StaffMember) => {
    // Reverse display format back to backend functional formats if needed
    const backendRoleFormat = member.role.toLowerCase().replace(' ', '_');
    setEditStaffForm({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: backendRoleFormat,
      department: member.department,
      classAssigned: member.class_assigned ?? '',
      subject: member.subject ?? '',
      joinDate: member.hire_date ? member.hire_date.split('T')[0] : '',
      status: member.status
    })
    setEditingStaffId(member.id)
    setIsEditStaffDialogOpen(true)
  }

 const handleEditStaffSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (!editingStaffId) {
    return
  }

  try {
    setError('')
    const response = await api(`/api/staff/${editingStaffId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editStaffForm.name,
        email: editStaffForm.email,
        phone: editStaffForm.phone,
        department: editStaffForm.department,
        role: editStaffForm.role.toLowerCase(),
        class_assigned: editStaffForm.role.toLowerCase() === 'class_teacher' ? editStaffForm.classAssigned : null,
        subject: ['teacher', 'class_teacher', 'hod', 'cbc_coordinator'].includes(editStaffForm.role.toLowerCase()) ? editStaffForm.subject : null,
        is_active: editStaffForm.status.toLowerCase() === 'active'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.detail || data?.error || 'Failed to update staff member')
    }

    const updatedStaff = await api('/api/staff')
    const updatedData = await updatedStaff.json()
    
    if (updatedStaff.ok) {
      const staffArray = extractStaffArray(updatedData);
      const mappedStaff: StaffMember[] = staffArray.map((member: Record<string, unknown>) => {
        const rawRole = member.role as string || '';
        const rawStatus = member.status as string || 'Active';
        const formattedRole = rawRole
          ? rawRole.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          : 'Staff';

        return {
          id: String(member.id),
          name: String(member.name || `${member.first_name || ''} ${member.last_name || ''}`).trim(),
          email: String(member.email || ''),
          phone: String(member.phone || ''),
          role: formattedRole,
          department: String(member.department || 'General'),
          hire_date: String(member.hire_date || new Date().toISOString()),
          status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase(),
          avatar_url: String(member.avatar_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'),
          class_assigned: member.class_assigned ? String(member.class_assigned) : undefined,
          subject: member.subject ? String(member.subject) : undefined
        }
      })
      setStaff(mappedStaff)
    }

    setIsEditStaffDialogOpen(false)
    setEditingStaffId(null)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
  }
}

  const handleDeactivateStaff = async (staffId: string) => {
    try {
      const response = await api(`/api/staff/${staffId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to deactivate staff member');
      }

      setStaff(prev =>
        prev.map(member =>
          member.id === staffId ? { ...member, status: 'Inactive' } : member
        )
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-xs text-gray-500 animate-pulse">Loading school staff index...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage staff members, leave requests, and payroll</p>
        </div>
        
        <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleAddStaff} className="space-y-6">
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
                <DialogDescription>
                  Add a new staff member to the school roster.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="Enter first name" value={formData.firstName} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Enter last name" value={formData.lastName} onChange={handleInputChange} required />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="staff@school.edu" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="+254-700-000000" value={formData.phone} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => handleSelectChange('role', value)}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="class_teacher">Class Teacher</SelectItem>
                        <SelectItem value="registrar">Registrar</SelectItem>
                        <SelectItem value="exam_officer">Exam Officer</SelectItem>
                        <SelectItem value="hod">HOD</SelectItem>
                        <SelectItem value="timetable_manager">Timetable Manager</SelectItem>
                        <SelectItem value="transport_manager">Transport Manager</SelectItem>
                        <SelectItem value="boarding_master">Boarding Master</SelectItem>
                        <SelectItem value="cbc_coordinator">CBC Coordinator</SelectItem>
                        <SelectItem value="hr_manager">HR Manager</SelectItem>
                        <SelectItem value="admission_officer">Admission Officer</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="administrator">Administrator</SelectItem>
                        <SelectItem value="counselor">Counselor</SelectItem>
                        <SelectItem value="librarian">Librarian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={formData.department} onValueChange={(value) => handleSelectChange('department', value)}>
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Languages">Languages</SelectItem>
                        <SelectItem value="Sciences">Sciences</SelectItem>
                        <SelectItem value="Humanities">Humanities</SelectItem>
                        <SelectItem value="Technical & Applied Sciences">Technical & Applied Sciences</SelectItem>
                        <SelectItem value="Administration">Administration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Localized Kenyan HOD Wing Hook */}
                {formData.role === 'hod' && (
                  <div className="bg-blue-50/50 p-3 border border-blue-100 rounded-lg flex items-start space-x-3 text-xs">
                    <Building className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <Label className="font-bold text-gray-700">Link HOD Scope Parameters</Label>
                      <p className="text-[10px] text-gray-400">Binding an HOD maps subject visibility permissions to their dashboard matching your selection above.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Enter password" value={formData.password} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinDate">Join Date</Label>
                    <Input id="joinDate" type="date" value={formData.joinDate} onChange={handleInputChange} />
                  </div>
                </div>

                {/* Segregated Academic Fields - Assigned Class now limited cleanly to Class Teacher role */}
                {['teacher', 'class_teacher', 'hod', 'cbc_coordinator'].includes(formData.role) && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                    {formData.role === 'class_teacher' ? (
                      <div className="space-y-2">
                        <Label htmlFor="classAssigned">Assigned Class Stream</Label>
                        <Select value={formData.classAssigned} onValueChange={(value) => handleSelectChange('classAssigned', value)}>
                          <SelectTrigger id="classAssigned">
                            <SelectValue placeholder="Select class stream" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Grade 7 - East">Grade 7 - East</SelectItem>
                            <SelectItem value="Grade 7 - West">Grade 7 - West</SelectItem>
                            <SelectItem value="Grade 8 - East">Grade 8 - East</SelectItem>
                            <SelectItem value="Grade 8 - West">Grade 8 - West</SelectItem>
                            <SelectItem value="Form 3 - Alpha">Form 3 - Alpha</SelectItem>
                            <SelectItem value="Form 4 - Beta">Form 4 - Beta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : <div />}
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject">Primary Specialization Subject</Label>
                      <Select value={formData.subject} onValueChange={(value) => handleSelectChange('subject', value)}>
                        <SelectTrigger id="subject">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Kiswahili">Kiswahili</SelectItem>
                          <SelectItem value="Chemistry">Chemistry</SelectItem>
                          <SelectItem value="Physics">Physics</SelectItem>
                          <SelectItem value="Biology">Biology</SelectItem>
                          <SelectItem value="Geography">Geography</SelectItem>
                          <SelectItem value="History & Government">History & Government</SelectItem>
                          <SelectItem value="Business Studies">Business Studies</SelectItem>
                          <SelectItem value="Agriculture">Agriculture</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsStaffDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Staff Member'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditStaffDialogOpen}
          onOpenChange={(open) => {
            setIsEditStaffDialogOpen(open)
            if (!open) {
              setEditingStaffId(null)
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleEditStaffSubmit} className="space-y-6">
              <DialogHeader>
                <DialogTitle>Edit Staff Member</DialogTitle>
                <DialogDescription>
                  Update staff details and allocations
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={editStaffForm.name} onChange={handleEditStaffInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={editStaffForm.email} onChange={handleEditStaffInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={editStaffForm.phone} onChange={handleEditStaffInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinDate">Join Date</Label>
                    <Input id="joinDate" type="date" value={editStaffForm.joinDate} onChange={handleEditStaffInputChange} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editRole">Role</Label>
                    <Select value={editStaffForm.role} onValueChange={(value) => handleEditStaffSelectChange('role', value)}>
                      <SelectTrigger id="editRole">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="class_teacher">Class Teacher</SelectItem>
                        <SelectItem value="registrar">Registrar</SelectItem>
                        <SelectItem value="exam_officer">Exam Officer</SelectItem>
                        <SelectItem value="hod">HOD</SelectItem>
                        <SelectItem value="timetable_manager">Timetable Manager</SelectItem>
                        <SelectItem value="transport_manager">Transport Manager</SelectItem>
                        <SelectItem value="boarding_master">Boarding Master</SelectItem>
                        <SelectItem value="cbc_coordinator">CBC Coordinator</SelectItem>
                        <SelectItem value="hr_manager">HR Manager</SelectItem>
                        <SelectItem value="admission_officer">Admission Officer</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="administrator">Administrator</SelectItem>
                        <SelectItem value="counselor">Counselor</SelectItem>
                        <SelectItem value="librarian">Librarian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editDepartment">Department</Label>
                    <Select value={editStaffForm.department} onValueChange={(value) => handleEditStaffSelectChange('department', value)}>
                      <SelectTrigger id="editDepartment">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Languages">Languages</SelectItem>
                        <SelectItem value="Sciences">Sciences</SelectItem>
                        <SelectItem value="Humanities">Humanities</SelectItem>
                        <SelectItem value="Technical & Applied Sciences">Technical & Applied Sciences</SelectItem>
                        <SelectItem value="Administration">Administration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Segregated Academic Fields for Edit flow */}
                {['teacher', 'class_teacher', 'hod', 'cbc_coordinator'].includes(editStaffForm.role) && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                    {editStaffForm.role === 'class_teacher' ? (
                      <div className="space-y-2">
                        <Label htmlFor="classAssigned">Assigned Class Stream</Label>
                        <Input id="classAssigned" placeholder="e.g. Grade 7 - East" value={editStaffForm.classAssigned} onChange={handleEditStaffInputChange} />
                      </div>
                    ) : <div />}
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" placeholder="e.g. Chemistry" value={editStaffForm.subject} onChange={handleEditStaffInputChange} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={editStaffForm.status} onValueChange={(value) => handleEditStaffSelectChange('status', value)}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditStaffDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          <TabsTrigger value="leave">Leave Management</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search staff..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="grid gap-4">
            {staff.map((member) => (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-12 h-12 rounded-full"
                      />
                      
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          <Link to={`/dashboard/staff/${member.id}`} className="hover:text-blue-600 transition-colors">
                            {member.name}
                          </Link>
                        </h3>
                        <p className="text-sm text-gray-600">{member.role} • {member.department}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{member.email}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{member.phone}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Joined {new Date(member.hire_date).getFullYear()}</span>
                      </div>

                      {member.class_assigned && (
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900">{member.class_assigned}</p>
                          <p className="text-xs text-gray-500">Class</p>
                        </div>
                      )}

                      {member.subject && (
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900">{member.subject}</p>
                          <p className="text-xs text-gray-500">Subject</p>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          {member.status}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => openStaffEdit(member)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deactivate {member.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeactivateStaff(member.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Deactivate
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter(req => req.status === 'Pending').map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{request.staffName}</h4>
                        <p className="text-sm text-gray-600">{request.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-sm font-medium">{request.startDate}</p>
                        <p className="text-xs text-gray-500">Start Date</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{request.endDate}</p>
                        <p className="text-xs text-gray-500">End Date</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleLeaveAction(request.id, 'approve')}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleLeaveAction(request.id, 'deny')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {leaveRequests.filter(req => req.status === 'Pending').length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No pending leave requests
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Leave History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter(req => req.status !== 'Pending').map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{request.staffName}</h4>
                        <p className="text-sm text-gray-600">{request.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-sm font-medium">{request.startDate}</p>
                        <p className="text-xs text-gray-500">Start Date</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{request.endDate}</p>
                        <p className="text-xs text-gray-500">End Date</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        request.status === 'Approved' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Management</CardTitle>
              <div className="flex space-x-4">
                <Button>Generate Payroll</Button>
                <Button variant="outline">Export Reports</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Payroll System</h3>
                <p>Manage staff salaries, bonuses, and payment processing</p>
                <Button className="mt-4">Set Up Payroll</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}