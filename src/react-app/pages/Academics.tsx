
import { useEffect, useState, FormEvent } from 'react'
import { BookOpen, FileText, Award, Download, AlertCircle, Loader2, User } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAuth, useApi } from '../contexts/AuthContext'
import type { User as UserType } from '../contexts/AuthContext'
import { useNavigate } from 'react-router'

// --- Types based on your API routes ---
type Course = {
  id: string;
  name: string;
  code: string;
  teacher_name: string;
  grade: string;
}

type Assignment = {
  id: string;
  title: string;
  course_name: string;
  due_date: string;
  status: string;
  course_id: string;
}

type Exam = {
  id: string;
  title: string;
  course_name: string;
  exam_date: string;
  duration_minutes: number;
  total_marks: number;
  status: string;
  course_id: string;
}

const CURRICULUM_LEVELS: Record<string, string[]> = {
  cbc: [ 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12' ],
  '844': [ 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Form 1', 'Form 2', 'Form 3', 'Form 4' ],
  british: [ 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13' ],
  american: [ 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12' ],
  ib: [ 'PYP 1', 'PYP 2', 'PYP 3', 'PYP 4', 'PYP 5', 'MYP 1', 'MYP 2', 'MYP 3', 'MYP 4', 'MYP 5', 'DP 1', 'DP 2' ]
}

// KICD 8-level descriptive achievement bands -- replaces a loose A-E or raw
// percent aggregate for CBC schools. Used both as a reference table in the
// Grading tab and (via getCbcAchievementBand) to map a raw score to its band.
type CbcAchievementBand = {
  band: string
  level: string
  min: number
  max: number
  points: number
}

const CBC_GRADING_SCALE: CbcAchievementBand[] = [
  { band: 'Exceeding Expectations',   level: 'EE1', min: 90, max: 100, points: 8 },
  { band: 'Exceeding Expectations',   level: 'EE2', min: 75, max: 89,  points: 7 },
  { band: 'Meeting Expectations',     level: 'ME1', min: 58, max: 74,  points: 6 },
  { band: 'Meeting Expectations',     level: 'ME2', min: 41, max: 57,  points: 5 },
  { band: 'Approaching Expectations', level: 'AE1', min: 31, max: 40,  points: 4 },
  { band: 'Approaching Expectations', level: 'AE2', min: 21, max: 30,  points: 3 },
  { band: 'Below Expectations',       level: 'BE1', min: 11, max: 20,  points: 2 },
  { band: 'Below Expectations',       level: 'BE2', min: 1,  max: 10,  points: 1 },
]

function getCbcAchievementBand(percentage: number): CbcAchievementBand | null {
  return CBC_GRADING_SCALE.find(b => percentage >= b.min && percentage <= b.max) ?? null
}

export default function Academics() {
  const { user } = useAuth() as any
  const api = useApi()
  const navigate = useNavigate()
  
  const [gradeLevels, setGradeLevels] = useState<string[]>(CURRICULUM_LEVELS.cbc)
  const [activeTab, setActiveTab] = useState('courses')
  
  // --- State for fetched data ---
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- State for dialogs ---
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false)
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false)
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false)

  // --- State for form data ---
  const [courseForm, setCourseForm] = useState({ name: '', code: '', teacher_id: '', grade: '', description: '', grade_band_id: '', learning_area_id: '' })
  const [assignmentForm, setAssignmentForm] = useState({ title: '', course_id: '', due_date: '', max_score: '100', assignment_type: 'homework' })
  const [examForm, setExamForm] = useState({ name: '', course_id: '', exam_date: '', total_marks: '100', duration_minutes: '60' })
  
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Staff list for dropdowns ---
  const [staff, setStaff] = useState<{ id: string, name: string }[]>([])

  // --- CBC master curriculum picker (grade band -> learning area) ---
  // Only relevant when the school's curriculum is 'cbc'; other curricula
  // keep using the plain CURRICULUM_LEVELS grade dropdown further below.
  const isCbcSchool = user?.schoolCurriculum === 'cbc'
  const [curriculumGradeBands, setCurriculumGradeBands] = useState<{ id: string, name: string }[]>([])
  const [curriculumLearningAreas, setCurriculumLearningAreas] = useState<{ id: string, name: string, code?: string }[]>([])

  useEffect(() => {
    if (user?.schoolCurriculum) {
      const levels = CURRICULUM_LEVELS[user.schoolCurriculum] ?? CURRICULUM_LEVELS.cbc
      setGradeLevels(levels)
    } else {
      setGradeLevels(CURRICULUM_LEVELS.cbc)
    }
  }, [user?.schoolCurriculum])

  // --- Fetch master CBC grade bands (Junior School, Senior School, etc.) ---
  // Uses the shared `api` helper (not raw fetch) so the request carries the
  // same auth/tenant headers as every other call in this file.
  useEffect(() => {
    if (!isCbcSchool) return
    api('/api/curriculum/grade-bands')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load grade bands')
        return res.json()
      })
      .then(data => setCurriculumGradeBands(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => setCurriculumGradeBands([]))
  }, [api, isCbcSchool])

  // --- Data Fetching Effect (MODIFIED) ---
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return; // Ensure user exists
      
      setIsLoading(true)
      setError(null)
      
      try {
        // Fetch common data
        const [coursesRes, assignmentsRes, examsRes] = await Promise.all([
          api('/api/courses'),
          api('/api/assignments'),
          api('/api/exams')
        ])

        if (!coursesRes.ok) throw new Error(`Failed to fetch courses: ${coursesRes.statusText}`)
        if (!assignmentsRes.ok) throw new Error(`Failed to fetch assignments: ${assignmentsRes.statusText}`)
        if (!examsRes.ok) throw new Error(`Failed to fetch exams: ${examsRes.statusText}`)

        const coursesData = await coursesRes.json()
        const assignmentsData = await assignmentsRes.json()
        const examsData = await examsRes.json()

        setCourses((Array.isArray(coursesData) ? coursesData : (coursesData.data || [])).filter((c: Course) => c && c.id))
        setAssignments((assignmentsData.data || []).filter((a: Assignment) => a && a.id))
        setExams((examsData.data || []).filter((ex: Exam) => ex && ex.id))

        // Conditionally fetch staff data only for admins
        if (user.role === 'admin') {
          const staffRes = await api('/api/staff')
          if (!staffRes.ok) throw new Error(`Failed to fetch staff: ${staffRes.statusText}`)
          const staffData = await staffRes.json()
          setStaff(staffData.data ? staffData.data.filter((s: UserType) => s.role === 'teacher') : [])
        }

      } catch (err) {
        // This catch block will now be reached if useApi is fixed
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [api, user]) // Added user to dependency array

  const canManage = user?.role === 'admin' || user?.role === 'teacher'

  // --- Form Submit Handlers (No changes) ---

  const handleCourseSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)
    try {
      const response = await api('/api/courses', {
        method: 'POST',
        body: JSON.stringify(courseForm),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create course')
      }
      const newCourse = await response.json()
      const createdCourse = newCourse?.data ?? newCourse
      if (!createdCourse || !createdCourse.id) {
        throw new Error('Server returned an unexpected response while creating the course')
      }
      setCourses(prev => [createdCourse, ...prev])
      setIsCourseDialogOpen(false)
      setCourseForm({ name: '', code: '', teacher_id: '', grade: '', description: '', grade_band_id: '', learning_area_id: '' })
      setCurriculumLearningAreas([])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Grade band changed: reset the dependent learning-area selection and
  // fetch the master learning areas for that band.
  const handleGradeBandChange = (bandId: string) => {
    setCourseForm(prev => ({ ...prev, grade_band_id: bandId, learning_area_id: '' }))
    setCurriculumLearningAreas([])
    if (!bandId) return
    api(`/api/curriculum/learning-areas?grade_band_id=${bandId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load learning areas')
        return res.json()
      })
      .then(data => setCurriculumLearningAreas(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => setCurriculumLearningAreas([]))
  }

  // Learning area chosen: pre-fill the course name/code from the master
  // record. Name/code stay editable in case the school wants a local label.
  const handleLearningAreaSelect = (areaId: string) => {
    const area = curriculumLearningAreas.find(la => la.id === areaId)
    setCourseForm(prev => ({
      ...prev,
      learning_area_id: areaId,
      name: area?.name ?? prev.name,
      code: area?.code ?? prev.code,
    }))
  }

  const handleAssignmentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)
    try {
      const response = await api('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...assignmentForm,
          max_score: parseInt(assignmentForm.max_score) || 100
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create assignment')
      }
      const newAssignment = await response.json()
      const createdAssignment = newAssignment?.data ?? newAssignment
      if (!createdAssignment || !createdAssignment.id) {
        throw new Error('Server returned an unexpected response while creating the assignment')
      }
      // Add course_name to the new assignment for UI consistency
      const course = courses.find(c => c.id === createdAssignment.course_id?.toString())
      createdAssignment.course_name = course?.name || 'Unknown Course'
      setAssignments(prev => [createdAssignment, ...prev])
      setIsAssignmentDialogOpen(false)
      setAssignmentForm({ title: '', course_id: '', due_date: '', max_score: '100', assignment_type: 'homework' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExamSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)
    try {
      const response = await api('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          ...examForm,
          total_marks: parseInt(examForm.total_marks) || 100,
          duration_minutes: parseInt(examForm.duration_minutes) || 60
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create exam')
      }
      const newExam = await response.json()
      const createdExam = newExam?.data ?? newExam
      if (!createdExam || !createdExam.id) {
        throw new Error('Server returned an unexpected response while creating the exam')
      }
      // Add course_name to the new exam for UI consistency
      const course = courses.find(c => c.id === createdExam.course_id?.toString())
      createdExam.course_name = course?.name || 'Unknown Course'
      setExams(prev => [createdExam, ...prev])
      setIsExamDialogOpen(false)
      setExamForm({ name: '', course_id: '', exam_date: '', total_marks: '100', duration_minutes: '60' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const renderError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const renderLoading = () => (
    <div className="flex items-center justify-center p-8 text-gray-600">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Loading data...
    </div>
  )

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900">
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-slate-800 flex items-center justify-between px-8 shadow-sm z-10">
          <h1 className="text-white font-semibold text-lg tracking-wide">
            ACADEMICS MANAGEMENT
          </h1>
          <div className="h-9 w-9 bg-slate-600 rounded-full flex items-center justify-center text-white hover:bg-slate-500 cursor-pointer">
            <User size={18} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-700 uppercase tracking-tight">
              Manage Courses, Assignments & Exams
            </h2>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4 relative z-50">
            <div className="flex items-center gap-4">
              {canManage && (
                <>
                  {user?.role === 'admin' && (
                    <Dialog open={isCourseDialogOpen} onOpenChange={(open) => { setIsCourseDialogOpen(open); setFormError(null); }}>
                      <DialogTrigger asChild>
                        <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm">
                          <BookOpen size={18} />
                          ADD COURSE
                        </button>
                      </DialogTrigger>
                      <DialogContent className="z-[100] max-w-2xl">
                        <form onSubmit={handleCourseSubmit}>
                          <DialogHeader>
                            <DialogTitle>Add New Course</DialogTitle>
                            <DialogDescription>
                              Create a new course for the academic year
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="courseName">Course Name</Label>
                                <Input id="courseName" placeholder="Enter course name" value={courseForm.name} onChange={(e) => setCourseForm({...courseForm, name: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="courseCode">Course Code</Label>
                                <Input id="courseCode" placeholder="e.g., MATH-401" value={courseForm.code} onChange={(e) => setCourseForm({...courseForm, code: e.target.value})} />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="teacher">Assigned Teacher</Label>
                                <Select value={courseForm.teacher_id} onValueChange={(value) => setCourseForm({...courseForm, teacher_id: value})}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select teacher" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[101]">
                                    {staff.map(s => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="grade">Grade Level</Label>
                                <Select value={courseForm.grade} onValueChange={(value) => setCourseForm({...courseForm, grade: value})}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select grade" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[101]">
                                    {gradeLevels.map(grade => (
                                      <SelectItem key={grade} value={grade}>
                                        {grade}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {isCbcSchool && (
                              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-md border border-slate-200">
                                <div className="col-span-2">
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                    KICD Master Curriculum (optional)
                                  </p>
                                  <p className="text-xs text-slate-500 mb-2">
                                    Linking a master learning area keeps this course aligned with the CBC catalogue instead of free text.
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="gradeBand">CBC Grade Band</Label>
                                  <Select value={courseForm.grade_band_id} onValueChange={handleGradeBandChange}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select grade band" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[101]">
                                      {curriculumGradeBands.map(gb => (
                                        <SelectItem key={gb.id} value={gb.id}>{gb.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="learningArea">Master Learning Area</Label>
                                  <Select
                                    value={courseForm.learning_area_id}
                                    onValueChange={handleLearningAreaSelect}
                                    disabled={!courseForm.grade_band_id}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={courseForm.grade_band_id ? 'Select learning area' : 'Choose a grade band first'} />
                                    </SelectTrigger>
                                    <SelectContent className="z-[101]">
                                      {curriculumLearningAreas.map(la => (
                                        <SelectItem key={la.id} value={la.id}>
                                          {la.name}{la.code ? ` (${la.code})` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor="description">Description</Label>
                              <textarea 
                                id="description" 
                                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                placeholder="Course description..."
                                value={courseForm.description} onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                              />
                            </div>
                            {renderError(formError)}
                          </div>
                          
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCourseDialogOpen(false)} disabled={isSubmitting}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                              {isSubmitting ? 'Creating...' : 'Create Course'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}

                  <Dialog open={isAssignmentDialogOpen} onOpenChange={(open) => { setIsAssignmentDialogOpen(open); setFormError(null); }}>
                    <DialogTrigger asChild>
                      <button className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors hover:border-slate-400">
                        <FileText size={18} />
                        NEW ASSIGNMENT
                      </button>
                    </DialogTrigger>
                    <DialogContent className="z-[100] max-w-2xl">
                      <form onSubmit={handleAssignmentSubmit}>
                        <DialogHeader>
                          <DialogTitle>Create Assignment</DialogTitle>
                          <DialogDescription>
                            Create a new assignment for your students
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                          <div className="space-y-2">
                            <Label htmlFor="assignmentTitle">Assignment Title</Label>
                            <Input id="assignmentTitle" placeholder="Enter assignment title" value={assignmentForm.title} onChange={(e) => setAssignmentForm({...assignmentForm, title: e.target.value})} />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="course">Course</Label>
                              <Select value={assignmentForm.course_id} onValueChange={(value) => setAssignmentForm({...assignmentForm, course_id: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select course" />
                                </SelectTrigger>
                                <SelectContent className="z-[101]">
                                  {courses.map(course => (
                                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="dueDate">Due Date</Label>
                              <Input id="dueDate" type="datetime-local" value={assignmentForm.due_date} onChange={(e) => setAssignmentForm({...assignmentForm, due_date: e.target.value})} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="max_score">Total Marks</Label>
                              <Input id="max_score" type="number" placeholder="100" value={assignmentForm.max_score} onChange={(e) => setAssignmentForm({...assignmentForm, max_score: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="assignment_type">Type</Label>
                              <Select value={assignmentForm.assignment_type} onValueChange={(value) => setAssignmentForm({...assignmentForm, assignment_type: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="z-[101]">
                                  <SelectItem value="homework">Homework</SelectItem>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="quiz">Quiz</SelectItem>
                                  <SelectItem value="lab">Lab Report</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {renderError(formError)}
                        </div>
                        
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAssignmentDialogOpen(false)} disabled={isSubmitting}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Assignment'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isExamDialogOpen} onOpenChange={(open) => { setIsExamDialogOpen(open); setFormError(null); }}>
                    <DialogTrigger asChild>
                      <button className="bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors hover:border-slate-400">
                        <Award size={18} />
                        SCHEDULE EXAM
                      </button>
                    </DialogTrigger>
                    <DialogContent className="z-[100] max-w-2xl">
                      <form onSubmit={handleExamSubmit}>
                        <DialogHeader>
                          <DialogTitle>Schedule Examination</DialogTitle>
                          <DialogDescription>
                            Schedule a new examination for students
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                          <div className="space-y-2">
                            <Label htmlFor="examTitle">Exam Title</Label>
                            <Input id="examTitle" placeholder="Enter exam title" value={examForm.name} onChange={(e) => setExamForm({...examForm, name: e.target.value})} />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="examCourse">Course</Label>
                              <Select value={examForm.course_id} onValueChange={(value) => setExamForm({...examForm, course_id: value})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select course" />
                                </SelectTrigger>
                                <SelectContent className="z-[101]">
                                  {courses.map(course => (
                                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="examDate">Exam Date & Time</Label>
                              <Input id="examDate" type="datetime-local" value={examForm.exam_date} onChange={(e) => setExamForm({...examForm, exam_date: e.target.value})} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="duration">Duration (minutes)</Label>
                              <Input id="duration" type="number" placeholder="120" value={examForm.duration_minutes} onChange={(e) => setExamForm({...examForm, duration_minutes: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="examMarks">Total Marks</Label>
                              <Input id="examMarks" type="number" placeholder="100" value={examForm.total_marks} onChange={(e) => setExamForm({...examForm, total_marks: e.target.value})} />
                            </div>
                          </div>

                          {renderError(formError)}
                        </div>
                        
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsExamDialogOpen(false)} disabled={isSubmitting}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Scheduling...' : 'Schedule Exam'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          {renderError(error)}

          {isLoading ? renderLoading() : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
                <div className="border-b border-slate-200 px-6 pt-6">
                  <TabsList className="w-auto grid grid-cols-4 gap-0 bg-transparent p-0">
                    <TabsTrigger value="courses" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none px-4 py-2">Courses</TabsTrigger>
                    <TabsTrigger value="assignments" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none px-4 py-2">Assignments</TabsTrigger>
                    <TabsTrigger value="exams" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none px-4 py-2">Examinations</TabsTrigger>
                    <TabsTrigger value="grading" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent rounded-none px-4 py-2">Grading</TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6">
                  <TabsContent value="courses" className="space-y-4">
                    <div className="grid gap-4">
                      {courses.map((course) => (
                        <Card key={course.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{course.name}</h3>
                                  <p className="text-sm text-gray-600">{course.code} • {course.grade}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-8">
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{course.teacher_name}</p>
                                  <p className="text-xs text-gray-500">Instructor</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/academics/courses/${course.id}`)}>
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="assignments" className="space-y-4">
                    <div className="grid gap-4">
                      {assignments.map((assignment) => (
                        <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                                  <p className="text-sm text-gray-600">{assignment.course_name}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-8">
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{new Date(assignment.due_date).toLocaleDateString()}</p>
                                  <p className="text-xs text-gray-500">Due Date</p>
                                </div>

                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  assignment.status === 'active' 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {assignment.status}
                                </span>

                                <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/academics/assignments/${assignment.id}`)}>
                                  View Submissions
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="exams" className="space-y-4">
                    <div className="grid gap-4">
                      {exams.map((exam) => (
                        <Card key={exam.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                                  <Award className="w-6 h-6 text-white" />
                                </div>
                                
                                <div>
                                  <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                                  <p className="text-sm text-gray-600">{exam.course_name}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-8">
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{new Date(exam.exam_date).toLocaleDateString()}</p>
                                  <p className="text-xs text-gray-500">Exam Date</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{exam.duration_minutes} mins</p>
                                  <p className="text-xs text-gray-500">Duration</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-900">{exam.total_marks}</p>
                                  <p className="text-xs text-gray-500">Total Marks</p>
                                </div>

                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  exam.status === 'Scheduled'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {exam.status || 'Scheduled'}
                                </span>

                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-1" />
                                    Papers
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/academics/exams/${exam.id}`)}>
                                    View Results
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="grading" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Gradebook</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isCbcSchool ? (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                              This school reports on KICD's 8-level descriptive achievement bands rather than a loose A–E or raw percentage aggregate. Exam and assignment scores are mapped to a band using the ranges below.
                            </p>
                            <div className="grid gap-2">
                              {CBC_GRADING_SCALE.map(band => (
                                <div key={band.level} className="flex items-center justify-between p-3 border rounded-md bg-white">
                                  <div>
                                    <p className="font-medium text-sm text-gray-900">{band.band} <span className="text-gray-400 font-normal">({band.level})</span></p>
                                    <p className="text-xs text-gray-500">{band.min}–{band.max}%</p>
                                  </div>
                                  <span className="text-sm font-semibold text-teal-600">{band.points} pts</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-500">
                            <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-medium mb-2">Grading System</h3>
                            <p>Manage student grades, rubrics, and assessment criteria</p>
                            <Button className="mt-4">Set Up Gradebook</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}