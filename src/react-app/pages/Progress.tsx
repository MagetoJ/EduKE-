import { useState, useEffect } from 'react'
import { useAuth, useApi } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Loader2, Calendar, Target, BarChart3, Award } from 'lucide-react'

type Assignment = {
  id: string;
  title: string;
  course_name: string;
  due_date: string;
}

type Fee = {
  id: string;
  amount_due: string | number;
  amount_paid: string | number;
}

export default function Progress() {
  const { user } = useAuth()
  const api = useApi()
  
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [assignmentsRes, feesRes] = await Promise.all([
          api('/api/assignments'),
          api('/api/fees')
        ])

        if (!assignmentsRes.ok) throw new Error('Failed to fetch assignments')
        if (!feesRes.ok) throw new Error('Failed to fetch fees')

        const assignmentsData = await assignmentsRes.json()
        const feesData = await feesRes.json()

        setAssignments(assignmentsData.data || [])
        setFees(feesData.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    if (user && (user.role === 'parent' || user.role === 'student')) {
      fetchData()
    }
  }, [api, user])

  if (!user || (user.role !== 'parent' && user.role !== 'student')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Access denied. This page is only available to parents and students.</p>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <p>Loading progress data...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }
  
  const totalFeesDue = fees.reduce((sum: number, fee: Fee) => sum + (Number(fee.amount_due) || 0), 0)
  const totalPaid = fees.reduce((sum: number, fee: Fee) => sum + (Number(fee.amount_paid) || 0), 0)
  const upcomingAssignments = assignments.filter(a => new Date(a.due_date) > new Date()).slice(0, 3)

  const renderParentView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Child's Progress</h1>
          <p className="text-gray-600">Track your child's academic performance and activities</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">{upcomingAssignments.length} upcoming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Due</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalFeesDue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Amount due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Paid</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Amount paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${(totalFeesDue - totalPaid).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAssignments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-gray-500">{assignment.course_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(assignment.due_date).toLocaleDateString()}</p>
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      Due Soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming assignments</p>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderStudentView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Progress</h1>
          <p className="text-gray-600">Track your academic performance and goals</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">{upcomingAssignments.length} upcoming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${totalFeesDue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Amount due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Amount paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${(totalFeesDue - totalPaid).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Balance</p>
          </CardContent>
        </Card>
      </div>

      {/* My Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>My Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.slice(0, 5).map((assignment) => (
                <div key={assignment.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{assignment.title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      new Date(assignment.due_date) < new Date() 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {new Date(assignment.due_date) < new Date() ? 'Overdue' : 'Due Soon'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{assignment.course_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No assignments at this time</p>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return user.role === 'parent' ? renderParentView() : renderStudentView()
}
