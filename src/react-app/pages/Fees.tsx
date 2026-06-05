import { useEffect, useState, FormEvent, useMemo } from 'react'
import { Plus, DollarSign, CheckCircle, AlertCircle, Clock, Loader2, User } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAuth, useApi } from '../contexts/AuthContext'
import { useNavigate } from 'react-router'

// --- Types based on API/Schema ---
// Note: The form uses 'fee_type' and 'term'
// The DB returns 'name' and 'frequency'
// We will handle this mapping
type FeeStructure = {
  id: string;
  name: string; // From DB
  fee_type: string; // From Form
  amount: number;
  grade: string;
  frequency: string; // From DB
  term: string; // From Form
  academic_year: string;
  description?: string;
}

type StudentFee = {
  id: string;
  student_id: string;
  description: string;
  fee_type: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  payment_status: string;
  first_name?: string; 
  last_name?: string;
}

type FeeCollection = {
  studentId: string;
  studentName: string;
  grade: string;
  totalDue: number;
  paid: number;
  outstanding: number;
  lastPayment: string;
}

// Type for our edit form
type FeeStructureForm = {
  id: string;
  fee_type: string;
  amount: string;
  grade: string;
  term: string;
  academic_year: string;
  description: string;
}

const EMPTY_FORM: FeeStructureForm = {
  id: '',
  fee_type: '',
  amount: '',
  grade: 'All Grades',
  term: '',
  academic_year: '',
  description: ''
}

