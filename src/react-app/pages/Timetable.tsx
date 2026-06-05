import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Loader2, AlertCircle, User, MoreHorizontal, MapPin, ChevronDown } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useAuth, useApi } from '../contexts/AuthContext'
import { Input } from '../components/ui/input'
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
} from "../components/ui/alert-dialog"

type TimetableEntry = {
  id: string;
  day_of_week: string;
  grade: string;
  class_section?: string;
  classroom: string;
  course_name: string;
  teacher_name: string;
  period_name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  course_id: string;
  teacher_id: string;
  period_id: string;
};

type Course = {
  id: string;
  name: string;
};

type TimePeriod = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
};

type Teacher = {
  id: string;
  name: string;
};

type FormData = {
  id?: string;
  course_id: string;
  teacher_id: string;
  period_id: string;
  day_of_week: string;
  grade: string;
  class_section: string;
  classroom: string;
};

type PeriodFormData = {
  period_name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

const EMPTY_FORM: FormData = {
  course_id: '',
  teacher_id: '',
  period_id: '',
  day_of_week: 'monday',
  grade: '',
  class_section: '',
  classroom: ''
};

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CURRICULUM_LEVELS: Record<string, string[]> = {
  cbc: [ 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12' ],
  '844': [ 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Form 1', 'Form 2', 'Form 3', 'Form 4' ],
  british: [ 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13' ],
  american: [ 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12' ],
  ib: [ 'PYP 1', 'PYP 2', 'PYP 3', 'PYP 4', 'PYP 5', 'MYP 1', 'MYP 2', 'MYP 3', 'MYP 4', 'MYP 5', 'DP 1', 'DP 2' ]
}

const colorStyles = {
  sky: 'bg-sky-200 border-l-sky-500 text-sky-900',
  orange: 'bg-orange-200 border-l-orange-500 text-orange-900',
  green: 'bg-green-200 border-l-green-500 text-green-900',
  purple: 'bg-purple-200 border-l-purple-500 text-purple-900',
  red: 'bg-red-300 border-l-red-500 text-red-900',
}

const labelColorStyles = {
  sky: 'text-sky-700',
  orange: 'text-orange-800',
  green: 'text-green-800',
  purple: 'text-purple-800',
  red: 'text-red-900',
}

export default function Timetable() {
  const { user } = useAuth()
  const api = useApi()

  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [periods, setPeriods] = useState<TimePeriod[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddPeriodDialogOpen, setIsAddPeriodDialogOpen] = useState(false)

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [periodFormData, setPeriodFormData] = useState<PeriodFormData>({
    period_name: '',
    start_time: '',
    end_time: '',
    is_break: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState('monday')
  
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [gradeLevels, setGradeLevels] = useState<string[]>([])

  useEffect(() => {
    if (user?.schoolCurriculum) {
      const levels = CURRICULUM_LEVELS[user.schoolCurriculum] ?? CURRICULUM_LEVELS.cbc
      setGradeLevels(levels)
    } else {
      setGradeLevels(CURRICULUM_LEVELS.cbc)
    }
  }, [user?.schoolCurriculum])

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setError('Please log in to access the timetable')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        let timetableUrl = '/api/timetable'
        const queryParams = []
        if (selectedGrade && selectedGrade !== 'all-grades') queryParams.push(`grade=${encodeURIComponent(selectedGrade)}`)
        if (selectedSection) queryParams.push(`class_section=${encodeURIComponent(selectedSection)}`)
        
        if (queryParams.length > 0) {
          timetableUrl += `?${queryParams.join('&')}`
        }

        const [tableRes, courseRes, periodRes] = await Promise.all([
          api(timetableUrl),
          api('/api/courses'),
          api('/api/timetable/periods')
        ])

        if (!tableRes.ok) {
          const errorData = await tableRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch timetable');
        }
        if (!courseRes.ok) {
          const errorData = await courseRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch courses');
        }
        if (!periodRes.ok) {
          const errorData = await periodRes.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch time periods');
        }

        const tableData = await tableRes.json()
        const courseData = await courseRes.json()
        const periodData = await periodRes.json()

        let teacherData = { data: [] }
        try {
          const teacherRes = await api('/api/teachers')
          if (teacherRes.ok) {
            teacherData = await teacherRes.json()
          } else {
            console.warn('Teachers endpoint returned:', teacherRes.status)
          }
        } catch (err) {
          console.warn('Failed to fetch teachers:', err)
        }

        const normalizedTimetable = (tableData.data || []).map((entry: TimetableEntry) => ({
          ...entry,
          id: String(entry.id),
          course_id: String(entry.course_id),
          teacher_id: String(entry.teacher_id),
          period_id: String(entry.period_id),
          day_of_week: (entry.day_of_week || '').trim().toLowerCase()
        }))

        console.log('Normalized Timetable Data:', normalizedTimetable)
        setTimetableData(normalizedTimetable)
        setCourses((courseData.data || []).map((c: Course) => ({ ...c, id: String(c.id) })))
        setTeachers((teacherData.data || []).map((t: Teacher) => ({ ...t, id: String(t.id) })))
        console.log('Periods Data:', periodData.data)
        setPeriods((periodData.data || []).map((p: TimePeriod) => ({ ...p, id: String(p.id) })))

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [api, user, selectedGrade, selectedSection])

  const handleFormChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePeriodFormChange = (field: keyof PeriodFormData, value: string | boolean) => {
    setPeriodFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    if (!formData.course_id) {
      setFormError('Please select a course')
      setIsSubmitting(false)
      return
    }
    if (!formData.teacher_id) {
      setFormError('Please select a teacher')
      setIsSubmitting(false)
      return
    }
    if (!formData.period_id) {
      setFormError('Please select a period')
      setIsSubmitting(false)
      return
    }
    if (!formData.day_of_week) {
      setFormError('Please select a day')
      setIsSubmitting(false)
      return
    }
    if (!formData.grade) {
      setFormError('Please enter a grade')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await api('/api/timetable', {
        method: 'POST',
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create entry')

      const course = courses.find(c => String(c.id) === String(data.data.course_id))
      const period = periods.find(p => String(p.id) === String(data.data.period_id))
      const teacher = teachers.find(t => String(t.id) === String(data.data.teacher_id))

      const newEntry: TimetableEntry = {
        ...data.data,
        id: String(data.data.id),
        course_id: String(data.data.course_id),
        teacher_id: String(data.data.teacher_id),
        period_id: String(data.data.period_id),
        course_name: course?.name || 'Unknown',
        teacher_name: teacher?.name || 'N/A',
        period_name: period?.name || 'Unknown',
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
      }

      setTimetableData(prev => [newEntry, ...prev])
      setIsAddDialogOpen(false)
      setFormData(EMPTY_FORM)

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddPeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    if (!periodFormData.period_name) {
      setFormError('Please enter period name')
      setIsSubmitting(false)
      return
    }
    if (!periodFormData.start_time) {
      setFormError('Please enter start time')
      setIsSubmitting(false)
      return
    }
    if (!periodFormData.end_time) {
      setFormError('Please enter end time')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await api('/api/timetable/periods', {
        method: 'POST',
        body: JSON.stringify(periodFormData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create period')

      setPeriods(prev => [...prev, data.data])
      setIsAddPeriodDialogOpen(false)
      setPeriodFormData({
        period_name: '',
        start_time: '',
        end_time: '',
        is_break: false
      })

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditDialog = (entry: TimetableEntry) => {
    setFormError(null)
    setFormData({
      id: entry.id,
      course_id: entry.course_id,
      teacher_id: entry.teacher_id,
      period_id: entry.period_id,
      day_of_week: entry.day_of_week,
      grade: entry.grade,
      class_section: entry.class_section || '',
      classroom: entry.classroom,
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    if (!formData.id) {
      setFormError('No ID found, cannot update.')
      return;
    }

    try {
      const res = await api(`/api/timetable/${formData.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update entry')

      const course = courses.find(c => String(c.id) === String(data.data.course_id))
      const period = periods.find(p => String(p.id) === String(data.data.period_id))
      const teacher = teachers.find(t => String(t.id) === String(data.data.teacher_id))

      const updatedEntry: TimetableEntry = {
        ...data.data,
        id: String(data.data.id),
        course_id: String(data.data.course_id),
        teacher_id: String(data.data.teacher_id),
        period_id: String(data.data.period_id),
        course_name: course?.name || 'Unknown',
        teacher_name: teacher?.name || 'N/A',
        period_name: period?.name || 'Unknown',
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
      }

      setTimetableData(prev => prev.map(item => item.id === updatedEntry.id ? updatedEntry : item))
      setIsEditDialogOpen(false)
      setFormData(EMPTY_FORM)

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await api(`/api/timetable/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete entry')
      }
      setTimetableData(prev => prev.filter(entry => entry.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const renderLoading = () => (
    <div className="flex items-center justify-center p-8 text-gray-600">
      <Loader2 className="w-6 h-6 animate-spin mr-2" />
      Loading timetable...
    </div>
  )

  const renderError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const renderFormError = (err: string | null) => err && (
    <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
      <AlertCircle className="w-4 h-4" /> {err}
    </div>
  )

  const canManage = user?.role === 'admin' || user?.role === 'super_admin'
  
  const getHeaderTitle = () => {
    if (user?.role === 'student') return 'MY CLASS SCHEDULE'
    if (user?.role === 'parent') return 'CHILDREN\'S CLASS SCHEDULE'
    return 'ACADEMIC TIMETABLE'
  }
  
  const getHeaderSubtitle = () => {
    if (user?.role === 'student') return 'Your personal class timetable'
    if (user?.role === 'parent') return 'Timetables for your children'
    return 'Manage class schedules'
  }

  const getColorForCourse = (index: number) => {
    const colors = ['sky', 'orange', 'green', 'purple', 'red']
    return colors[index % colors.length]
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900">
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 sm:h-16 bg-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm z-10">
          <h1 className="text-white font-semibold text-sm sm:text-lg tracking-wide truncate">
            {getHeaderTitle()}
          </h1>
          <div className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-600 rounded-full flex items-center justify-center text-white hover:bg-slate-500 cursor-pointer flex-shrink-0">
            <User size={16} className="sm:block hidden" />
            <User size={14} className="sm:hidden block" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-700 uppercase tracking-tight">
              {getHeaderTitle()}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{getHeaderSubtitle()}</p>
          </div>

          {!canManage && timetableData.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 sm:p-4 rounded-lg mb-6 flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm sm:text-base">No classes scheduled</p>
                <p className="text-xs sm:text-sm text-blue-600 mt-1">Your timetable appears to be empty or not yet scheduled by administrators.</p>
              </div>
            </div>
          )}

          {!canManage && timetableData.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 text-teal-700 p-3 sm:p-4 rounded-lg mb-6 flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm sm:text-base">Viewing personalized schedule</p>
                <p className="text-xs sm:text-sm text-teal-600 mt-1">Below is your class schedule. Contact your school administrator if you notice any issues.</p>
              </div>
            </div>
          )}

          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <div className="flex items-center gap-2 mr-2">
                  <div className="w-40">
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                      <SelectTrigger className="bg-slate-50 border-slate-200">
                        <SelectValue placeholder="All Grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-grades">All Grades</SelectItem>
                        {gradeLevels.map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input 
                      placeholder="Section" 
                      value={selectedSection} 
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="bg-slate-50 border-slate-200 h-10"
                    />
                  </div>
                </div>
              )}
              {canManage && (
                <>
                  <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); setFormData(EMPTY_FORM); setFormError(null); }}>
                    <DialogTrigger asChild>
                      <button className="bg-teal-500 hover:bg-teal-600 text-white px-3 sm:px-4 py-2 rounded-md font-medium text-sm flex items-center gap-1 sm:gap-2 transition-colors shadow-sm flex-1 sm:flex-none justify-center">
                        <Plus size={16} className="sm:block hidden" />
                        <Plus size={14} className="sm:hidden block" />
                        <span className="hidden sm:inline">ADD NEW ENTRY</span>
                        <span className="sm:hidden">Add</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleAddSubmit}>
                        <DialogHeader>
                          <DialogTitle>Add Timetable Entry</DialogTitle>
                        <DialogDescription>
                          Add a new timetable entry for the academic schedule
                        </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="day_of_week">Day of Week</Label>
                            <Select value={formData.day_of_week} onValueChange={(val) => handleFormChange('day_of_week', val)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="period_id">Time Period</Label>
                            <Select value={formData.period_id} onValueChange={(val) => handleFormChange('period_id', val)}>
                              <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                              <SelectContent>
                                {periods.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.start_time} - {p.end_time})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="course_id">Course</Label>
                            <Select value={formData.course_id} onValueChange={(val) => handleFormChange('course_id', val)}>
                              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                              <SelectContent>
                                {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="teacher_id">Teacher</Label>
                            <Select value={formData.teacher_id} onValueChange={(val) => handleFormChange('teacher_id', val)}>
                              <SelectTrigger><SelectValue placeholder={teachers.length === 0 ? "No teachers available" : "Select teacher"} /></SelectTrigger>
                              <SelectContent>
                                {teachers.length === 0 ? (
                                  <SelectItem disabled value="no-teachers">No teachers available</SelectItem>
                                ) : (
                                  teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="grade">Grade</Label>
                            <Select value={formData.grade} onValueChange={(val) => handleFormChange('grade', val)}>
                              <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                              <SelectContent>
                                {gradeLevels.map(grade => (
                                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="class_section">Section (Stream)</Label>
                            <Input
                              id="class_section"
                              value={formData.class_section}
                              onChange={(e) => handleFormChange('class_section', e.target.value)}
                              placeholder="e.g., North, West, A, B"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="classroom">Room</Label>
                            <Input
                              id="classroom"
                              value={formData.classroom}
                              onChange={(e) => handleFormChange('classroom', e.target.value)}
                              placeholder="e.g., Room 101"
                            />
                          </div>
                          {renderFormError(formError)}
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Entry
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isAddPeriodDialogOpen} onOpenChange={(open) => { setIsAddPeriodDialogOpen(open); setPeriodFormData({ period_name: '', start_time: '', end_time: '', is_break: false }); setFormError(null); }}>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-1 bg-white border border-slate-300 text-slate-600 px-3 sm:px-4 py-2 rounded-md text-sm hover:border-slate-400 transition-colors flex-1 sm:flex-none justify-center">
                        <span>Add Period</span>
                        <ChevronDown size={14} className="hidden sm:inline" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleAddPeriodSubmit}>
                        <DialogHeader>
                          <DialogTitle>Add Time Period</DialogTitle>
                        <DialogDescription>
                          Define a new time period for the school schedule
                        </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="period_name">Period Name</Label>
                            <Input
                              id="period_name"
                              value={periodFormData.period_name}
                              onChange={(e) => handlePeriodFormChange('period_name', e.target.value)}
                              placeholder="e.g., Period 1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="start_time">Start Time</Label>
                            <Input
                              id="start_time"
                              type="time"
                              value={periodFormData.start_time}
                              onChange={(e) => handlePeriodFormChange('start_time', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="end_time">End Time</Label>
                            <Input
                              id="end_time"
                              type="time"
                              value={periodFormData.end_time}
                              onChange={(e) => handlePeriodFormChange('end_time', e.target.value)}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="is_break"
                              checked={periodFormData.is_break}
                              onChange={(e) => handlePeriodFormChange('is_break', e.target.checked)}
                            />
                            <Label htmlFor="is_break">Is Break Period</Label>
                          </div>
                          {formError && (
                            <div className="text-red-600 text-sm">{formError}</div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddPeriodDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Period
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
            <>
              <div className="md:hidden mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Day</label>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className=", m md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] lg:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] bg-slate-800 text-white font-semibold text-xs lg:text-sm uppercase text-center sticky top-0">
                  <div className="p-2 lg:p-4 border-r border-slate-700"></div>
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                    <div key={day} className="p-2 lg:p-4 border-r border-slate-700 last:border-r-0">
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                  ))}
                </div>

                <div className="flex-1 relative overflow-y-auto">
                  <div 
                    className="absolute inset-0 grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] lg:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr]"
                    style={{ 
                      gridTemplateRows: `repeat(${Math.max(periods.length, 1)}, minmax(100px, 120px))` 
                    }}
                  >
                    <div className="border-r border-slate-200 bg-slate-50 flex flex-col text-xs text-slate-400 font-medium text-right pr-2 lg:pr-3 pt-2">
                      {periods.map((p) => (
                        <div key={p.id} className="h-[100px] lg:h-[120px] flex flex-col justify-start">
                          <span className="text-xs">{p.start_time.substring(0, 5)}</span>
                        </div>
                      ))}
                    </div>
                    {[...Array(periods.length * 5)].map((_, idx) => (
                      <div key={idx} className="border-r border-b border-slate-100 opacity-50" />
                    ))}
                  </div>

                  <div 
                    className="absolute inset-0 grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] lg:grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] pointer-events-none"
                    style={{ 
                      gridTemplateRows: `repeat(${Math.max(periods.length, 1)}, minmax(100px, 120px))` 
                    }}
                  >
                    {timetableData.map((entry, idx) => {
                      const dayLower = (entry.day_of_week || '').trim().toLowerCase();
                      const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].indexOf(dayLower);
                      const periodIndex = periods.findIndex(p => String(p.id) === String(entry.period_id));
                      const color = getColorForCourse(idx) as keyof typeof colorStyles
                      
                      if (dayIndex < 0 || periodIndex < 0) return null

                      return (
                        <div
                          key={entry.id}
                          className="p-1 lg:p-2 pointer-events-auto"
                          style={{
                            gridColumn: dayIndex + 2,
                            gridRow: periodIndex + 1
                          }}
                        >
                          <ClassCardWithActions
                            entry={entry}
                            colorStyle={colorStyles[color]}
                            labelColorStyle={labelColorStyles[color]}
                            canManage={canManage}
                            onEdit={() => handleOpenEditDialog(entry)}
                            onDelete={() => handleDelete(entry.id)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="md:hidden space-y-3">
                {periods.map((period) => {
                  const dayEntries = timetableData.filter(e => {
                    const dayLower = (e.day_of_week || '').trim().toLowerCase();
                    return dayLower === selectedDay.toLowerCase() && String(e.period_id) === String(period.id);
                  });
                  return (
                    <div key={period.id} className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4">
                      <div className="font-semibold text-sm text-slate-700 mb-2">
                        {period.name} ({period.start_time} - {period.end_time})
                      </div>
                      {dayEntries.length === 0 ? (
                        <p className="text-xs sm:text-sm text-slate-500">No classes scheduled</p>
                      ) : (
                        <div className="space-y-2">
                          {dayEntries.map((entry, idx) => {
                            const color = getColorForCourse(idx) as keyof typeof colorStyles
                            return (
                              <div key={entry.id} className={`rounded-md p-3 text-sm ${colorStyles[color]}`}>
                                <div className="font-semibold mb-1">
                                  {entry.course_name}
                                  {entry.class_section && <span className="ml-2 text-[10px] opacity-70">({entry.class_section})</span>}
                                </div>
                                <div className={`text-xs space-y-1 ${labelColorStyles[color]}`}>
                                  <div className="flex items-center gap-1">
                                    <User size={12} /> {entry.teacher_name || 'N/A'}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MapPin size={12} /> Room: {entry.classroom}
                                  </div>
                                </div>
                                {canManage && (
                                  <div className="flex gap-1 mt-2">
                                    <button
                                      onClick={() => handleOpenEditDialog(entry)}
                                      className="flex-1 text-xs bg-white/50 hover:bg-white px-2 py-1 rounded transition-colors"
                                    >
                                      <Edit size={12} className="inline mr-1" /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(entry.id)}
                                      className="flex-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors"
                                    >
                                      <Trash2 size={12} className="inline mr-1" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {canManage && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); setFormData(EMPTY_FORM); setFormError(null); }}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Timetable Entry</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_day_of_week">Day of Week</Label>
                  <Select value={formData.day_of_week} onValueChange={(val) => handleFormChange('day_of_week', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(day => <SelectItem key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_period_id">Time Period</Label>
                  <Select value={formData.period_id} onValueChange={(val) => handleFormChange('period_id', val)}>
                    <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>
                      {periods.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.start_time} - {p.end_time})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_course_id">Course</Label>
                  <Select value={formData.course_id} onValueChange={(val) => handleFormChange('course_id', val)}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_teacher_id">Teacher</Label>
                  <Select value={formData.teacher_id} onValueChange={(val) => handleFormChange('teacher_id', val)}>
                    <SelectTrigger><SelectValue placeholder={teachers.length === 0 ? "No teachers available" : "Select teacher"} /></SelectTrigger>
                    <SelectContent>
                      {teachers.length === 0 ? (
                        <SelectItem disabled value="no-teachers">No teachers available</SelectItem>
                      ) : (
                        teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_grade">Grade</Label>
                  <Select value={formData.grade} onValueChange={(val) => handleFormChange('grade', val)}>
                    <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map(grade => (
                        <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_class_section">Section (Stream)</Label>
                  <Input
                    id="edit_class_section"
                    value={formData.class_section}
                    onChange={(e) => handleFormChange('class_section', e.target.value)}
                    placeholder="e.g., North, West, A, B"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_room">Room</Label>
                  <Input
                    id="edit_room"
                    value={formData.classroom}
                    onChange={(e) => handleFormChange('classroom', e.target.value)}
                    placeholder="e.g., Room 101"
                  />
                </div>
                {renderFormError(formError)}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Entry
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface ClassCardWithActionsProps {
  entry: TimetableEntry
  colorStyle: string
  labelColorStyle: string
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

function ClassCardWithActions({ entry, colorStyle, labelColorStyle, canManage, onEdit, onDelete }: ClassCardWithActionsProps) {
  const [showDelete, setShowDelete] = React.useState(false)

  return (
    <div className={`h-full w-full rounded-r-md border-l-[6px] p-2 lg:p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between relative group ${colorStyle}`}>
      <div className="absolute top-1 lg:top-2 right-1 lg:right-2 opacity-0 group-hover:opacity-50">
        <div className="bg-white/40 p-1 rounded-full">
          <MoreHorizontal size={12} className="lg:hidden" />
          <MoreHorizontal size={14} className="hidden lg:block" />
        </div>
      </div>

      <div>
        <h3 className="font-bold text-xs lg:text-sm leading-tight mb-1 line-clamp-2">{entry.course_name}</h3>
      </div>

      <div className={`text-xs space-y-0.5 lg:space-y-1 ${labelColorStyle} font-medium opacity-90`}>
        {entry.class_section && (
          <div className="font-bold text-[10px] uppercase mb-1">Section: {entry.class_section}</div>
        )}
        <div className="flex items-center gap-0.5 lg:gap-1 truncate">
          <User size={10} className="flex-shrink-0 lg:w-3 lg:h-3" /> <span className="truncate text-xs">{entry.teacher_name || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-0.5 lg:gap-1 truncate">
          <MapPin size={10} className="flex-shrink-0 lg:w-3 lg:h-3" /> <span className="truncate text-xs">Rm: {entry.classroom}</span>
        </div>
      </div>

      {canManage && (
        <div className="absolute inset-0 bg-black/0 hover:bg-black/5 rounded-r-md opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1 bg-white rounded-full shadow hover:shadow-md"
          >
            <Edit size={14} className="text-slate-600" />
          </button>
          <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                className="p-1 bg-white rounded-full shadow hover:shadow-md"
              >
                <Trash2 size={14} className="text-red-600" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this timetable entry? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete()} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
