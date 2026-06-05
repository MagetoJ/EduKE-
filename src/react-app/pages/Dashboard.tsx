import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  School,
  UserCheck,
  MessageSquare,
  Clock
} from 'lucide-react'
import { useApi, useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router'

type SchoolRecord = {
  id: string
  name: string
  students: number
  staff: number
  revenue: string
  status: string
}

type StudentRecord = {
  id: string
  name: string
  grade: string | null
  class: string | null
  status: string | null
  fees: string | null
}

type LeaveRequest = {
  id: string
  staff_name: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const parseCurrency = (value: string | null | undefined) => {
  if (!value) {
    return 0
  }
  const numeric = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isNaN(numeric) ? 0 : numeric
}

interface AdminMetricsData {
  totalStudents: number
  activeStudents: number
  totalStaff: number
  outstandingFees: number
  uniqueCourses: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const navigate = useNavigate()
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [adminStats, setAdminStats] = useState<AdminMetricsData | null>(null)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        return
      }
      setIsLoading(true)
      setError(null)
      setSchools([])
      setAdminStats(null)
      setStudents([])
      setLeaveRequests([])

      try {
        if (user.role === 'super_admin') {
          const response = await apiFetch('/api/schools')
          if (!response.ok) {
            throw new Error('Failed to load schools')
          }
          const data = await response.json()
          setSchools(Array.isArray(data) ? data : (data.data || []))
        } else if (['admin', 'registrar', 'exam_officer', 'hod', 'timetable_manager', 'transport_manager', 'boarding_master', 'cbc_coordinator', 'hr_manager', 'admission_officer', 'nurse'].includes(user.role)) {
          const [statsResponse, leaveResponse] = await Promise.all([
            apiFetch('/api/dashboard/stats'),
            apiFetch('/api/leave-requests')
          ])
          
          if (!statsResponse.ok) {
            console.error('Dashboard stats response error:', statsResponse.status, statsResponse.statusText)
            throw new Error('Failed to load dashboard stats')
          }
          const data = await statsResponse.json()
          console.log('Dashboard stats received:', data)
          setAdminStats(data?.data || null)
          
          if (leaveResponse.ok) {
            const leaveData = await leaveResponse.json()
            setLeaveRequests(leaveData.data || [])
          }
        } else if (user.role === 'teacher') {
          const studentsResponse = await apiFetch('/api/students')
          if (!studentsResponse.ok) {
            throw new Error('Failed to load students')
          }
          const studentData = await studentsResponse.json()
          setStudents(studentData.data || [])
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard data'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [apiFetch, user])

  const superAdminMetrics = useMemo(() => {
    const schoolsArray = Array.isArray(schools) ? schools : []
    const totalSchools = schoolsArray.length
    const totalStudents = schoolsArray.reduce((sum, school) => sum + Number(school.students || 0), 0)
    const totalStaff = schoolsArray.reduce((sum, school) => sum + Number(school.staff || 0), 0)
    const totalRevenue = schoolsArray.reduce((sum, school) => sum + parseCurrency(school.revenue), 0)
    return { totalSchools, totalStudents, totalStaff, totalRevenue }
  }, [schools])

  const adminMetrics = useMemo(() => {
    const defaultMetrics = {
      totalStudents: 0,
      activeStudents: 0,
      uniqueCourses: 0,
      totalStaff: 0,
      outstandingFees: 0
    }

    if (!adminStats) return defaultMetrics

    return {
      totalStudents: Number(adminStats.totalStudents) || 0,
      activeStudents: Number(adminStats.activeStudents) || 0,
      uniqueCourses: Number(adminStats.uniqueCourses) || 0,
      totalStaff: Number(adminStats.totalStaff) || 0,
      outstandingFees: Number(adminStats.outstandingFees) || 0
    }
  }, [adminStats])

  const teacherMetrics = useMemo(() => {
    const studentsArray = Array.isArray(students) ? students : []
    const classSet = new Set<string>()
    studentsArray.forEach((student) => {
      if (student.class) {
        classSet.add(student.class)
      }
    })
    return {
      studentCount: studentsArray.length,
      classCount: classSet.size,
      pendingGrades: 0,
      unreadMessages: 0
    }
  }, [students])

  if (!user) return null

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>
  }

  if (error) {
    return <p className="text-sm font-medium text-red-500">{error}</p>
  }

  const renderSuperAdminDashboard = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Overview</h1>
        <p className="text-gray-600">Manage all schools across the network</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminMetrics.totalSchools}</div>
            <p className="text-xs text-muted-foreground">Active institutions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminMetrics.totalStudents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all schools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${superAdminMetrics.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Collected to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminMetrics.totalStaff}</div>
            <p className="text-xs text-muted-foreground">Educators and administrators</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const pendingLeaves = leaveRequests.filter(lr => lr.status === 'pending')

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">School Dashboard</h1>
        <p className="text-slate-600">Overview of {user.schoolName}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminMetrics.totalStudents}</div>
            <p className="text-xs text-muted-foreground">{adminMetrics.activeStudents} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs Offered</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminMetrics.uniqueCourses}</div>
            <p className="text-xs text-muted-foreground">Distinct grade levels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(adminMetrics.outstandingFees || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminMetrics.totalStaff}</div>
            <p className="text-xs text-muted-foreground">Active faculty</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pending Leave Requests</h2>
            <p className="text-slate-600">{pendingLeaves.length} awaiting approval</p>
          </div>
          <Button onClick={() => navigate('/dashboard/leave')} variant="outline">
            View All
          </Button>
        </div>

        {pendingLeaves.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-slate-500">
              <p>No pending leave requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingLeaves.slice(0, 6).map((leave) => (
              <Card key={leave.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{leave.staff_name}</p>
                      <p className="text-sm text-slate-600">{leave.leave_type_name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-full">Pending</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderTeacherDashboard = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Students</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teacherMetrics.studentCount}</div>
            <p className="text-xs text-muted-foreground">Across assigned classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes Taught</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teacherMetrics.classCount}</div>
            <p className="text-xs text-muted-foreground">Unique sections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Grades</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teacherMetrics.pendingGrades}</div>
            <p className="text-xs text-muted-foreground">Awaiting submission</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teacherMetrics.unreadMessages}</div>
            <p className="text-xs text-muted-foreground">Unread notifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderParentDashboard = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Parent Dashboard</h1>
        <p className="text-gray-600">Use the Parent view to access detailed student information.</p>
      </div>
    </div>
  )

  const renderStudentDashboard = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user.name}</p>
      </div>
    </div>
  )

  const renderDashboard = () => {
    switch (user.role) {
      case 'super_admin':
        return renderSuperAdminDashboard()
      case 'admin':
      case 'registrar':
      case 'exam_officer':
      case 'hod':
      case 'timetable_manager':
      case 'transport_manager':
      case 'boarding_master':
      case 'cbc_coordinator':
      case 'hr_manager':
      case 'admission_officer':
      case 'nurse':
        return renderAdminDashboard()
      case 'teacher':
      case 'class_teacher':
        return renderTeacherDashboard()
      case 'parent':
        return renderParentDashboard()
      case 'student':
        return renderStudentDashboard()
      default:
        return renderAdminDashboard()
    }
  }

  return renderDashboard()
}