export default function Fees() {
  const { user } = useAuth()
  const api = useApi()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'structure' : 'fees')
  
  // --- State for fetched data ---
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [studentFees, setStudentFees] = useState<StudentFee[]>([])
  const [feeCollection, setFeeCollection] = useState<FeeCollection[]>([])
  const [academicYears, setAcademicYears] = useState<{ id: string; label: string }[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // --- State for dialogs and forms ---
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  
  // "Add" dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addStructureForm, setAddStructureForm] = useState(EMPTY_FORM)

  // "Edit" dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editStructureForm, setEditStructureForm] = useState<FeeStructureForm>(EMPTY_FORM)


  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const fetchAcademicYears = async () => {
      try {
        const response = await api('/api/academic-years')
        const data = await response.json()
        
        if (data.success && Array.isArray(data.data)) {
          const years = data.data.map((year: { id: number | string; start_date?: string; end_date?: string }) => ({
            id: year.id.toString(),
            label: `${year.start_date?.substring(0, 4) || 'Unknown'} - ${year.end_date?.substring(0, 4) || 'Unknown'}`
          }))
          setAcademicYears(years)
        }
      } catch (err) {
        console.error('Error fetching academic years:', err)
      }
    }
    
    if (isAdmin) {
      fetchAcademicYears()
    }
  }, [api, isAdmin])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (isAdmin) {
          const [structuresRes, collectionRes] = await Promise.all([
            api('/api/fee-structures'),
            api('/api/fees')
          ])

          if (!structuresRes.ok) {
            const errData = await structuresRes.json()
            throw new Error(`Failed to fetch fee structures: ${errData.error || structuresRes.statusText}`)
          }
          const structuresData = await structuresRes.json()
          // Map DB names to form names for consistency
          const mappedStructures = (structuresData.data || []).map((fee: FeeStructure) => ({
            ...fee,
            fee_type: fee.name, // Map DB 'name' to 'fee_type'
            term: fee.frequency // Map DB 'frequency' to 'term'
          }))
          setFeeStructures(mappedStructures)

          if (!collectionRes.ok) {
            const errData = await collectionRes.json()
            throw new Error(`Failed to fetch fee collection: ${errData.error || collectionRes.statusText}`)
          }
          const collectionData = await collectionRes.json()
          
          const collectionMap: Record<string, FeeCollection> = {}
          const rawFees: StudentFee[] = collectionData.data || []
          
          rawFees.forEach(fee => {
            if (fee.student_id) { 
              const studentId = String(fee.student_id)
              
              if (!collectionMap[studentId]) {
                collectionMap[studentId] = {
                  studentId: studentId,
                  studentName: `${fee.first_name || 'N/A'} ${fee.last_name || ''}`.trim(),
                  grade: 'N/A', 
                  totalDue: 0,
                  paid: 0,
                  outstanding: 0,
                  lastPayment: 'N/A' 
                }
              }
              collectionMap[studentId].totalDue += Number(fee.amount_due) || 0
              collectionMap[studentId].paid += Number(fee.amount_paid) || 0
              collectionMap[studentId].outstanding = collectionMap[studentId].totalDue - collectionMap[studentId].paid
            }
          })
          setFeeCollection(Object.values(collectionMap))

        } else {
          const feesRes = await api('/api/fees')
          if (!feesRes.ok) {
             const errData = await feesRes.json()
            throw new Error(`Failed to fetch fees: ${errData.error || feesRes.statusText}`)
          }
          const feesData = await feesRes.json()
          setStudentFees(feesData.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [api, isAdmin])

  // --- "ADD" FORM HANDLER ---
  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)
    try {
      const response = await api('/api/fee-structures', {
        method: 'POST',
        body: JSON.stringify({
          ...addStructureForm,
          amount: parseFloat(addStructureForm.amount),
          term: addStructureForm.term.toLowerCase()
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create fee structure')
      }
      const newStructure = await response.json()
      // Map DB response to our form state
      const mappedData = {
        ...newStructure.data,
        fee_type: newStructure.data.name,
        term: newStructure.data.frequency
      }
      setFeeStructures(prev => [mappedData, ...prev])
      setIsAddDialogOpen(false)
      setAddStructureForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // --- "EDIT" FORM HANDLERS ---
  const handleOpenEditDialog = (fee: FeeStructure) => {
    setFormError(null);
    setEditStructureForm({
      id: fee.id,
      fee_type: fee.fee_type, // This is 'name' from the DB
      amount: String(fee.amount),
      grade: fee.grade,
      term: fee.term, // This is 'frequency' from the DB
      academic_year: fee.academic_year || '', // This field doesn't exist yet
      description: fee.description || ''
    });
    setIsEditDialogOpen(true);
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)
    
    if (!editStructureForm.id) {
      setFormError("No ID found, cannot update.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await api(`/api/fee-structures/${editStructureForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editStructureForm,
          amount: parseFloat(editStructureForm.amount),
          term: editStructureForm.term.toLowerCase()
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update fee structure')
      }
      const updatedStructure = await response.json()
      
      // Map DB response to our form state
      const mappedData = {
        ...updatedStructure.data,
        fee_type: updatedStructure.data.name,
        term: updatedStructure.data.frequency
      }

      // Find and replace the item in state
      setFeeStructures(prev => 
        prev.map(fee => fee.id === mappedData.id ? mappedData : fee)
      )
      
      setIsEditDialogOpen(false)
      setEditStructureForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }


  // --- Summary calculations (for Parent/Student view) ---
  const feeSummary = useMemo(() => {
    if (isAdmin) return { totalDue: 0, totalPaid: 0, outstanding: 0 }
    
    return studentFees.reduce((acc, fee) => {
      const due = Number(fee.amount_due) || 0
      const paid = Number(fee.amount_paid) || 0
      
      acc.totalDue += due
      acc.totalPaid += paid
      if (fee.payment_status !== 'paid') {
        acc.outstanding += (due - paid)
      }
      return acc
    }, { totalDue: 0, totalPaid: 0, outstanding: 0 })
  }, [studentFees, isAdmin])
  
  const renderLoading = () => (
    <div className="flex items-center justify-center p-8 text-gray-600">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Loading data...
    </div>
  )
  
  const renderError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const renderAdminView = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
      <div className="border-b border-slate-200">
        <TabsList className="bg-transparent border-none">
          <TabsTrigger value="structure" className="border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none">Fee Structure</TabsTrigger>
          <TabsTrigger value="collection" className="border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none">Fee Collection</TabsTrigger>
          <TabsTrigger value="reports" className="border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none">Reports</TabsTrigger>
        </TabsList>
      </div>
      
      {renderError(error)}

      <TabsContent value="structure" className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Fee Structure Management</h3>
            <p className="text-sm text-slate-600">Configure fee types and amounts for different grades</p>
          </div>
          
          {/* --- "ADD" DIALOG TRIGGER --- */}
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); setFormError(null); }}>
            <DialogTrigger asChild>
              <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm">
                <Plus className="w-4 h-4" />
                ADD FEE STRUCTURE
              </button>
            </DialogTrigger>
            <DialogContent className="z-[100] max-w-2xl">
              <form onSubmit={handleAddSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Fee Structure</DialogTitle>
                  <DialogDescription>Create a new fee type for students</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="feeName">Fee Name</Label>
                    <Input id="feeName" placeholder="e.g., Tuition Fee" value={addStructureForm.fee_type} onChange={e => setAddStructureForm({...addStructureForm, fee_type: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input id="amount" type="number" placeholder="1200" value={addStructureForm.amount} onChange={e => setAddStructureForm({...addStructureForm, amount: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Payment Type</Label>
                      <Select value={addStructureForm.term} onValueChange={(value) => setAddStructureForm({...addStructureForm, term: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="z-[101]">
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="semester">Semester</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="one-time">One-time</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="applicable">Applicable To (Grade)</Label>
                      <Input id="applicable" placeholder="e.g., All Grades, Grade 9" value={addStructureForm.grade} onChange={e => setAddStructureForm({...addStructureForm, grade: e.target.value})} />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="academic_year">Academic Year</Label>
                      <Select value={addStructureForm.academic_year} onValueChange={(value) => setAddStructureForm({...addStructureForm, academic_year: value})}>
                        <SelectTrigger id="academic_year">
                          <SelectValue placeholder="Select academic year" />
                        </SelectTrigger>
                        <SelectContent className="z-[101]">
                          {academicYears.map((year) => (
                            <SelectItem key={year.id} value={year.id}>
                              {year.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {renderError(formError)}
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Fee Structure'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* --- "EDIT" DIALOG (Mostly hidden) --- */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); setFormError(null); }}>
          <DialogContent className="z-[100] max-w-2xl">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Fee Structure</DialogTitle>
                <DialogDescription>Update the details for this fee item.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="editFeeName">Fee Name</Label>
                  <Input id="editFeeName" placeholder="e.g., Tuition Fee" value={editStructureForm.fee_type} onChange={e => setEditStructureForm({...editStructureForm, fee_type: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editAmount">Amount ($)</Label>
                    <Input id="editAmount" type="number" placeholder="1200" value={editStructureForm.amount} onChange={e => setEditStructureForm({...editStructureForm, amount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editType">Payment Type</Label>
                    <Select value={editStructureForm.term} onValueChange={(value) => setEditStructureForm({...editStructureForm, term: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="z-[101]">
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="semester">Semester</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editApplicable">Applicable To (Grade)</Label>
                    <Input id="editApplicable" placeholder="e.g., All Grades, Grade 9" value={editStructureForm.grade} onChange={e => setEditStructureForm({...editStructureForm, grade: e.target.value})} />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="editAcademicYear">Academic Year</Label>
                    <Select value={editStructureForm.academic_year} onValueChange={(value) => setEditStructureForm({...editStructureForm, academic_year: value})}>
                      <SelectTrigger id="editAcademicYear">
                        <SelectValue placeholder="Select academic year" />
                      </SelectTrigger>
                      <SelectContent className="z-[101]">
                        {academicYears.map((year) => (
                          <SelectItem key={year.id} value={year.id}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {renderError(formError)}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Fee Structure'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>


        {/* --- FEE STRUCTURES LIST --- */}
        {isLoading ? renderLoading() : (
          <div className="grid gap-4">
            {feeStructures.length === 0 && !error && <p className="text-sm text-slate-500">No fee structures created yet.</p>}
            {feeStructures.map((fee) => (
              <Card key={fee.id} className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{fee.fee_type}</h3>
                        <p className="text-sm text-slate-600">{fee.grade} • {fee.term}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">${fee.amount}</p>
                        <p className="text-xs text-slate-500">{fee.term}</p>
                      </div>
                      
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                      
                      {/* --- "EDIT" BUTTON (Now working) --- */}
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(fee)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="collection" className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Fee Collection Overview</h3>
        </div>
        
        <div className="space-y-4">
          {isLoading ? renderLoading() : 
            feeCollection.length === 0 && !error && <p className="text-sm text-slate-500">No fee collections found.</p>}
            {feeCollection.map((student) => (
              <Card key={student.studentId} className="border-slate-200">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{student.studentName}</h3>
                      <p className="text-sm text-slate-600">Grade: {student.grade}</p>
                    </div>
                    
                    <div className="flex items-center space-x-8 mt-4 md:mt-0">
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-900">${student.totalDue}</p>
                        <p className="text-xs text-slate-500">Total Due</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-green-600">${student.paid}</p>
                        <p className="text-xs text-slate-500">Paid</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-medium ${student.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${student.outstanding}
                        </p>
                        <p className="text-xs text-slate-500">Outstanding</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-900">{student.lastPayment}</p>
                        <p className="text-xs text-slate-500">Last Payment</p>
                      </div>

                      <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/students/${student.studentId}`)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          }
        </div>
      </TabsContent>
      
      <TabsContent value="reports" className="space-y-6 mt-6">
          <Card className="border-slate-200">
            <CardHeader>
                <CardTitle className="text-lg text-slate-900">Financial Reports</CardTitle>
                <CardDescription className="text-slate-600">Generate and view financial summaries</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-slate-600">Financial reporting tools will be available here.</p>
            </CardContent>
          </Card>
      </TabsContent>
    </Tabs>
  )

  const renderParentStudentView = () => (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Total Due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">${feeSummary.totalDue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">${feeSummary.totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${feeSummary.outstanding > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              ${feeSummary.outstanding.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {renderError(error)}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Fee Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? renderLoading() : (
            <div className="space-y-4">
              {studentFees.length === 0 && !error && <p className="text-slate-600">No fee records found.</p>}
              {studentFees.map((fee) => (
                <div key={fee.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      fee.payment_status === 'paid' ? 'bg-green-500' :
                      fee.payment_status === 'overdue' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}></div>
                    <div>
                      <h4 className="font-medium text-slate-900">{fee.fee_type}</h4>
                      <p className="text-sm text-slate-600">{fee.description || fee.fee_type}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 mt-4 md:mt-0">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">${fee.amount_due}</p>
                      <p className="text-sm text-slate-500">Due: {new Date(fee.due_date).toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {fee.payment_status === 'paid' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : fee.payment_status === 'overdue' ? (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                      
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        fee.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        fee.payment_status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {fee.payment_status}
                      </span>
                    </div>

                    {fee.payment_status !== 'paid' && (
                      <Button size="sm" className="bg-teal-500 hover:bg-teal-600">Pay Now</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900">
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 flex items-center justify-between px-8 shadow-sm z-10">
          <h1 className="text-white font-semibold text-lg tracking-wide">
            FEES MANAGEMENT
          </h1>
          <div className="h-9 w-9 bg-slate-600 rounded-full flex items-center justify-center text-white hover:bg-slate-500 cursor-pointer">
            <User size={18} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-700 uppercase tracking-tight">
              {isAdmin ? 'Manage Fee Structures & Collections' : 'View Fee Payments'}
            </h2>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-8">
              {isAdmin ? renderAdminView() : renderParentStudentView()}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}