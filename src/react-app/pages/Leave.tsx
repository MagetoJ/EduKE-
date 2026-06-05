import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Clock, CheckCircle, XCircle, FileText } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { useAuth, useApi } from '../contexts/AuthContext'

// Add this type definition
type LeaveRequest = {
  id: string;
  staff_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string;
  created_at: string;
};

export default function Leave() {
  const { user } = useAuth()
  const api = useApi()
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<Array<{id: string | number, name: string}>>([])
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [newRequest, setNewRequest] = useState({
    leave_type_id: '',
    startDate: '',
    endDate: '',
    reason: ''
  })

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isTeacher = user?.role === 'teacher'

  const fetchLeaveRequests = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api('/api/leave-requests')
      const data = await response.json()
      
      if (data.success) {
        setLeaveRequests(data.data)
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err)
      setError('Failed to load leave requests')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const response = await api('/api/leave-types')
      const data = await response.json()
      
      if (data.success) {
        setLeaveTypes(data.data)
      }
    } catch (err) {
      console.error('Error fetching leave types:', err)
    }
  }, [api])

  // Fetch leave requests and types on mount
  useEffect(() => {
    fetchLeaveRequests()
    fetchLeaveTypes()
  }, [fetchLeaveRequests, fetchLeaveTypes])

  const handleLeaveAction = async (requestId: string, action: 'approve' | 'deny') => {
    try {
      setIsLoading(true)
      const response = await api(`/api/leave-requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          rejection_reason: action === 'approve' ? 'Approved' : 'Denied'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update the local state
        setLeaveRequests(prev =>
          prev.map(request =>
            request.id === requestId
              ? { ...request, status: action === 'approve' ? 'approved' : 'rejected' }
              : request
          )
        )
      } else {
        setError(data.error || `Failed to ${action} leave request`)
      }
    } catch (err) {
      console.error(`Error ${action}ing leave request:`, err)
      setError(`Failed to ${action} leave request`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitRequest = async () => {
    if (!newRequest.leave_type_id || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      setError('Please fill in all fields')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const response = await api('/api/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          leave_type_id: parseInt(newRequest.leave_type_id),
          start_date: newRequest.startDate,
          end_date: newRequest.endDate,
          reason: newRequest.reason
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add the new request to the list
        setLeaveRequests(prev => [data.data, ...prev])
        
        // Reset form
        setNewRequest({ leave_type_id: '', startDate: '', endDate: '', reason: '' })
        setIsRequestDialogOpen(false)
        
        // Optionally refetch to ensure sync
        fetchLeaveRequests()
      } else {
        setError(data.error || 'Failed to submit leave request')
      }
    } catch (err) {
      console.error('Error submitting leave request:', err)
      setError('Failed to submit leave request')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'text-green-600 bg-green-50'
      case 'rejected':
      case 'denied': return 'text-red-600 bg-red-50'
      default: return 'text-yellow-600 bg-yellow-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'rejected':
      case 'denied': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage leave requests from staff members' : 'Request and track your leave applications'}
          </p>
        </div>

        {isTeacher && (
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request. Your request will be reviewed by an administrator.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Leave Type</Label>
                  <Select 
                    value={newRequest.leave_type_id} 
                    onValueChange={(value) => setNewRequest(prev => ({ ...prev, leave_type_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>
                          {type.name}
                        </SelectItem>
                      ))}
                      {/* Fallback options if leave types aren't loaded */}
                      {leaveTypes.length === 0 && (
                        <>
                          <SelectItem value="1">Annual Leave</SelectItem>
                          <SelectItem value="2">Sick Leave</SelectItem>
                          <SelectItem value="3">Maternity Leave</SelectItem>
                          <SelectItem value="4">Paternity Leave</SelectItem>
                          <SelectItem value="5">Emergency Leave</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <input
                      type="date"
                      id="startDate"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      value={newRequest.startDate}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <input
                      type="date"
                      id="endDate"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      value={newRequest.endDate}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please provide details about your leave request..."
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsRequestDialogOpen(false)
                    setError('')
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitRequest}
                  disabled={isLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {isLoading && leaveRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Loading leave requests...
          </div>
        )}

        {!isLoading && leaveRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No leave requests yet
          </div>
        )}

        {leaveRequests.map((request) => {
          const days = calculateDays(request.start_date, request.end_date)
          const statusDisplay = request.status.charAt(0).toUpperCase() + request.status.slice(1)
          
          return (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{request.staff_name || user?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{request.leave_type_name}</p>
                    </div>
                  </div>
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    <span>{statusDisplay}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(request.start_date).toLocaleDateString()} to {new Date(request.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{days} days</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Submitted: {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  <strong>Reason:</strong> {request.reason}
                </p>

                {isAdmin && request.status === 'pending' && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleLeaveAction(request.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleLeaveAction(request.id, 'deny')}
                      disabled={isLoading}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}