import { useState, useEffect, useMemo } from 'react'
import { User, BookOpen, DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { useApi, useAuth } from '../contexts/AuthContext'

type DisciplineRecord = {
  id: number
  student_id: number
  teacher_id: number | null
  type: string
  severity: string
  description: string
  date: string
  status: string
}

type FinancialSummary = {
  feesPaid: number
  feesDue: number
  totalFees: number
  status: string
}

type SubjectPerformance = {
  subject: string
  average: number
}

type AttendanceSummary = {
  present: number
  absent: number
  late: number
  total: number
  percentage: number
}

type StudentData = {
  id: string
  name: string
  grade: string | null
  className: string | null
  discipline: DisciplineRecord[]
  performance: {
    subjects: SubjectPerformance[]
    overallAverage: number
  }
  attendance: AttendanceSummary
  financial: FinancialSummary
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const attendanceCards = useMemo(() => {
    if (!studentData) {
      return { present: 0, absent: 0, late: 0, percentage: 0 }
    }
    return studentData.attendance
  }, [studentData])

  // Load student data on mount
  useEffect(() => {
    const loadStudentData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get student info first
        const studentResponse = await apiFetch('/api/students/me')
        if (!studentResponse.ok) {
          throw new Error('Failed to load student information')
        }
        const studentInfo = await studentResponse.json()

        // Get the student record
        const studentRecord = studentInfo.data
        if (!studentRecord || !studentRecord.id) {
          throw new Error('Student record not found')
        }

        const studentId = studentRecord.id

        // Fetch performance, attendance, fees in parallel
        const [performanceRes, attendanceRes, feesRes, disciplineRes] = await Promise.all([
          apiFetch(`/api/students/${studentId}/performance`),
          apiFetch(`/api/students/${studentId}/attendance`),
          apiFetch(`/api/students/${studentId}/fees`),
          apiFetch('/api/my-discipline')
        ])

        const performanceData = performanceRes.ok ? await performanceRes.json() : { data: [] }
        const attendanceData = attendanceRes.ok ? await attendanceRes.json() : { data: [] }
        const feesData = feesRes.ok ? await feesRes.json() : { data: [] }
        const disciplineData = disciplineRes.ok ? await disciplineRes.json() : { data: [] }

        // Process performance
        const performanceGroups: Record<string, number[]> = {}
        performanceData.data?.forEach((record: { score?: string | number; grade?: string | number; subject?: string; course_name?: string }) => {
          const numericGrade = Number(record.score || record.grade)
          if (Number.isNaN(numericGrade)) return
          const subject = record.subject || record.course_name || 'General'
          if (!performanceGroups[subject]) {
            performanceGroups[subject] = []
          }
          performanceGroups[subject].push(numericGrade)
        })

        const subjectPerformance: SubjectPerformance[] = Object.entries(performanceGroups).map(([subject, scores]) => ({
          subject,
          average: Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1))
        }))

        const overallAverage = subjectPerformance.length
          ? Number((subjectPerformance.reduce((sum, current) => sum + current.average, 0) / subjectPerformance.length).toFixed(1))
          : 0

        // Process attendance
        const initialSummary: AttendanceSummary = {
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
          percentage: 0
        }

        const attendanceSummary = attendanceData.data?.reduce(
          (summary: AttendanceSummary, record: { status: string }) => {
            const status = record.status?.toLowerCase()
            if (status === 'present') summary.present += 1
            else if (status === 'late') summary.late += 1
            else if (status === 'absent') summary.absent += 1
            summary.total += 1
            return summary
          },
          initialSummary
        ) || initialSummary

        attendanceSummary.percentage = attendanceSummary.total > 0
          ? Number(((attendanceSummary.present / attendanceSummary.total) * 100).toFixed(1))
          : 0

        // Process fees
        const totalFees = feesData.data?.reduce((sum: number, fee: { amount_due: string | number }) => sum + (Number(fee.amount_due) || 0), 0) || 0
        const paidFees = feesData.data?.reduce((sum: number, fee: { amount_paid: string | number }) => sum + (Number(fee.amount_paid) || 0), 0) || 0
        const financial: FinancialSummary = {
          feesPaid: paidFees,
          feesDue: totalFees - paidFees,
          totalFees,
          status: paidFees >= totalFees ? 'Paid' : 'Pending'
        }

        setStudentData({
          id: studentRecord.id,
          name: `${studentRecord.first_name} ${studentRecord.last_name}`,
          grade: studentRecord.grade,
          className: studentRecord.class_assigned,
          discipline: disciplineData.data || [],
          performance: {
            subjects: subjectPerformance,
            overallAverage
          },
          attendance: attendanceSummary,
          financial
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load student data')
      } finally {
        setLoading(false)
      }
    }

    loadStudentData()
  }, [apiFetch, user])

  // Check if user is a student
  if (!user || user.role !== 'student') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              This page is only accessible to student users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student dashboard...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error Loading Dashboard</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!studentData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">No Data Available</CardTitle>
            <CardDescription>Your student information could not be loaded.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {studentData.name}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="discipline">Discipline</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Grade</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentData.grade ?? 'N/A'}</div>
                <p className="text-xs text-muted-foreground">Class {studentData.className ?? 'N/A'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentData.performance.overallAverage}%</div>
                <p className="text-xs text-muted-foreground">Overall performance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attendanceCards.percentage}%</div>
                <p className="text-xs text-muted-foreground">Present rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fees Status</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${studentData.financial.feesDue}</div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentData.performance.subjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No performance records available.</p>
                )}
                {studentData.performance.subjects.map((subject) => (
                  <div key={subject.subject} className="flex items-center justify-between">
                    <span className="capitalize">{subject.subject}</span>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-24 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${Math.min(subject.average, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{subject.average}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discipline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discipline Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentData.discipline.length === 0 && (
                  <p className="text-sm text-muted-foreground">No discipline records available.</p>
                )}
                {studentData.discipline.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center space-x-4">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-medium">{record.type}</p>
                        <p className="text-sm text-gray-600">{record.description}</p>
                        <p className="text-sm text-gray-500">{new Date(record.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={record.severity === 'Minor' ? 'secondary' : 'destructive'}>
                        {record.severity}
                      </Badge>
                      <span className="text-sm text-gray-600">{record.status ?? 'Pending'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{attendanceCards.present}</div>
                  <p className="text-sm text-gray-600">Present</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{attendanceCards.absent}</div>
                  <p className="text-sm text-gray-600">Absent</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{attendanceCards.late}</div>
                  <p className="text-sm text-gray-600">Late</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{attendanceCards.percentage}%</div>
                  <p className="text-sm text-gray-600">Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Fees</span>
                  <span>${studentData.financial.totalFees}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fees Paid</span>
                  <span className="text-green-600">${studentData.financial.feesPaid}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Outstanding</span>
                  <span className="text-red-600">${studentData.financial.feesDue}</span>
                </div>
                <div className="border-t pt-2">
                  <Badge variant={studentData.financial.status === 'Paid' ? 'default' : 'secondary'}>
                    {studentData.financial.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
