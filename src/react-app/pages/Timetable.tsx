import React, { useState, useEffect, useRef } from 'react'
import {
  Plus, Edit, Trash2, Loader2, AlertCircle, User, MapPin,
  Printer, Download, BookOpen, Clock
} from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '../components/ui/select'
import { useAuth, useApi } from '../contexts/AuthContext'
import { Input } from '../components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog'

// ─────────────────────────── Types ───────────────────────────────



type TimetableEntry = {
  id: string
  day_of_week: string
  grade: string
  class_section?: string
  classroom: string
  course_name: string     // Changed from subject_name
  teacher_name: string
  period_name: string
  start_time: string
  end_time: string
  is_break: boolean
  course_id: string       // Changed from subject_id
  teacher_id: string
  period_id: string
  is_accessible_track?: boolean
  accommodation_type?: string
}

type Course  = { id: string; name: string } // Changed from type Subject
type Teacher = { id: string; name: string }
type TimePeriod = {
  id: string
  name: string
  start_time: string
  end_time: string
  is_break: boolean
}

type FormData = {
  id?: string
  course_id: string       // Changed from subject_id
  teacher_id: string
  period_id: string
  day_of_week: string
  grade: string
  class_section: string
  classroom: string
  is_accessible_track: boolean
  accommodation_type: string
}

type PeriodFormData = {
  period_name: string
  start_time: string
  end_time: string
  is_break: boolean
}

// ─────────────────────────── Constants ───────────────────────────

