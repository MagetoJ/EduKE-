import { useCallback, useEffect, useState } from 'react'
import { Search, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi } from '../contexts/AuthContext'

type AttendanceStudent = {
  id: string
  name: string
  grade?: string | null
  classSection?: string | null
  status: string
  recordedAt?: string | null
}

export default function AttendancePage() {
  const api = useApi()
  const [attendanceRoster, setAttendanceRoster] = useState<AttendanceStudent[]>([])
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const loadRoster = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api(`/api/teacher/attendance/roster?date=${encodeURIComponent(attendanceDate)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to load attendance roster')
      
      setAttendanceRoster(data.students || [])
      setIsDirty(false)
    } catch (err) {
      setAttendanceRoster([])
      setError(err instanceof Error ? err.message : 'Failed to load attendance records')
    } finally {
      setLoading(false)
    }
  }, [api, attendanceDate])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  const handleStatusChange = (studentId: string, newStatus: string) => {
    setAttendanceRoster(current =>
      current.map(s => (s.id === studentId ? { ...s, status: newStatus } : s))
    )
    setIsDirty(true)
  }

  const saveAttendance = async () => {
    const records = attendanceRoster.map(s => ({
      studentId: Number(s.id),
      status: s.status
    }))

    setSaving(true)
    setError(null)
    try {
      const response = await api('/api/teacher/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date: attendanceDate,
          attendance: records
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to save attendance')
      }
      alert('Attendance saved successfully!')
      setIsDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving records')
    } finally {
      setSaving(false)
    }
  }

  // Statistics calculation
  const totalStudents = attendanceRoster.length
  const presentCount = attendanceRoster.filter(s => s.status === 'Present').length
  const absentCount = attendanceRoster.filter(s => s.status === 'Absent').length
  const unmarkedCount = attendanceRoster.filter(s => s.status === 'Not Marked').length
  const attendanceRate = totalStudents ? Math.round((presentCount / totalStudents) * 100) : 0

  const filteredRoster = attendanceRoster.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = statusFilter === 'All' || student.status === statusFilter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance Manager</h1>
        <p className="text-gray-600">Track and log daily student attendance metrics</p>
      </div>

      {/* Analytics Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{attendanceRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <CheckCircle className="w-5 h-5" /> {presentCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-1">
              <XCircle className="w-5 h-5" /> {absentCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Unmarked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500 flex items-center gap-1">
              <Clock className="w-5 h-5" /> {unmarkedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Control Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-end">
          <div className="grid flex-1 gap-4 grid-cols-1 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date-picker">Attendance Date</Label>
              <Input
                id="date-picker"
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="Filter name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Excused">Excused</SelectItem>
                  <SelectItem value="Not Marked">Not Marked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadRoster} disabled={loading}>
              Reset
            </Button>
            <Button onClick={saveAttendance} disabled={saving || !isDirty || totalStudents === 0}>
              {saving ? 'Saving...' : 'Commit Attendance'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Roster Sheet */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Syncing database data...</div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No student records found matching parameters.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRoster.map((student) => (
                <div key={student.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{student.name}</h3>
                    <p className="text-sm text-gray-500">
                      {student.grade || 'No Grade Assigned'} {student.classSection ? `• ${student.classSection}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['Present', 'Absent', 'Late', 'Excused'].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={student.status === status ? 'default' : 'outline'}
                        className={
                          student.status === status
                            ? status === 'Present' ? 'bg-green-600 hover:bg-green-700' : status === 'Absent' ? 'bg-red-600 hover:bg-red-700' : status === 'Late' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                            : ''
                        }
                        onClick={() => handleStatusChange(student.id, status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}