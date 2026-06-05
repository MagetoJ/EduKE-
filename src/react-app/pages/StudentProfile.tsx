import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Mail, Phone, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { useApi } from '../contexts/AuthContext'

type StudentProfile = {
  id: string
  first_name: string
  last_name: string
  name: string
  email: string
  phone: string
  grade: string
  class_section: string
  status: string
  parent_id: string
  parent_name?: string
  parent_email?: string
  parent_phone?: string
}

type Course = {
  id: string
  name: string
  teacher_name: string
  progress: string
  grade: string
}

type Attendance = {
  id: string
  date: string
  status: string
}

type Fee = {
  id: string
  description: string
  amount: string
  amount_paid: string
  status: string
  due_date: string
}

type DisciplineRecord = {
  id: string
  date: string
  type: string
  description: string
}

export function StudentProfile() {
  const { id } = useParams<{ id: string }>()
  const api = useApi()

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [discipline, setDiscipline] = useState<DisciplineRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError("No student ID found.")
      setIsLoading(false)
      return
    }

    const fetchStudentData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [studentRes, coursesRes, attendanceRes, feesRes, disciplineRes] = await Promise.all([
          api(`/api/students/${id}`),
          api(`/api/students/${id}/courses`),
          api(`/api/students/${id}/attendance`),
          api(`/api/fees?student_id=${id}`),
          api(`/api/discipline?student_id=${id}`)
        ])

        if (!studentRes.ok) throw new Error('Failed to fetch student details')

        const studentData = await studentRes.json()
        setStudent(studentData.data)

        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          setCourses(coursesData.data || [])
        }

        if (attendanceRes.ok) {
          const attData = await attendanceRes.json()
          setAttendance(attData.data || [])
        }

        if (feesRes.ok) {
          const feesData = await feesRes.json()
          setFees(feesData.data || [])
        }

        if (disciplineRes.ok) {
          const discData = await disciplineRes.json()
          setDiscipline(discData.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStudentData()
  }, [id, api])

  if (isLoading) {
    return <p>Loading student profile...</p>
  }

  if (error) {
    return <p className="text-red-500">{error}</p>
  }

  if (!student) {
    return <p>Student not found.</p>
  }

  const totalFees = fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0)
  const totalPaid = fees.reduce((sum, f) => sum + (parseFloat(f.amount_paid) || 0), 0)
  const outstanding = totalFees - totalPaid

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{student.name}</h1>
        <p className="text-gray-600">Student ID: {student.id}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Academic Standing</CardTitle>
            <CardDescription>Current grade and class</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold text-gray-900">{student.grade}</div>
            <p className="text-sm text-gray-600">Class {student.class_section}</p>
            <Badge variant="outline" className="w-fit">{student.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollment</CardTitle>
            <CardDescription>Course count</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-900">
              <User className="w-4 h-4" />
              <span>{courses.length} courses enrolled</span>
            </div>
            <div className="text-sm text-gray-600">
              {attendance.length} attendance records
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Fee status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Total Due</p>
              <p className="text-lg font-semibold text-gray-900">${totalFees.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-lg font-semibold text-red-600">${outstanding.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Email</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Mail className="w-4 h-4" />
                <span>{student.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Phone</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Phone className="w-4 h-4" />
                <span>{student.phone || 'Not provided'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Grade</p>
              <p className="text-gray-700">{student.grade}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Class</p>
              <p className="text-gray-700">{student.class_section}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parent/Guardian Information */}
      <Card>
        <CardHeader>
          <CardTitle>Parent/Guardian Information</CardTitle>
          <CardDescription>Contact details for emergency and communication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Parent/Guardian Name</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <User className="w-4 h-4" />
                <span>{student.parent_name || 'Not assigned'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Parent Email</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Mail className="w-4 h-4" />
                <span>{student.parent_email || 'Not provided'}</span>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium text-gray-500">Parent Phone</p>
              <div className="flex items-center space-x-2 text-gray-900">
                <Phone className="w-4 h-4" />
                <span>{student.parent_phone || 'Not provided'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="academics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="academics">Academics</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="discipline">Discipline</TabsTrigger>
        </TabsList>

        <TabsContent value="academics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Courses</CardTitle>
              <CardDescription>Current academic load</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courses.length === 0 ? (
                <p className="text-sm text-gray-600">No courses enrolled.</p>
              ) : (
                courses.map((course) => (
                  <div key={course.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{course.name}</p>
                      <p className="text-sm text-gray-600">Instructor: {course.teacher_name}</p>
                    </div>
                    <div className="flex items-center gap-8 mt-3 md:mt-0">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Grade</p>
                        <p className="text-lg font-semibold text-gray-900">{course.grade}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fee Structure</CardTitle>
              <CardDescription>Payment history and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fees.length === 0 ? (
                <p className="text-sm text-gray-600">No fees available.</p>
              ) : (
                fees.map((fee) => (
                  <div key={fee.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{fee.description}</p>
                      <p className="text-sm text-gray-600">Due {new Date(fee.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-8 mt-3 md:mt-0">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Amount</p>
                        <p className="text-lg font-semibold text-gray-900">${parseFloat(fee.amount).toFixed(2)}</p>
                      </div>
                      <Badge 
                        variant={fee.status === 'Paid' ? 'secondary' : fee.status === 'Partial' ? 'outline' : 'destructive'}
                      >
                        {fee.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Log</CardTitle>
              <CardDescription>Recent records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendance.length === 0 ? (
                <p className="text-sm text-gray-600">No attendance records available.</p>
              ) : (
                attendance.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <p className="font-medium text-gray-900">{new Date(entry.date).toLocaleDateString()}</p>
                    <Badge 
                      variant={entry.status === 'Present' ? 'secondary' : entry.status === 'Late' ? 'outline' : 'destructive'} 
                      className="mt-3 md:mt-0"
                    >
                      {entry.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discipline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Discipline Records</CardTitle>
              <CardDescription>Commendations and advisories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {discipline.length === 0 ? (
                <p className="text-sm text-gray-600">No records available.</p>
              ) : (
                discipline.map((record) => (
                  <div key={record.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{record.type}</p>
                      <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-sm text-gray-700">{record.description}</p>
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
