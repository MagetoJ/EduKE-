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

type Dormitory = {
  id: number
  name: string
  dorm_master: string | null
  capacity: number
  enrolled_count: number
  gender: string
}

type BoardingEnrollment = {
  id: number
  student_id: number
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
  violation_type: string
  severity: string
  date_reported: string
  description: string
  status: string
}

export default function Boarding() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [dorms, setDorms] = useState<Dormitory[]>([])
  const [_enrollments, setEnrollments] = useState<BoardingEnrollment[]>([])
  const [_violations, setViolations] = useState<BoardingViolation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDormDialog, setShowDormDialog] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    dorm_master: '',
    capacity: '',
    gender: 'Boys'
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const dormsRes = await apiFetch('/api/boarding/dorms')
      if (!dormsRes.ok) throw new Error('Failed to load boarding data')
      const dormsData = await dormsRes.json()

      let enrollmentsData = [];
      let violationsData = [];
      try {
        const enrollmentsRes = await apiFetch('/api/boarding/enrollments');
        if (enrollmentsRes.ok) enrollmentsData = await enrollmentsRes.json();
      } catch (e) {}

      try {
        const violationsRes = await apiFetch('/api/boarding/violations');
        if (violationsRes.ok) violationsData = await violationsRes.json();
      } catch (e) {}

      setDorms(dormsData.data || dormsData || [])
      setEnrollments(enrollmentsData.data || enrollmentsData || [])
      setViolations(violationsData.data || violationsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddDorm = async () => {
    if (!formData.name) {
      setError('Dorm name is required')
      return
    }

    try {
      const response = await apiFetch('/api/boarding/dorms', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          capacity: parseInt(formData.capacity) || 0,
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create dormitory')
      }

      setShowDormDialog(false)
      setFormData({
        name: '',
        dorm_master: '',
        capacity: '',
        gender: 'Boys'
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dormitory')
    }
  }

  const handleDeleteDorm = async (dormId: number) => {
    try {
      const response = await apiFetch(`/api/boarding/dorms/${dormId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete dorm')
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dorm')
    }
  }

  const filteredDorms = dorms.filter(dorm =>
    dorm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dorm.dorm_master && dorm.dorm_master.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <p className="text-gray-600">Manage dormitories, enrollments, and student conduct</p>
        </div>
        <Button onClick={() => setShowDormDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Dormitory
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dorms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dorms">Dormitories</TabsTrigger>
          <TabsTrigger value="enrollments">Student Enrollments</TabsTrigger>
          <TabsTrigger value="violations">Violations & Conduct</TabsTrigger>
        </TabsList>

        <TabsContent value="dorms" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search dormitories..."
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
          ) : filteredDorms.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Home className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No dormitories found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDorms.map((dorm) => {
                const occupancyRate = (dorm.enrolled_count / dorm.capacity) * 100 || 0;
                const isFull = dorm.enrolled_count >= dorm.capacity;
                return (
                  <Card key={dorm.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-lg">{dorm.name}</h3>
                          <p className="text-sm text-gray-600">Dorm Master: {dorm.dorm_master || 'Unassigned'}</p>
                        </div>
                        <Badge variant={isFull ? 'destructive' : 'default'}>
                          {isFull ? 'Full' : 'Available'}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Gender Type:</span>
                          <Badge variant="outline">{dorm.gender}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Occupancy:</span>
                          <span className="font-medium">{dorm.enrolled_count}/{dorm.capacity}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${occupancyRate > 90 ? 'bg-red-600' : 'bg-blue-600'} h-2 rounded-full transition-all`}
                            style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                          ></div>
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
                            <AlertDialogTitle>Delete Dormitory</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this dorm? This action cannot be undone.
                            </AlertDialogDescription>
                            <div className="flex gap-3 justify-end">
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteDorm(dorm.id)} className="bg-red-600">
                                Delete
                              </AlertDialogAction>
                            </div>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
           <Card>
             <CardContent className="pt-6 text-center text-gray-500">
               <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
               <p>No boarding enrollments found</p>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
           <Card>
             <CardContent className="pt-6 text-center text-gray-500">
               <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
               <p>No violations recorded</p>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {showDormDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Dormitory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Dorm Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Elgon House"
                />
              </div>
              <div className="space-y-2">
                <Label>Dorm Master</Label>
                <Input
                  value={formData.dorm_master}
                  onChange={(e) => setFormData({ ...formData, dorm_master: e.target.value })}
                  placeholder="e.g., Mr. Ochieng"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Number of beds"
                />
              </div>
              <div className="space-y-2">
                <Label>Gender Type</Label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowDormDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAddDorm} className="flex-1">
                  Create Dorm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}