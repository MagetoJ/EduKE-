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
  invoices: Array<{ id: number; amount: number; due_date: string; status: string }>
  payments: Array<{ id: number; amount: number; payment_date: string; transaction_ref: string }>
}

type GradeEntry = {
  id: number
  subject_id: number
  subject_name?: string
  score: number
  max_score: number
  exam_type: string
}

type TeacherRemark = {
  id: number
  term: number
  year: number
  remarks: string
}

type PerformanceSummary = {
  grades: GradeEntry[]
  teacherRemarks: TeacherRemark[]
  overallAverage: number
}

type AttendanceSummary = {
  present: number
  absent: number
  late: number
  total: number
  percentage: number
  history: Array<{ id: number; date: string; status: string }>
}

type StudentDashboardData = {
  id: string
  name: string
  grade: string | null
  className: string | null
  admissionNumber: string | null
  discipline: DisciplineRecord[]
  performance: PerformanceSummary
  attendance: AttendanceSummary
  financial: FinancialSummary
}

type Child = {
  id: string
  first_name: string
  last_name: string
  admission_number?: string
  grade?: string
  class_assigned?: string
  email?: string
  phone?: string
  date_of_birth?: string
  gender?: string
  status?: string
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
      return { present: 0, absent: 0, late: 0, percentage: 0, total: 0, history: [] }
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
          apiFetch('/api/parent/dashboard').catch(() => null)
        ])

        if (!childrenResponse.ok) {
          throw new Error('Failed to load children records.')
        }

        const childrenData = await childrenResponse.json()
        const rawChildrenList = childrenData.data || childrenData || []
        const parsedChildren: Child[] = rawChildrenList.map((c: Record<string, unknown>) => ({
          ...c,
          id: String(c.id)
        }))

        setChildren(parsedChildren)

        if (metricsResponse && metricsResponse.ok) {
          const metricsData = await metricsResponse.json()
          setDashboardMetrics(metricsData.data || metricsData)
        } else {
          setDashboardMetrics({
            childrenCount: parsedChildren.length,
            totalAssignments: 0,
            upcomingAssignments: 0,
            totalFeesDue: 0,
            totalFeesPaid: 0,
            averageAttendance: 100,
            averagePerformance: 0
          })
        }

        if (parsedChildren.length > 0) {
          setSelectedChildId(String(parsedChildren[0].id))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load initial data.')
      } finally {
        setIsLoading(false)
        setMetricsLoading(false)
      }
    }

    if (user && user.role === 'parent') {
      loadInitialData()
    }
  }, [apiFetch, user])

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId)
  }

  const loadStudentData = useCallback(
    async (childId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const [performanceRes, attendanceRes, feesRes, disciplineRes] = await Promise.all([
          apiFetch(`/api/students/${childId}/performance`),
          apiFetch(`/api/students/${childId}/attendance`),
          apiFetch(`/api/students/${childId}/fees`),
          apiFetch(`/api/my-discipline`).catch(() => null)
        ])

        const performanceJson = performanceRes.ok ? await performanceRes.json() : {}
        const attendanceJson = attendanceRes.ok ? await attendanceRes.json() : {}
        const feesJson = feesRes.ok ? await feesRes.json() : {}
        const disciplineJson = disciplineRes && disciplineRes.ok ? await disciplineRes.json() : {}

        const child = children.find((c) => String(c.id) === String(childId))

        // 1. Process Performance & Grades
        const rawPerformance = performanceJson.data || performanceJson || {}
        const rawGrades: GradeEntry[] = rawPerformance.grades || []
        const rawRemarks: TeacherRemark[] = rawPerformance.teacher_remarks || []

        let calculatedAverage = 0
        if (rawGrades.length > 0) {
          const sum = rawGrades.reduce((acc, g) => acc + (Number(g.score) || 0), 0)
          calculatedAverage = Number((sum / rawGrades.length).toFixed(1))
        }

        // 2. Process Attendance
        const rawAttendance = attendanceJson.data || attendanceJson || {}
        const summaryObj = rawAttendance.summary || {}
        const historyList = rawAttendance.history || []

        let present = summaryObj.present_days || 0
        let absent = summaryObj.absent_days || 0
        let late = summaryObj.late_days || 0
        let total = summaryObj.total_days || historyList.length
        let percentage = summaryObj.percentage || 0

        if (historyList.length > 0 && total === 0) {
          present = 0
          absent = 0
          late = 0
          historyList.forEach((r: { status: string }) => {
            const st = r.status?.toLowerCase()
            if (st === 'present') present += 1
            else if (st === 'absent') absent += 1
            else if (st === 'late') late += 1
          })
          total = historyList.length
          percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100
        }

        // 3. Process Financials
        const rawFees = feesJson.data || feesJson || {}
        const feeSummary = rawFees.summary || {}
        const totalBilled = feeSummary.total_billed ?? 0
        const totalPaid = feeSummary.total_paid ?? 0
        const balance = feeSummary.balance ?? Math.max(0, totalBilled - totalPaid)

        // 4. Process Discipline Records
        const rawDiscipline: DisciplineRecord[] = disciplineJson.data || disciplineJson || []

        setStudentData({
          id: String(childId),
          name: child ? `${child.first_name} ${child.last_name}` : 'Student',
          grade: child?.grade || 'N/A',
          className: child?.class_assigned || null,
          admissionNumber: child?.admission_number || null,
          discipline: rawDiscipline,
          performance: {
            grades: rawGrades,
            teacherRemarks: rawRemarks,
            overallAverage: calculatedAverage
          },
          attendance: {
            present,
            absent,
            late,
            total,
            percentage,
            history: historyList
          },
          financial: {
            feesPaid: totalPaid,
            feesDue: balance,
            totalFees: totalBilled,
            status: balance <= 0 ? 'Paid' : 'Pending',
            invoices: rawFees.invoices || [],
            payments: rawFees.payments || []
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load student data.')
      } finally {
        setIsLoading(false)
      }
    },
    [apiFetch, children]
  )

  useEffect(() => {
    if (selectedChildId) {
      loadStudentData(selectedChildId)
    }
  }, [selectedChildId, loadStudentData])

  if (!user || user.role !== 'parent') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
            <CardDescription className="text-center">
              This dashboard is only accessible to authenticated parent accounts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (isLoading && !studentData && children.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading parent portal...</p>
        </div>
      </div>
    )
  }

  if (error && children.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">No Linked Children</CardTitle>
            <CardDescription className="text-center">
              There are currently no student records linked to your parent account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parent Dashboard</h1>
          <p className="text-gray-600">
            Viewing records for <span className="font-semibold text-gray-800">{studentData?.name || 'Selected Child'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="child-select" className="whitespace-nowrap font-medium">
            Select Child:
          </Label>
          <Select value={selectedChildId} onValueChange={handleChildChange}>
            <SelectTrigger id="child-select" className="w-56">
              <SelectValue placeholder="Choose child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={String(child.id)}>
                  {child.first_name} {child.last_name} ({child.grade || 'Student'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="discipline">Discipline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {metricsLoading ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-sm text-muted-foreground">Refreshing portal metrics...</p>
            </div>
          ) : dashboardMetrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Children Enrolled</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.childrenCount}</div>
                  <p className="text-xs text-muted-foreground">Linked student profiles</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.totalAssignments}</div>
                  <p className="text-xs text-muted-foreground">{dashboardMetrics.upcomingAssignments} pending deadlines</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceCards.percentage}%</div>
                  <p className="text-xs text-muted-foreground">Present rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Average Mark</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{studentData?.performance.overallAverage ?? 0}%</div>
                  <p className="text-xs text-muted-foreground">Overall mean score</p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {studentData && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Child Details</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Class & Grade</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{studentData.grade || 'N/A'}</div>
                    <p className="text-xs text-muted-foreground">
                      Adm No: {studentData.admissionNumber || 'Unassigned'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{attendanceCards.percentage}%</div>
                    <p className="text-xs text-muted-foreground">
                      {attendanceCards.present} Present / {attendanceCards.absent} Absent
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Fee Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">
                      KES {studentData.financial.feesDue.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paid: KES {studentData.financial.feesPaid.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Fee Status</CardTitle>
                    <Badge variant={studentData.financial.status === 'Paid' ? 'default' : 'destructive'}>
                      {studentData.financial.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total Billed: KES {studentData.financial.totalFees.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Exam Scores</CardTitle>
              <CardDescription>Academic assessment entries published by subject teachers</CardDescription>
            </CardHeader>
            <CardContent>
              {studentData?.performance.grades && studentData.performance.grades.length > 0 ? (
                <div className="space-y-3">
                  {studentData.performance.grades.map((grade) => (
                    <div key={grade.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{grade.subject_name || `Subject ID: ${grade.subject_id}`}</p>
                        <p className="text-xs text-muted-foreground">{grade.exam_type || 'Continuous Assessment'}</p>
                      </div>
                      <Badge variant="secondary" className="text-sm font-semibold">
                        {grade.score} / {grade.max_score || 100}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No examination grades recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class Teacher Remarks</CardTitle>
              <CardDescription>End-of-term progress evaluation notes</CardDescription>
            </CardHeader>
            <CardContent>
              {studentData?.performance.teacherRemarks && studentData.performance.teacherRemarks.length > 0 ? (
                <div className="space-y-3">
                  {studentData.performance.teacherRemarks.map((remark) => (
                    <div key={remark.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
                      <p className="font-semibold text-gray-700">Term {remark.term}, {remark.year}</p>
                      <p className="text-gray-600 mt-1">{remark.remarks}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No class teacher remarks uploaded for this student.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{attendanceCards.present}</div>
                  <p className="text-xs text-gray-600">Days Present</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{attendanceCards.absent}</div>
                  <p className="text-xs text-gray-600">Days Absent</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{attendanceCards.late}</div>
                  <p className="text-xs text-gray-600">Days Late</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{attendanceCards.percentage}%</div>
                  <p className="text-xs text-gray-600">Attendance Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance Log</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceCards.history && attendanceCards.history.length > 0 ? (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {attendanceCards.history.map((record) => (
                    <div key={record.id} className="py-2 flex justify-between items-center text-sm">
                      <span>{new Date(record.date).toLocaleDateString()}</span>
                      <Badge
                        variant={
                          record.status?.toLowerCase() === 'present'
                            ? 'default'
                            : record.status?.toLowerCase() === 'late'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {record.status?.toUpperCase() || 'RECORDED'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent daily attendance logs available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Billed:</span>
                <span className="font-semibold">KES {studentData?.financial.totalFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Paid:</span>
                <span className="font-semibold text-green-600">KES {studentData?.financial.feesPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>Outstanding Balance:</span>
                <span className="font-bold text-red-600">KES {studentData?.financial.feesDue.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {studentData?.financial.payments && studentData.financial.payments.length > 0 ? (
                <div className="space-y-2">
                  {studentData.financial.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg text-sm">
                      <div>
                        <p className="font-medium">Ref: {payment.transaction_ref || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600">
                        KES {payment.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent fee payment transactions recorded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discipline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conduct & Incident Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {studentData?.discipline && studentData.discipline.length > 0 ? (
                <div className="space-y-3">
                  {studentData.discipline.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="font-medium">{record.type}</p>
                          <p className="text-xs text-gray-500">{record.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(record.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={record.severity?.toLowerCase() === 'minor' ? 'secondary' : 'destructive'}>
                          {record.severity}
                        </Badge>
                        <span className="text-xs text-gray-500">{record.status || 'Pending'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No disciplinary records reported for this student.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}