const EMPTY_FORM: FormData = {
  course_id: '', teacher_id: '', period_id: '',
  day_of_week: 'monday', grade: '', class_section: '',
  classroom: '', is_accessible_track: false, accommodation_type: 'none'
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const ALL_DAYS = [...DAYS, 'saturday', 'sunday']

const CURRICULUM_LEVELS: Record<string, string[]> = {
  cbc:      ['PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'],
  '844':    ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Form 1','Form 2','Form 3','Form 4'],
  british:  ['Year 1','Year 2','Year 3','Year 4','Year 5','Year 6','Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'],
  american: ['Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'],
  ib:       ['PYP 1','PYP 2','PYP 3','PYP 4','PYP 5','MYP 1','MYP 2','MYP 3','MYP 4','MYP 5','DP 1','DP 2'],
}

const COLORS = ['sky', 'orange', 'green', 'purple', 'rose'] as const
type Color = typeof COLORS[number]

const COLOR_CELL: Record<Color, string> = {
  sky:    'bg-sky-100 border-l-sky-500 text-sky-900',
  orange: 'bg-orange-100 border-l-orange-500 text-orange-900',
  green:  'bg-green-100 border-l-green-500 text-green-900',
  purple: 'bg-purple-100 border-l-purple-500 text-purple-900',
  rose:   'bg-rose-100 border-l-rose-500 text-rose-900',
}

const COLOR_TEXT: Record<Color, string> = {
  sky:    'text-sky-700',
  orange: 'text-orange-700',
  green:  'text-green-700',
  purple: 'text-purple-700',
  rose:   'text-rose-700',
}

// Map course id → stable color so color doesn't shift on re-render
const courseColorMap = new Map<string, Color>()
function colorForCourse(courseId: string): Color {
  if (!courseColorMap.has(courseId)) {
    courseColorMap.set(courseId, COLORS[courseColorMap.size % COLORS.length])
  }
  return courseColorMap.get(courseId)!
}

// Ensure database returns of HH:MM:SS are matched correctly against standard HH:MM grids
function normalizeTime(t: string | undefined | null) {
  if (!t) return ''
  const parts = t.split(':')
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  return t
}

// ─────────────────────────── Component ───────────────────────────

export default function Timetable() {
  const { user } = useAuth() as any
  const api = useApi()
  const printRef = useRef<HTMLDivElement>(null)

  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([])
  const [courses,  setCourses]  = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [periods,  setPeriods]  = useState<TimePeriod[]>([])

  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isAddDialogOpen,    setIsAddDialogOpen]    = useState(false)
  const [isEditDialogOpen,   setIsEditDialogOpen]   = useState(false)
  const [isPeriodDialogOpen, setIsPeriodDialogOpen] = useState(false)

  const [formData,       setFormData]       = useState<FormData>(EMPTY_FORM)
  const [periodFormData, setPeriodFormData] = useState<PeriodFormData>({ period_name: '', start_time: '', end_time: '', is_break: false })

  const [selectedDay,     setSelectedDay]     = useState('monday')
  const [selectedGrade,   setSelectedGrade]   = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [gradeLevels,     setGradeLevels]     = useState<string[]>([])

  // Derive role helpers
  const canManage = ['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod'].includes(user?.role)

  const headerTitle = user?.role === 'student' ? 'MY CLASS SCHEDULE'
    : user?.role === 'parent' ? "CHILDREN'S SCHEDULE"
    : 'ACADEMIC TIMETABLE'

  // ── Curriculum levels ────────────────────────────────────────
  useEffect(() => {
    const key = user?.schoolCurriculum ?? 'cbc'
    setGradeLevels(CURRICULUM_LEVELS[key] ?? CURRICULUM_LEVELS.cbc)
  }, [user?.schoolCurriculum])

  // ── Data load ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setError('Please log in'); setIsLoading(false); return }

    const load = async () => {
      setIsLoading(true); setError(null)
      try {
        const params: string[] = []
        if (selectedGrade && selectedGrade !== 'all-grades') params.push(`grade=${encodeURIComponent(selectedGrade)}`)
        if (selectedSection) params.push(`class_section=${encodeURIComponent(selectedSection)}`)
        const qs = params.length ? `?${params.join('&')}` : ''

        const [tableRes, courseRes, periodRes] = await Promise.all([
          api(`/api/timetable${qs}`),
          api('/api/courses'),
          api('/api/timetable/periods'),
        ])

        if (!tableRes.ok)  throw new Error((await tableRes.json().catch(() => ({}))).error  || 'Failed to fetch timetable')
        if (!courseRes.ok) throw new Error((await courseRes.json().catch(() => ({}))).error || 'Failed to fetch courses')
        if (!periodRes.ok) throw new Error((await periodRes.json().catch(() => ({}))).error || 'Failed to fetch periods')

        const tableData  = await tableRes.json()
        const courseData = await courseRes.json()
        const periodData = await periodRes.json()

        let teacherData = { data: [] }
        try {
          const tr = await api('/api/staff') 
          if (tr.ok) teacherData = await tr.json()
        } catch { /* teachers optional */ }

        const normalize = (e: TimetableEntry) => ({
          ...e,
          id: String(e.id), course_id: String(e.course_id),
          teacher_id: String(e.teacher_id), period_id: String(e.period_id),
          day_of_week: (e.day_of_week || '').trim().toLowerCase(),
          start_time: normalizeTime(e.start_time),
          end_time: normalizeTime(e.end_time),
          is_accessible_track: !!e.is_accessible_track,
          accommodation_type: e.accommodation_type || 'none',
        })

        const tableArray = Array.isArray(tableData) ? tableData : (tableData.data || [])
        setTimetableData(tableArray.map(normalize))
        
        const coursesArray = Array.isArray(courseData) ? courseData : (courseData.data || [])
        setCourses(coursesArray.map((c: Course) => ({ ...c, id: String(c.id) })))
        
        setTeachers((teacherData.data || []).map((t: Teacher) => ({ ...t, id: String(t.id) })))
        
        const periodsArray = Array.isArray(periodData) ? periodData : (periodData.data || [])
        setPeriods(periodsArray.map((p: TimePeriod) => ({ 
          ...p, 
          id: String(p.id),
          start_time: normalizeTime(p.start_time),
          end_time: normalizeTime(p.end_time) 
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [api, user, selectedGrade, selectedSection])

  // ── Form helpers ─────────────────────────────────────────────
  const handleFormChange = (field: keyof FormData, value: string | boolean) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  const handlePeriodChange = (field: keyof PeriodFormData, value: string | boolean) =>
    setPeriodFormData(prev => ({ ...prev, [field]: value }))

  const validateMainForm = (): string | null => {
    if (!formData.course_id)  return 'Please select a course'
    if (!formData.teacher_id) return 'Please select a teacher'
    if (!formData.period_id)  return 'Please select a time period'
    if (!formData.day_of_week)return 'Please select a day'
    if (!formData.grade)      return 'Please select a grade'
    return null
  }

  // ── CRUD operations ──────────────────────────────────────────
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateMainForm()
    if (err) { setFormError(err); return }
    setIsSubmitting(true); setFormError(null)
    
    try {
      const course  = courses.find(c => String(c.id) === String(formData.course_id))
      const period  = periods.find(p => String(p.id) === String(formData.period_id))
      const teacher = teachers.find(t => String(t.id) === String(formData.teacher_id))

      const payload = {
        course_id: parseInt(formData.course_id),
        teacher_id: formData.teacher_id && formData.teacher_id !== '__none' ? parseInt(formData.teacher_id) : null,
        day_of_week: formData.day_of_week,
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
        room: formData.classroom,
        grade_level: formData.grade
      }

      const res  = await api('/api/timetable', { method: 'POST', body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to create entry')

      setTimetableData(prev => [{
        id: String(data.data.id),
        course_id: formData.course_id,
        teacher_id: formData.teacher_id,
        period_id: formData.period_id,
        course_name: course?.name || 'Unknown',
        teacher_name: teacher?.name || 'N/A',
        period_name: period?.name || '',
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
        day_of_week: formData.day_of_week,
        grade: formData.grade,
        classroom: formData.classroom,
        class_section: formData.class_section,
        is_accessible_track: formData.is_accessible_track,
        accommodation_type: formData.accommodation_type,
        is_break: false
      }, ...prev])

      setIsAddDialogOpen(false)
      setFormData(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id) { setFormError('No ID – cannot update.'); return }
    const err = validateMainForm()
    if (err) { setFormError(err); return }
    setIsSubmitting(true); setFormError(null)
    
    try {
      const course  = courses.find(c => String(c.id) === String(formData.course_id))
      const period  = periods.find(p => String(p.id) === String(formData.period_id))
      const teacher = teachers.find(t => String(t.id) === String(formData.teacher_id))

      const payload = {
        course_id: parseInt(formData.course_id),
        teacher_id: formData.teacher_id && formData.teacher_id !== '__none' ? parseInt(formData.teacher_id) : null,
        day_of_week: formData.day_of_week,
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
        room: formData.classroom,
        grade_level: formData.grade
      }

      const res  = await api(`/api/timetable/${formData.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to update entry')

      const updated: TimetableEntry = {
        id: String(formData.id),
        course_id: formData.course_id,
        teacher_id: formData.teacher_id,
        period_id: formData.period_id,
        course_name: course?.name || 'Unknown',
        teacher_name: teacher?.name || 'N/A',
        period_name: period?.name || '',
        start_time: period?.start_time || '',
        end_time: period?.end_time || '',
        day_of_week: formData.day_of_week,
        grade: formData.grade,
        classroom: formData.classroom,
        class_section: formData.class_section,
        is_accessible_track: formData.is_accessible_track,
        accommodation_type: formData.accommodation_type,
        is_break: false
      }
      
      setTimetableData(prev => prev.map(item => item.id === updated.id ? updated : item))
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
      const res = await api(`/api/timetable/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setTimetableData(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleAddPeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodFormData.period_name) { setFormError('Period name is required'); return }
    if (!periodFormData.start_time)  { setFormError('Start time is required');  return }
    if (!periodFormData.end_time)    { setFormError('End time is required');     return }
    setIsSubmitting(true); setFormError(null)
    try {
      const res  = await api('/api/timetable/periods', { method: 'POST', body: JSON.stringify(periodFormData) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create period')
      setPeriods(prev => [...prev, { 
        ...data.data, 
        id: String(data.data.id),
        start_time: normalizeTime(data.data.start_time),
        end_time: normalizeTime(data.data.end_time) 
      }])
      setIsPeriodDialogOpen(false)
      setPeriodFormData({ period_name: '', start_time: '', end_time: '', is_break: false })
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
      course_id: entry.course_id, teacher_id: entry.teacher_id,
      period_id: entry.period_id, day_of_week: entry.day_of_week,
      grade: entry.grade, class_section: entry.class_section || '',
      classroom: entry.classroom,
      is_accessible_track: !!entry.is_accessible_track,
      accommodation_type: entry.accommodation_type || 'none',
    })
    setIsEditDialogOpen(true)
  }

  // ── Print / Download ──────────────────────────────────────────
  const handlePrint = () => {
    window.print()
  }

  const handleDownloadHTML = () => {
    const schoolName = user?.schoolName || 'School'
    const gradeLabel = selectedGrade && selectedGrade !== 'all-grades' ? ` — ${selectedGrade}` : ''
    const title = `${schoolName} Timetable${gradeLabel}`

    const rows = periods.map(period => {
      const cells = DAYS.map(day => {
        const entries = timetableData.filter(e =>
          e.day_of_week === day && e.start_time === period.start_time && e.end_time === period.end_time
        )
        if (period.is_break) return `<td style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:center;color:#888;font-style:italic;">Break</td>`
        if (entries.length === 0) return '<td style="border:1px solid #ddd;padding:8px;"></td>'

        const entryHtml = entries.map(entry => `
          <div style="margin-bottom: ${entries.length > 1 ? '8px' : '0'}">
            <strong>${entry.course_name}</strong> ${entry.class_section ? `<span style="color:#666;font-size:10px;">§ ${entry.class_section}</span>` : ''}<br/>
            <span style="color:#666;font-size:12px;">${entry.teacher_name}</span><br/>
            <span style="color:#999;font-size:11px;">Rm: ${entry.classroom || '—'}</span>
          </div>
        `).join('')

        return `<td style="border:1px solid #ddd;padding:8px;vertical-align:top;">${entryHtml}</td>`
      }).join('')

      return `<tr>
        <td style="border:1px solid #ddd;padding:8px;white-space:nowrap;font-weight:600;color:#444;">
          ${period.name}<br/><span style="font-size:11px;color:#999;">${period.start_time}–${period.end_time}</span>
        </td>
        ${cells}
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
    h1   { font-size: 20px; margin-bottom: 4px; }
    p    { color: #666; font-size: 13px; margin-top: 0; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th   { background: #1e293b; color: #fff; padding: 10px 8px; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated on ${new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}</p>
  <table>
    <thead>
      <tr>
        <th>Period</th>
        ${DAYS.map(d => `<th>${d.charAt(0).toUpperCase() + d.slice(1)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `timetable-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render helpers ────────────────────────────────────────────
  const renderError = (msg: string | null) => msg && (
    <div className="flex items-center gap-2 text-sm text-red-600 p-3 bg-red-50 rounded-md mb-4">
      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {msg}
    </div>
  )

  const renderFormError = (msg: string | null) => msg && (
    <div className="flex items-center gap-2 text-sm text-red-600 mt-1">
      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {msg}
    </div>
  )

  // ── Shared entry form fields (used by both Add and Edit dialogs) ─
  const EntryFormFields = () => (
    <div className="space-y-3">
      {/* Day + Period side-by-side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Day</Label>
          <Select value={formData.day_of_week} onValueChange={v => handleFormChange('day_of_week', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_DAYS.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Time Period</Label>
          <Select value={formData.period_id} onValueChange={v => handleFormChange('period_id', v)}>
            <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
            <SelectContent>
              {periods.filter(p => !p.is_break).map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name} ({p.start_time}–{p.end_time})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Course */}
      <div className="space-y-1">
        <Label>Course / Subject</Label>
        <Select value={formData.course_id} onValueChange={v => handleFormChange('course_id', v)}>
          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>
            {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Teacher */}
      <div className="space-y-1">
        <Label>Teacher</Label>
        <Select value={formData.teacher_id} onValueChange={v => handleFormChange('teacher_id', v)}>
          <SelectTrigger>
            <SelectValue placeholder={teachers.length === 0 ? 'No teachers available' : 'Select teacher'} />
          </SelectTrigger>
          <SelectContent>
            {teachers.length === 0
              ? <SelectItem disabled value="__none">No teachers available</SelectItem>
              : teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)
            }
          </SelectContent>
        </Select>
      </div>

      {/* Grade + Section */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Grade</Label>
          <Select value={formData.grade} onValueChange={v => handleFormChange('grade', v)}>
            <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
            <SelectContent>
              {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Section / Stream</Label>
          <Input
            value={formData.class_section}
            onChange={e => handleFormChange('class_section', e.target.value)}
            placeholder="e.g., A, B, North"
          />
        </div>
      </div>

      {/* Classroom */}
      <div className="space-y-1">
        <Label>Room</Label>
        <Input
          value={formData.classroom}
          onChange={e => handleFormChange('classroom', e.target.value)}
          placeholder="e.g., Room 101"
        />
      </div>

      {/* Special needs */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold cursor-pointer" htmlFor="accessible_track">
            Special Education / Adaptive Session
          </Label>
          <input
            id="accessible_track"
            type="checkbox"
            className="h-4 w-4 accent-emerald-600 cursor-pointer"
            checked={formData.is_accessible_track}
            onChange={e => handleFormChange('is_accessible_track', e.target.checked)}
          />
        </div>

        {formData.is_accessible_track && (
          <div className="space-y-1">
            <Label className="text-xs">Accommodation Type</Label>
            <Select
              value={formData.accommodation_type}
              onValueChange={v => handleFormChange('accommodation_type', v)}
            >
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="Select accommodation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hearing_ksl">Kenyan Sign Language (KSL)</SelectItem>
                <SelectItem value="visual_braille">Braille / Voice Reader</SelectItem>
                <SelectItem value="mobility_switch">Mobility / Switch Scanning</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {renderFormError(formError)}
    </div>
  )

  // ── Main render ───────────────────────────────────────────────
  return (
    <>
      {/* Print-only stylesheet injected in head */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { background: white; }
        }
        .print-area { display: none; }
      `}</style>

      <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="bg-slate-800 text-white px-4 sm:px-8 py-3 flex items-center justify-between no-print">
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-wide">{headerTitle}</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {user?.schoolName || 'School'} · {new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5"
            >
              <Printer size={15} /> <span className="hidden sm:inline">Print</span>
            </Button>
            {/* Download */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadHTML}
              className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5"
            >
              <Download size={15} /> <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 no-print">
          {/* ── Toolbar ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {/* Grade filter (admin/manager) */}
            {canManage && (
              <div className="w-40">
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="bg-white border-slate-200 h-9 text-sm">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-grades">All Grades</SelectItem>
                    {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Section filter */}
            {canManage && (
              <Input
                className="w-32 h-9 text-sm bg-white"
                placeholder="Section"
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              />
            )}

            <div className="flex-1" />

            {/* Add Entry */}
            {canManage && (
              <>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={open => { setIsAddDialogOpen(open); if (!open) { setFormData(EMPTY_FORM); setFormError(null) } }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus size={15} /> Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleAddSubmit}>
                      <DialogHeader>
                        <DialogTitle>Add Timetable Entry</DialogTitle>
                        <DialogDescription>Schedule a class session</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <EntryFormFields />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Add Entry
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Add Period */}
                <Dialog
                  open={isPeriodDialogOpen}
                  onOpenChange={open => { setIsPeriodDialogOpen(open); if (!open) { setPeriodFormData({ period_name: '', start_time: '', end_time: '', is_break: false }); setFormError(null) } }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Clock size={15} /> Add Period
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <form onSubmit={handleAddPeriodSubmit}>
                      <DialogHeader>
                        <DialogTitle>Add Time Period</DialogTitle>
                        <DialogDescription>Define a new period in the school day</DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-3">
                        <div className="space-y-1">
                          <Label>Period Name</Label>
                          <Input value={periodFormData.period_name} onChange={e => handlePeriodChange('period_name', e.target.value)} placeholder="e.g., Period 3" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Start Time</Label>
                            <Input type="time" value={periodFormData.start_time} onChange={e => handlePeriodChange('start_time', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>End Time</Label>
                            <Input type="time" value={periodFormData.end_time} onChange={e => handlePeriodChange('end_time', e.target.value)} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-slate-700"
                            checked={periodFormData.is_break}
                            onChange={e => handlePeriodChange('is_break', e.target.checked)}
                          />
                          Mark as break / recess
                        </label>
                        {renderFormError(formError)}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsPeriodDialogOpen(false)}>Cancel</Button>
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

          {renderError(error)}

          {isLoading ? (
            <div className="flex items-center justify-center p-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading timetable…
            </div>
          ) : (
            <>
              {/* ── Desktop grid ──────────────────────────────── */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" ref={printRef}>
                {/* Day headers */}
                <div className="grid bg-slate-800 text-white text-xs font-semibold uppercase text-center"
                  style={{ gridTemplateColumns: '90px repeat(5, 1fr)' }}>
                  <div className="p-3 border-r border-slate-700" />
                  {DAYS.map(d => (
                    <div key={d} className="p-3 border-r border-slate-700 last:border-r-0">
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </div>
                  ))}
                </div>

                {/* Period rows */}
                {periods.map(period => (
                  <div
                    key={period.id}
                    className="grid border-b border-slate-100 last:border-b-0"
                    style={{ gridTemplateColumns: '90px repeat(5, 1fr)', minHeight: '90px' }}
                  >
                    {/* Period label */}
                    <div className={`border-r border-slate-200 flex flex-col justify-center px-2 py-1 ${period.is_break ? 'bg-slate-100' : 'bg-slate-50'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{period.name}</span>
                      <span className="text-[10px] text-slate-400">{period.start_time}</span>
                      <span className="text-[10px] text-slate-400">{period.end_time}</span>
                    </div>

                    {/* Day cells */}
                    {DAYS.map(day => {
                      const entries = timetableData.filter(e =>
                        e.day_of_week === day && e.start_time === period.start_time && e.end_time === period.end_time
                      )
                      
                      if (period.is_break) {
                        return (
                          <div key={day} className="border-r border-slate-100 last:border-r-0 bg-slate-50 flex items-center justify-center">
                            <span className="text-xs text-slate-400 italic">Break</span>
                          </div>
                        )
                      }
                      
                      if (entries.length === 0) {
                        // Empty cell – clicking it pre-fills the form
                        return (
                          <div
                            key={day}
                            className="border-r border-slate-100 last:border-r-0 group relative min-h-[60px] cursor-pointer"
                            onClick={() => {
                              if (!canManage) return
                              setFormData({ ...EMPTY_FORM, day_of_week: day, period_id: String(period.id) })
                              setFormError(null)
                              setIsAddDialogOpen(true)
                            }}
                          >
                            {canManage && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Plus size={12} /> Add class
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      }
                      
                      return (
                        <div key={day} className="border-r border-slate-100 last:border-r-0 p-1.5 space-y-1.5 min-w-0">
                          {entries.map(entry => {
                            const color = colorForCourse(entry.course_id)
                            return (
                              <ClassCard
                                key={entry.id}
                                entry={entry}
                                colorStyle={COLOR_CELL[color]}
                                labelStyle={COLOR_TEXT[color]}
                                canManage={canManage}
                                onEdit={() => handleOpenEditDialog(entry)}
                                onDelete={() => handleDelete(entry.id)}
                              />
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {periods.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No periods defined yet.{canManage ? ' Add a period to get started.' : ''}
                  </div>
                )}
              </div>

              {/* ── Mobile list (one day at a time) ────────────── */}
              <div className="md:hidden">
                <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                  {DAYS.map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedDay === d
                          ? 'bg-slate-800 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1, 3)}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {periods.map(period => {
                    const entries = timetableData.filter(e =>
                      e.day_of_week === selectedDay && e.start_time === period.start_time && e.end_time === period.end_time
                    )
                    return (
                      <div key={period.id} className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                          <Clock size={11} />
                          {period.name} · {period.start_time}–{period.end_time}
                          {period.is_break && <span className="ml-1 italic text-slate-400">(Break)</span>}
                        </div>
                        {entries.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            {period.is_break ? 'Break time' : 'No class scheduled'}
                          </p>
                        ) : (
                          entries.map((entry) => {
                            const color = colorForCourse(entry.course_id)
                            return (
                              <div key={entry.id} className={`rounded-md p-2.5 text-sm ${COLOR_CELL[color]} border-l-4 mb-2 last:mb-0`}>
                                <div className={`font-semibold mb-1 ${COLOR_TEXT[color]}`}>{entry.course_name}</div>
                                <div className={`text-xs space-y-0.5 ${COLOR_TEXT[color]} opacity-80`}>
                                  <div className="flex items-center gap-1"><User size={11} /> {entry.teacher_name || 'N/A'}</div>
                                  <div className="flex items-center gap-1"><MapPin size={11} /> {entry.classroom || '—'}</div>
                                </div>
                                {canManage && (
                                  <div className="flex gap-1 mt-2">
                                    <button onClick={() => handleOpenEditDialog(entry)} className="flex-1 text-xs bg-white/50 hover:bg-white px-2 py-1 rounded">
                                      <Edit size={11} className="inline mr-1" />Edit
                                    </button>
                                    <button onClick={() => handleDelete(entry.id)} className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded">
                                      <Trash2 size={11} className="inline mr-1" />Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </main>

        {/* ── Print-only view (hidden on screen, visible when printing) ── */}
        <div className="print-area p-6">
          <h1 className="text-xl font-bold mb-1">{user?.schoolName || 'School'} — Academic Timetable</h1>
          <p className="text-sm text-gray-500 mb-4">
            {selectedGrade && selectedGrade !== 'all-grades' ? `Grade: ${selectedGrade} · ` : ''}
            Printed {new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#1e293b', color: '#fff', textAlign: 'left' }}>Period</th>
                {DAYS.map(d => (
                  <th key={d} style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#1e293b', color: '#fff', textAlign: 'center' }}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period.id}>
                  <td style={{ border: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                    <strong>{period.name}</strong><br />
                    <span style={{ color: '#888', fontSize: 10 }}>{period.start_time}–{period.end_time}</span>
                  </td>
                  {DAYS.map(day => {
                    const entries = timetableData.filter(e =>
                      e.day_of_week === day && e.start_time === period.start_time && e.end_time === period.end_time
                    )
                    
                    if (period.is_break) return (
                      <td key={day} style={{ border: '1px solid #ddd', padding: '6px 8px', textAlign: 'center', color: '#aaa', fontStyle: 'italic', background: '#f8fafc' }}>Break</td>
                    )
                    if (entries.length === 0) return <td key={day} style={{ border: '1px solid #ddd', padding: '6px 8px' }} />
                    
                    return (
                      <td key={day} style={{ border: '1px solid #ddd', padding: '6px 8px', verticalAlign: 'top' }}>
                        {entries.map(entry => (
                          <div key={entry.id} style={{ marginBottom: entries.length > 1 ? '8px' : '0' }}>
                            <strong>{entry.course_name}</strong>
                            {entry.class_section && <span style={{fontSize: 9, color: '#666', marginLeft: 4}}>§ {entry.class_section}</span>}
                            <br />
                            <span style={{ color: '#555', fontSize: 10 }}>{entry.teacher_name}</span><br />
                            <span style={{ color: '#999', fontSize: 10 }}>Rm: {entry.classroom || '—'}</span>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Edit Dialog ─────────────────────────────────────────── */}
        {canManage && (
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={open => { setIsEditDialogOpen(open); if (!open) { setFormData(EMPTY_FORM); setFormError(null) } }}
          >
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleEditSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Timetable Entry</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <EntryFormFields />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
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
    </>
  )
}

// ─────────────────── ClassCard sub-component ─────────────────────

interface ClassCardProps {
  entry: TimetableEntry
  colorStyle: string
  labelStyle: string
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}

function ClassCard({ entry, colorStyle, labelStyle, canManage, onEdit, onDelete }: ClassCardProps) {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)

  return (
    <div className={`rounded-r-md border-l-4 p-2 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative group ${colorStyle}`}>
      <div>
        <h3 className={`font-bold text-xs leading-tight line-clamp-2 mb-1 ${labelStyle}`}>
          {entry.course_name}
        </h3>
        {entry.class_section && (
          <span className="text-[9px] font-bold uppercase text-slate-500">§ {entry.class_section}</span>
        )}
      </div>
      <div className={`text-[10px] space-y-0.5 ${labelStyle} opacity-80`}>
        <div className="flex items-center gap-0.5 truncate"><User size={9} className="flex-shrink-0" /> {entry.teacher_name || 'N/A'}</div>
        <div className="flex items-center gap-0.5 truncate"><MapPin size={9} className="flex-shrink-0" /> {entry.classroom || '—'}</div>
      </div>

      {canManage && (
        <div className="absolute inset-0 bg-black/0 hover:bg-black/5 rounded-r-md opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 bg-white rounded-full shadow hover:shadow-md"
          >
            <Edit size={12} className="text-slate-600" />
          </button>

          <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
            <AlertDialogTrigger asChild>
              <button
                onClick={e => e.stopPropagation()}
                className="p-1.5 bg-white rounded-full shadow hover:shadow-md"
              >
                <Trash2 size={12} className="text-red-600" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove <strong>{entry.course_name}</strong> from the timetable? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { onDelete(); setShowDeleteAlert(false) }}
                  className="bg-red-600 hover:bg-red-700"
                >
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

