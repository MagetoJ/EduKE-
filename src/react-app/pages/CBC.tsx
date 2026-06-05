import { useEffect, useState, useCallback, FormEvent } from 'react'
import { Plus, Search, Edit2, Trash2, BookOpen, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { useAuth, useApi } from '../contexts/AuthContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'

type Assessment = {
  id: string;
  student_id: string;
  strand_id: string;
  strand_name?: string;
  strand_code?: string;
  assessment_type: string;
  grade: number;
  comments: string;
  created_at: string;
}

type CBCStrand = {
  id: string;
  name: string;
  code: string;
  description?: string;
  grade_level?: string;
  created_at?: string;
}

interface CBCStudent {
  id: string | number;
  first_name: string;
  last_name: string;
}

const initialStrandForm = {
  name: '',
  code: '',
  description: '',
  grade_level: ''
}

export default function CBC() {
  const { user } = useAuth()
  const api = useApi()

  const [activeTab, setActiveTab] = useState('strands')
  const [strands, setStrands] = useState<CBCStrand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isStrandDialogOpen, setIsStrandDialogOpen] = useState(false)
  const [isEditingStrand, setIsEditingStrand] = useState(false)
  const [editingStrandId, setEditingStrandId] = useState<string | null>(null)
  const [strandForm, setStrandForm] = useState(initialStrandForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [isAssessmentDialogOpen, setIsAssessmentDialogOpen] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState({
    student_id: '',
    strand_id: '',
    assessment_type: 'formative' as 'formative' | 'summative',
    grade: '',
    comments: ''
  })
  const [students, setStudents] = useState<CBCStudent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [strandsRes, studentsRes] = await Promise.all([
        api('/api/kenya-features/cbc/strands'),
        api('/api/students')
      ])

      if (!strandsRes.ok) throw new Error('Failed to fetch strands')
      const strandsData = await strandsRes.json()
      setStrands(strandsData.data || [])

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json()
        setStudents(studentsData.data || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStrandSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    try {
      if (!strandForm.name || !strandForm.code) {
        throw new Error('Name and code are required')
      }

      const method = isEditingStrand ? 'PUT' : 'POST'
      const url = isEditingStrand
        ? `/api/kenya-features/cbc/strands/${editingStrandId}`
        : '/api/kenya-features/cbc/strands'

      const response = await api(url, {
        method,
        body: JSON.stringify(strandForm)
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save strand')

      if (isEditingStrand) {
        setStrands(prev => prev.map(s => s.id === editingStrandId ? data.data : s))
      } else {
        setStrands(prev => [...prev, data.data])
      }

      setIsStrandDialogOpen(false)
      setIsEditingStrand(false)
      setEditingStrandId(null)
      setStrandForm(initialStrandForm)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteStrand = async (id: string) => {
    try {
      const response = await api(`/api/kenya-features/cbc/strands/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete strand')
      setStrands(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const openStrandEdit = (strand: CBCStrand) => {
    setStrandForm({
      name: strand.name,
      code: strand.code,
      description: strand.description || '',
      grade_level: strand.grade_level || ''
    })
    setEditingStrandId(strand.id)
    setIsEditingStrand(true)
    setIsStrandDialogOpen(true)
  }

  const loadStudentAssessments = async (studentId: string) => {
    try {
      const response = await api(`/api/kenya-features/cbc/assessments/${studentId}`)
      if (response.ok) {
        const data = await response.json()
        setAssessments(data.data || [])
      }
    } catch (err) {
      console.error('Error loading assessments:', err)
    }
  }

  const getRatingLabel = (grade: number) => {
    const ratings: { [key: number]: string } = {
      4: 'EE - Exceeding Expectations',
      3: 'ME - Meeting Expectations',
      2: 'AE - Approaching Expectations',
      1: 'BE - Below Expectations'
    }
    return ratings[grade] || 'Unknown'
  }

  const getRatingColor = (grade: number) => {
    const colors: { [key: number]: string } = {
      4: 'bg-green-50 border-green-200 text-green-700',
      3: 'bg-blue-50 border-blue-200 text-blue-700',
      2: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      1: 'bg-red-50 border-red-200 text-red-700'
    }
    return colors[grade] || 'bg-gray-50 border-gray-200 text-gray-700'
  }

  const handleAssessmentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    try {
      if (!assessmentForm.student_id || !assessmentForm.strand_id || !assessmentForm.grade) {
        throw new Error('All fields are required')
      }

      const response = await api('/api/kenya-features/cbc/assessments', {
        method: 'POST',
        body: JSON.stringify({
          student_id: assessmentForm.student_id,
          strand_id: assessmentForm.strand_id,
          assessment_type: assessmentForm.assessment_type,
          grade: parseInt(assessmentForm.grade),
          comments: assessmentForm.comments
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create assessment')

      setIsAssessmentDialogOpen(false)
      setAssessmentForm({
        student_id: '',
        strand_id: '',
        assessment_type: 'formative',
        grade: '',
        comments: ''
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStrands = strands.filter(strand =>
    strand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    strand.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CBC Module</h1>
          <p className="text-gray-600">Competency Based Curriculum Management</p>
        </div>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="strands">Learning Strands</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="portfolio">Learner Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="strands" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search strands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {user?.role === 'admin' && (
              <Dialog open={isStrandDialogOpen} onOpenChange={setIsStrandDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setIsEditingStrand(false)
                    setEditingStrandId(null)
                    setStrandForm(initialStrandForm)
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Strand
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{isEditingStrand ? 'Edit Strand' : 'Create New Strand'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleStrandSubmit} className="space-y-4">
                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                        {formError}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="strand-name">Strand Name *</Label>
                      <Input
                        id="strand-name"
                        value={strandForm.name}
                        onChange={(e) => setStrandForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Language and Literacy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strand-code">Code *</Label>
                      <Input
                        id="strand-code"
                        value={strandForm.code}
                        onChange={(e) => setStrandForm(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="e.g., LL-01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strand-grade">Grade Level</Label>
                      <Select value={strandForm.grade_level} onValueChange={(value) => setStrandForm(prev => ({ ...prev, grade_level: value }))}>
                        <SelectTrigger id="strand-grade">
                          <SelectValue placeholder="Select grade level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PP1">PP1</SelectItem>
                          <SelectItem value="PP2">PP2</SelectItem>
                          <SelectItem value="Grade 1">Grade 1</SelectItem>
                          <SelectItem value="Grade 2">Grade 2</SelectItem>
                          <SelectItem value="Grade 3">Grade 3</SelectItem>
                          <SelectItem value="Grade 4">Grade 4</SelectItem>
                          <SelectItem value="Grade 5">Grade 5</SelectItem>
                          <SelectItem value="Grade 6">Grade 6</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strand-desc">Description</Label>
                      <Textarea
                        id="strand-desc"
                        value={strandForm.description}
                        onChange={(e) => setStrandForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the learning strand..."
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => {
                        setIsStrandDialogOpen(false)
                        setStrandForm(initialStrandForm)
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isEditingStrand ? 'Update Strand' : 'Create Strand'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-4">
            {filteredStrands.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  {strands.length === 0 ? 'No strands created yet' : 'No strands match your search'}
                </CardContent>
              </Card>
            ) : (
              filteredStrands.map(strand => (
                <Card key={strand.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-5 h-5 text-blue-600 mt-1" />
                        <div>
                          <CardTitle className="text-lg">{strand.name}</CardTitle>
                          <div className="flex gap-3 mt-1 text-sm text-gray-600">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{strand.code}</span>
                            {strand.grade_level && <span>{strand.grade_level}</span>}
                          </div>
                        </div>
                      </div>
                      {user?.role === 'admin' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStrandEdit(strand)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Strand</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this strand? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteStrand(strand.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {strand.description && (
                    <CardContent>
                      <p className="text-gray-600">{strand.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          {user?.role === 'teacher' && (
            <Dialog open={isAssessmentDialogOpen} onOpenChange={setIsAssessmentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Record Assessment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Student Assessment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAssessmentSubmit} className="space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                      {formError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="student-select">Student *</Label>
                    <Select value={assessmentForm.student_id} onValueChange={(value) => setAssessmentForm(prev => ({ ...prev, student_id: value }))}>
                      <SelectTrigger id="student-select">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.first_name} {student.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="strand-select">Learning Strand *</Label>
                    <Select value={assessmentForm.strand_id} onValueChange={(value) => setAssessmentForm(prev => ({ ...prev, strand_id: value }))}>
                      <SelectTrigger id="strand-select">
                        <SelectValue placeholder="Select strand" />
                      </SelectTrigger>
                      <SelectContent>
                        {strands.map(strand => (
                          <SelectItem key={strand.id} value={strand.id.toString()}>
                            {strand.name} ({strand.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assessment-type">Assessment Type *</Label>
                    <Select value={assessmentForm.assessment_type} onValueChange={(value) => setAssessmentForm(prev => ({ ...prev, assessment_type: value as 'formative' | 'summative' }))}>
                      <SelectTrigger id="assessment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formative">Formative (Ongoing)</SelectItem>
                        <SelectItem value="summative">Summative (End of term)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade-select">Competency Level *</Label>
                    <Select value={assessmentForm.grade} onValueChange={(value) => setAssessmentForm(prev => ({ ...prev, grade: value }))}>
                      <SelectTrigger id="grade-select">
                        <SelectValue placeholder="Select competency level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">EE - Exceeding Expectations</SelectItem>
                        <SelectItem value="3">ME - Meeting Expectations</SelectItem>
                        <SelectItem value="2">AE - Approaching Expectations</SelectItem>
                        <SelectItem value="1">BE - Below Expectations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comments">Comments/Feedback</Label>
                    <Textarea
                      id="comments"
                      value={assessmentForm.comments}
                      onChange={(e) => setAssessmentForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Add feedback for the student..."
                      rows={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAssessmentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Assessment
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Student</Label>
              <Select value={selectedStudent || ''} onValueChange={(value) => {
                setSelectedStudent(value)
                loadStudentAssessments(value)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student to view portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStudent && assessments.length > 0 ? (
              <div className="grid gap-4">
                {assessments.map(assessment => (
                  <Card key={assessment.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{assessment.strand_name}</CardTitle>
                          <div className="flex gap-2 mt-2 text-sm">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{assessment.strand_code}</span>
                            <span className="text-gray-600 capitalize">{assessment.assessment_type}</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded border text-sm font-medium ${getRatingColor(assessment.grade)}`}>
                          {getRatingLabel(assessment.grade)}
                        </div>
                      </div>
                    </CardHeader>
                    {assessment.comments && (
                      <CardContent className="pt-0">
                        <p className="text-gray-600 text-sm">{assessment.comments}</p>
                        <p className="text-xs text-gray-500 mt-2">{new Date(assessment.created_at).toLocaleDateString()}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : selectedStudent ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  No assessments recorded yet
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  Select a student to view their assessment portfolio
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
