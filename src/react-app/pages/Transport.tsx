import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog'
import { useApi, useAuth } from '../contexts/AuthContext'
import { Bus, MapPin, Clock, DollarSign, Plus, Edit2, Trash2, Search } from 'lucide-react'

type TransportRoute = {
  id: number
  route_name: string
  route_code: string
  start_location: string
  end_location: string
  pickup_time: string
  dropoff_time: string
  vehicle_type: string
  capacity: number
  fare_amount: number
  status: string
}

type TransportEnrollment = {
  id: number
  student_id: number
  route_id: number
  route_name: string
  first_name: string
  last_name: string
  payment_status: string
  amount_due: number
  amount_paid: number
  status: string
}

export default function Transport() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [enrollments, setEnrollments] = useState<TransportEnrollment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showRouteDialog, setShowRouteDialog] = useState(false)
  const [formData, setFormData] = useState({
    route_name: '',
    route_code: '',
    start_location: '',
    end_location: '',
    pickup_time: '',
    dropoff_time: '',
    vehicle_type: '',
    capacity: '',
    fare_amount: ''
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [routesRes, enrollmentsRes] = await Promise.all([
        apiFetch('/api/transport/routes'),
        apiFetch('/api/transport/enrollments')
      ])

      if (!routesRes.ok || !enrollmentsRes.ok) {
        throw new Error('Failed to load transport data')
      }

      const routesData = await routesRes.json()
      const enrollmentsData = await enrollmentsRes.json()

      setRoutes(routesData.data || [])
      setEnrollments(enrollmentsData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddRoute = async () => {
    if (!formData.route_name || !formData.route_code) {
      setError('Route name and code are required')
      return
    }

    try {
      const response = await apiFetch('/api/transport/routes', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          capacity: parseInt(formData.capacity),
          fare_amount: parseFloat(formData.fare_amount)
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create route')
      }

      setShowRouteDialog(false)
      setFormData({
        route_name: '',
        route_code: '',
        start_location: '',
        end_location: '',
        pickup_time: '',
        dropoff_time: '',
        vehicle_type: '',
        capacity: '',
        fare_amount: ''
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create route')
    }
  }

  const handleDeleteRoute = async (routeId: number) => {
    try {
      const response = await apiFetch(`/api/transport/routes/${routeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete route')
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete route')
    }
  }

  const filteredRoutes = routes.filter(route =>
    route.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.route_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredEnrollments = enrollments.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.route_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!user || user.role !== 'admin') {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-800">Access Denied</CardTitle>
          <CardDescription className="text-yellow-700">
            Only administrators can access transport management
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transport Management</h1>
          <p className="text-gray-600">Manage school transportation routes and student enrollments</p>
        </div>
        <Button onClick={() => setShowRouteDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Route
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="routes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="enrollments">Student Enrollments</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search routes by name or code..."
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
          ) : filteredRoutes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Bus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No transport routes found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRoutes.map((route) => (
                <Card key={route.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">{route.route_name}</h3>
                          <Badge variant={route.status === 'active' ? 'default' : 'secondary'}>
                            {route.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{route.start_location} → {route.end_location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{route.pickup_time} - {route.dropoff_time}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Vehicle:</span> {route.vehicle_type || 'Not specified'}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Capacity:</span> {route.capacity} students
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="font-bold text-green-600">KES {route.fare_amount}</span>
                            <span className="text-sm text-gray-600">/month</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogTitle>Delete Route</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this route? This action cannot be undone.
                            </AlertDialogDescription>
                            <div className="flex gap-3 justify-end">
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRoute(route.id)} className="bg-red-600">
                                Delete
                              </AlertDialogAction>
                            </div>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
              placeholder="Search students or routes..."
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
                <Bus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No enrollments found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Route</th>
                    <th className="text-left py-3 px-4">Amount Due</th>
                    <th className="text-left py-3 px-4">Paid</th>
                    <th className="text-left py-3 px-4">Payment Status</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{enrollment.first_name} {enrollment.last_name}</td>
                      <td className="py-3 px-4">{enrollment.route_name}</td>
                      <td className="py-3 px-4">KES {enrollment.amount_due}</td>
                      <td className="py-3 px-4">KES {enrollment.amount_paid}</td>
                      <td className="py-3 px-4">
                        <Badge variant={enrollment.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {enrollment.payment_status}
                        </Badge>
                      </td>
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
      </Tabs>

      {showRouteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Transport Route</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Route Name</Label>
                <Input
                  value={formData.route_name}
                  onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                  placeholder="e.g., Westlands Route"
                />
              </div>
              <div className="space-y-2">
                <Label>Route Code</Label>
                <Input
                  value={formData.route_code}
                  onChange={(e) => setFormData({ ...formData, route_code: e.target.value })}
                  placeholder="e.g., WR-01"
                />
              </div>
              <div className="space-y-2">
                <Label>Start Location</Label>
                <Input
                  value={formData.start_location}
                  onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Location</Label>
                <Input
                  value={formData.end_location}
                  onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pickup Time</Label>
                <Input
                  type="time"
                  value={formData.pickup_time}
                  onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dropoff Time</Label>
                <Input
                  type="time"
                  value={formData.dropoff_time}
                  onChange={(e) => setFormData({ ...formData, dropoff_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Input
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  placeholder="e.g., Coaster"
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
                <Label>Monthly Fare (KES)</Label>
                <Input
                  type="number"
                  value={formData.fare_amount}
                  onChange={(e) => setFormData({ ...formData, fare_amount: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowRouteDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleAddRoute} className="flex-1">
                  Create Route
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
