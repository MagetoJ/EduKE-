import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog'
import { useApi, useAuth } from '../contexts/AuthContext'
import { Home, Users, AlertTriangle, Plus, Edit2, Trash2, Search } from 'lucide-react'

type BoardingHouse = {
  id: number
  house_name: string
  house_code: string
  house_master_name: string | null
  deputy_master_name: string | null
  capacity: number
  current_occupancy: number
  gender_type: string
  fee_amount: number
  status: string
}

type BoardingEnrollment = {
  id: number
  student_id: number
  boarding_house_id: number
  house_name: string
  first_name: string
  last_name: string
  admission_number: string
  payment_status: string
  amount_due: number
  amount_paid: number
  status: string
  check_in_date: string
}

type BoardingViolation = {
  id: number
  student_id: number
  first_name: string
  last_name: string
  house_name: string
  violation_type: string
  severity: string
  date_reported: string
  description: string
  status: string
}

export default function Boarding() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [houses, setHouses] = useState<BoardingHouse[]>([])
  const [enrollments, setEnrollments] = useState<BoardingEnrollment[]>([])
  const [violations, setViolations] = useState<BoardingViolation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showHouseDialog, setShowHouseDialog] = useState(false)
  const [formData, setFormData] = useState({
    house_name: '',
    house_code: '',
    capacity: '',
    gender_type: 'boys',
    fee_amount: ''
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [housesRes, enrollmentsRes, violationsRes] = await Promise.all([
        apiFetch('/api/transport/boarding-houses'),
        apiFetch('/api/transport/boarding-enrollments'),
        apiFetch('/api/transport/boarding-violations')
      ])

      if (!housesRes.ok || !enrollmentsRes.ok) {
        throw new Error('Failed to load boarding data')
      }

      const housesData = await housesRes.json()
      const enrollmentsData = await enrollmentsRes.json()
      const violationsData = violationsRes.ok ? await violationsRes.json() : { data: [] }

      setHouses(housesData.data || [])
      setEnrollments(enrollmentsData.data || [])
      setViolations(violationsData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddHouse = async () => {
    if (!formData.house_name || !formData.house_code) {
      setError('House name and code are required')
      return
    }

    try {
      const response = await apiFetch('/api/transport/boarding-houses', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          capacity: parseInt(formData.capacity),
          fee_amount: parseFloat(formData.fee_amount)
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create boarding house')
      }

      setShowHouseDialog(false)
      setFormData({
        house_name: '',
        house_code: '',
        capacity: '',
        gender_type: 'boys',
        fee_amount: ''
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create boarding house')
    }
  }

  const handleDeleteHouse = async (houseId: number) => {
    try {
      const response = await apiFetch(`/api/transport/boarding-houses/${houseId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete house')
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete house')
    }
  }

  const filteredHouses = houses.filter(house =>
    house.house_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    house.house_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredEnrollments = enrollments.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.house_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredViolations = violations.filter(v =>
    `${v.first_name} ${v.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.violation_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user || user.role !== 'admin') {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-800">Access Denied</CardTitle>
          <CardDescription className="text-yellow-700">
            Only administrators can access boarding management
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Boarding Management</h1>
          <p className="text-gray-600">Manage boarding houses, enrollments, and student conduct</p>
        </div>
        <Button onClick={() => setShowHouseDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add House
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="houses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="houses">Boarding Houses</TabsTrigger>
          <TabsTrigger value="enrollments">Student Enrollments</TabsTrigger>
          <TabsTrigger value="violations">Violations & Conduct</TabsTrigger>
        </TabsList>

        <TabsContent value="houses" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search houses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </CardContent>
            </Card>
          ) : filteredHouses.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Home className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No boarding houses found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredHouses.map((house) => (
                <Card key={house.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{house.house_name}</h3>
                        <p className="text-sm text-gray-600">{house.house_code}</p>
                      </div>
                      <Badge variant={house.status === 'active' ? 'default' : 'secondary'}>
                        {house.status}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">House Master:</span>
                        <span className="font-medium">{house.house_master_name || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Gender Type:</span>
                        <Badge variant="outline">{house.gender_type}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Occupancy:</span>
                        <span className="font-medium">{house.current_occupancy}/{house.capacity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(house.current_occupancy / house.capacity) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Fee/Term:</span>
                        <span className="font-bold text-green-600">KES {house.fee_amount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="ghost" size="sm" className="flex-1">
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="flex-1">
                            <Trash2 className="w-4 h-4 mr-1 text-red-600" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Delete Boarding House</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this boarding house? This action cannot be undone.
                          </AlertDialogDescription>
                          <div className="flex gap-3 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteHouse(house.id)} className="bg-red-600">
                              Delete
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search students or houses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </CardContent>
            </Card>
          ) : filteredEnrollments.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No boarding enrollments found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">House</th>
                    <th className="text-left py-3 px-4">Check In</th>
                    <th className="text-left py-3 px-4">Amount Due</th>
                    <th className="text-left py-3 px-4">Paid</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{enrollment.first_name} {enrollment.last_name}</p>
                          <p className="text-xs text-gray-500">{enrollment.admission_number}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{enrollment.house_name}</td>
                      <td className="py-3 px-4">{new Date(enrollment.check_in_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">KES {enrollment.amount_due}</td>
                      <td className="py-3 px-4">KES {enrollment.amount_paid}</td>
                      <td className="py-3 px-4">
                        <Badge variant={enrollment.status === 'active' ? 'default' : 'secondary'}>
                          {enrollment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search violations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </CardContent>
            </Card>
          ) : filteredViolations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No violations recorded</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredViolations.map((violation) => (
                <Card key={violation.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold">{violation.first_name} {violation.last_name}</h3>
                          <Badge variant={violation.severity === 'critical' ? 'destructive' : violation.severity === 'major' ? 'secondary' : 'outline'}>
                            {violation.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{violation.house_name}</p>
                        <p className="text-sm mb-2"><span className="font-medium">Violation:</span> {violation.violation_type}</p>
                        <p className="text-sm text-gray-600 mb-2">{violation.description}</p>
                        <p className="text-xs text-gray-500">Reported on {new Date(violation.date_reported).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={violation.status === 'resolved' ? 'default' : 'secondary'}>
                        {violation.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showHouseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Boarding House</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>House Name</Label>
                <Input
                  value={formData.house_name}
                  onChange={(e) => setFormData({ ...formData, house_name: e.target.value })}
                  placeholder="e.g., Wilberforce House"
                />
              </div>
              <div className="space-y-2">
                <Label>House Code</Label>
                <Input
                  value={formData.house_code}
                  onChange={(e) => setFormData({ ...formData, house_code: e.target.value })}
                  placeholder="e.g., WH-01"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Number of students"
                />
              </div>
              <div className="space-y-2">
                <Label>Gender Type</Label>
                <select
                  value={formData.gender_type}
                  onChange={(e) => setFormData({ ...formData, gender_type: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="boys">Boys</option>
                  <option value="girls">Girls</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fee per Term (KES)</Label>
                <Input
                  type="number"
                  value={formData.fee_amount}
                  onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
                  placeholder="e.g., 25000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowHouseDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAddHouse} className="flex-1">
                  Create House
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
