import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Mail, Phone, CalendarDays, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { useApi } from '../contexts/AuthContext'

type StaffMember = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  department: string
  class_assigned: string
  subject: string
  hire_date: string
  status: string
}

type LeaveRequest = {
  id: string
  leave_type_name: string
  start_date: string
  end_date: string
  status: string
}

type Attendance = {
  id: string
  date: string
  status: string
  student_name: string
}

export function StaffProfile() {
  const { id } = useParams<{ id: string }>()
  const api = useApi()
  
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError("No staff ID found.")
      setIsLoading(false)
      return
    }

    const fetchStaffData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [staffRes, leaveRes, attendanceRes] = await Promise.all([
          api(`/api/staff/${id}`),
          api(`/api/staff/${id}/leave`),
          api(`/api/staff/${id}/attendance`)
        ])

        if (!staffRes.ok) throw new Error('Failed to fetch staff details')
        
        const staffData = await staffRes.json()
        setStaff(staffData.data)

        if (leaveRes.ok) {
          const leaveData = await leaveRes.json()
          setLeaveRequests(leaveData.data || [])
        }

        if (attendanceRes.ok) {
          const attData = await attendanceRes.json()
          setAttendance(attData.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStaffData()
  }, [id, api])

  if (isLoading) {
    return <p>Loading staff profile...</p>
  }

  if (error) {
    return <p className="text-red-500">{error}</p>
  }

  if (!staff) {
    return <p>Staff member not found.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{staff.name}</h1>
        <p className="text-gray-600">Staff ID: {staff.id}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Role</CardTitle>
            <CardDescription>Department assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold text-gray-900">{staff.role}</div>
            <p className="text-sm text-gray-600">{staff.department || 'Not assigned'}</p>
            <Badge variant="outline" className="w-fit">{staff.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Hire date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-900">
              <CalendarDays className="w-4 h-4" />
              <span>{staff.hire_date ? new Date(staff.hire_date).toLocaleDateString() : 'Not provided'}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{staff.subject || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Direct contact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-900">
              <Mail className="w-4 h-4" />
              <span className="text-sm truncate">{staff.email}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-900">
              <Phone className="w-4 h-4" />
              <span className="text-sm">{staff.phone || 'Not provided'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Staff details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Email</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Mail className="w-4 h-4" />
                <span>{staff.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Phone</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Phone className="w-4 h-4" />
                <span>{staff.phone || 'Not provided'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Department</p>
              <p className="text-gray-700">{staff.department || 'Not assigned'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Subject / Class</p>
              <p className="text-gray-700">{staff.class_assigned || staff.subject || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="leave" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>Requests and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-gray-600">No leave requests recorded.</p>
              ) : (
                leaveRequests.map((request) => (
                  <div key={request.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{request.leave_type_name}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(request.start_date).toLocaleDateString()} • {new Date(request.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge 
                      variant={request.status === 'approved' ? 'secondary' : request.status === 'pending' ? 'outline' : 'destructive'} 
                      className="mt-3 md:mt-0"
                    >
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Recent attendance entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendance.length === 0 ? (
                <p className="text-sm text-gray-600">No attendance records available.</p>
              ) : (
                attendance.slice(0, 20).map((record) => (
                  <div key={record.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{record.student_name}</p>
                      <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                    <Badge 
                      variant={record.status === 'Present' ? 'secondary' : record.status === 'Late' ? 'outline' : 'destructive'}
                      className="mt-3 md:mt-0"
                    >
                      {record.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
