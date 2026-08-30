import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog'
import { useApi, useAuth } from '../contexts/AuthContext'
import { Bus, User, MapPin, DollarSign, Plus, Edit2, Trash2, Search } from 'lucide-react'

// Updated to match backend RouteSchema
type TransportRoute = {
  id: number
  route_name: string
  driver_name: string | null
  vehicle_plate: string | null
  capacity: number
  fee_per_term: number
  enrolled_count: number
}

type TransportEnrollment = {
  id: number
  student_id: number
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
  
  // Updated Form Data to match backend
  const [formData, setFormData] = useState({
    route_name: '',
    driver_name: '',
    vehicle_plate: '',
    capacity: '',
    fee_per_term: ''
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const routesRes = await apiFetch('/api/transport/routes')
      if (!routesRes.ok) throw new Error('Failed to load transport data')
      const routesData = await routesRes.json()

      let enrollmentsData = [];
      try {
        const enrollmentsRes = await apiFetch('/api/transport/enrollments');
        if (enrollmentsRes.ok) enrollmentsData = await enrollmentsRes.json();
      } catch (e) {}

      // Handle both { data: [...] } and raw [...] array responses
      setRoutes(routesData.data || routesData || [])
      setEnrollments(enrollmentsData.data || enrollmentsData || [])
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
    if (!formData.route_name) {
      setError('Route name is required')
      return
    }

    try {
      const response = await apiFetch('/api/transport/routes', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          capacity: parseInt(formData.capacity) || 0,
          fee_per_term: parseFloat(formData.fee_per_term) || 0
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create route')
      }

      setShowRouteDialog(false)
      setFormData({
        route_name: '',
        driver_name: '',
        vehicle_plate: '',
        capacity: '',
        fee_per_term: ''
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
    (route.driver_name && route.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
              placeholder="Search routes or drivers..."
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
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRoutes.map((route) => {
                const isFull = route.enrolled_count >= route.capacity;
                return (
                  <Card key={route.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-lg">{route.route_name}</h3>
                            <Badge variant={isFull ? 'destructive' : 'default'}>
                              {isFull ? 'Full' : 'Available'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User className="w-4 h-4" />
                              <span>{route.driver_name || 'No Driver'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span className="uppercase">{route.vehicle_plate || 'No Plate'}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Capacity:</span> {route.enrolled_count} / {route.capacity}
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="font-bold text-green-600">KES {route.fee_per_term.toLocaleString()}</span>
                              <span className="text-sm text-gray-600">/ term</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
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
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-4">
           {/* UI matches original layout, relying on placeholder data handling */}
           <Card>
             <CardContent className="pt-6 text-center text-gray-500">
               <Bus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
               <p>No enrollments found</p>
             </CardContent>
           </Card>
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
                  placeholder="e.g., South C Route"
                />
              </div>
              <div className="space-y-2">
                <Label>Driver Name</Label>
                <Input
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Plate</Label>
                <Input
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  placeholder="e.g., KCA 123A"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Number of seats"
                />
              </div>
              <div className="space-y-2">
                <Label>Termly Fare (KES)</Label>
                <Input
                  type="number"
                  value={formData.fee_per_term}
                  onChange={(e) => setFormData({ ...formData, fee_per_term: e.target.value })}
                  placeholder="e.g., 15000"
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