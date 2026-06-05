import { useState, useEffect, useMemo, useCallback } from 'react'
import { User, BookOpen, DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi, useAuth } from '../contexts/AuthContext'

type DisciplineRecord = {
  id: number
  student_id: number
  teacher_id: number | null
  type: string
  severity: string
  description: string
  date: string
  status: string | null
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

type StudentDashboardData = {
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

type Child = {
  id: string
  first_name: string
  last_name: string
  admission_number: string
  grade: string
  class_assigned: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  status: string
}

type DashboardMetrics = {
  childrenCount: number
  totalAssignments: number
  upcomingAssignments: number
  totalFeesDue: number
  totalFeesPaid: number
  averageAttendance: number
  averagePerformance: number
}

export default function ParentDashboard() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [studentData, setStudentData] = useState<StudentDashboardData | null>(null)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const attendanceCards = useMemo(() => {
    if (!studentData) {
      return { present: 0, absent: 0, late: 0, percentage: 0 }
    }
    return studentData.attendance
  }, [studentData])

  // Load children and dashboard metrics on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true)
      setMetricsLoading(true)
      setError(null)
      try {
        const [childrenResponse, metricsResponse] = await Promise.all([
          apiFetch('/api/parent/children'),
          apiFetch('/api/parent/dashboard')
        ])

        if (!childrenResponse.ok) {
          throw new Error('Failed to load children')
        }
        if (!metricsResponse.ok) {
          throw new Error('Failed to load dashboard metrics')
        }

        const childrenData = await childrenResponse.json()
        const metricsData = await metricsResponse.json()

        setChildren(childrenData.data || [])
        setDashboardMetrics(metricsData.data)

        if (childrenData.data && childrenData.data.length > 0) {
          setSelectedChildId(childrenData.data[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
        setMetricsLoading(false)
      }
    }
    loadInitialData()
  }, [apiFetch])

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId)
  }

  const loadStudentData = useCallback(async (childId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch performance, attendance, fees in parallel
      const [performanceRes, attendanceRes, feesRes] = await Promise.all([
        apiFetch(`/api/students/${childId}/performance`),
        apiFetch(`/api/students/${childId}/attendance`),
        apiFetch(`/api/students/${childId}/fees`)
      ])

      const performanceData = performanceRes.ok ? await performanceRes.json() : { data: [] }
      const attendanceData = attendanceRes.ok ? await attendanceRes.json() : { data: [] }
      const feesData = feesRes.ok ? await feesRes.json() : { data: [] }

      const child = children.find(c => c.id === childId)
      if (!child) return

      // Process performance
      const performanceGroups: Record<string, number[]> = {}
      performanceData.data?.forEach((record: { score: string | number; subject?: string }) => {
        const numericGrade = Number(record.score)
        if (Number.isNaN(numericGrade)) return
        const subject = record.subject || 'General'
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
      const totalFees = feesData.data?.reduce((sum: number, _fee: { amount_due: string | number }) => sum + (Number(_fee.amount_due) || 0), 0) || 0
      const paidFees = feesData.data?.reduce((sum: number, _fee: { amount_paid: string | number }) => sum + (Number(_fee.amount_paid) || 0), 0) || 0
      const financial: FinancialSummary = {
        feesPaid: paidFees,
        feesDue: totalFees - paidFees,
        totalFees,
        status: paidFees >= totalFees ? 'Paid' : 'Pending'
      }

      setStudentData({
        id: child.id,
        name: `${child.first_name} ${child.last_name}`,
        grade: child.grade,
        className: child.class_assigned,
        discipline: [], // TODO: fetch discipline if available
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
      setIsLoading(false)
    }
  }, [apiFetch, children])

  // Load student data when child is selected
  useEffect(() => {
    if (selectedChildId) {
      loadStudentData(selectedChildId)
    }
  }, [selectedChildId, loadStudentData])

  // Check if user is a parent
  if (!user || user.role !== 'parent') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              This page is only accessible to parent users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading parent dashboard...</p>
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

  if (children.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">No Children Found</CardTitle>
            <CardDescription>You don't have any children registered in the system.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!studentData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Select Child</CardTitle>
            <CardDescription>Choose a child to view their information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Child</Label>
                <Select value={selectedChildId} onValueChange={handleChildChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.first_name} {child.last_name} - {child.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm font-medium text-red-500">{error}</p>}
              <Button onClick={() => selectedChildId && loadStudentData(selectedChildId)} className="w-full" disabled={isLoading || !selectedChildId}>
                {isLoading ? 'Loading...' : 'View Information'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parent Dashboard</h1>
          <p className="text-gray-600">
            Viewing information for {studentData?.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="child-select">Child:</Label>
            <Select value={selectedChildId} onValueChange={handleChildChange}>
              <SelectTrigger id="child-select" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.first_name} {child.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {metricsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading dashboard metrics...</div>
            </div>
          ) : dashboardMetrics ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Children</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.childrenCount}</div>
                  <p className="text-xs text-muted-foreground">Enrolled children</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.totalAssignments}</div>
                  <p className="text-xs text-muted-foreground">{dashboardMetrics.upcomingAssignments} upcoming</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.averageAttendance}%</div>
                  <p className="text-xs text-muted-foreground">Across all children</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Performance</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.averagePerformance}%</div>
                  <p className="text-xs text-muted-foreground">Overall average</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No dashboard metrics available</p>
            </div>
          )}

          {/* Individual Child Overview */}
          {studentData && (
            <>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Individual Child Overview</h3>
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
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentData!.performance.subjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No performance records available.</p>
                )}
                {studentData!.performance.subjects.map((subject) => (
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
                {studentData!.discipline.length === 0 && (
                  <p className="text-sm text-muted-foreground">No discipline records available.</p>
                )}
                {studentData!.discipline.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center space-x-4">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-medium">{record.type}</p>
                        <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</p>
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
                  <span>${studentData!.financial.totalFees}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fees Paid</span>
                  <span className="text-green-600">${studentData!.financial.feesPaid}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Outstanding</span>
                  <span className="text-red-600">${studentData!.financial.feesDue}</span>
                </div>
                <div className="border-t pt-2">
                  <Badge variant={studentData!.financial.status === 'Paid' ? 'default' : 'secondary'}>
                    {studentData!.financial.status}
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
