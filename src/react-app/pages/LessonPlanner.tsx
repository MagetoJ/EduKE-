import { useEffect, useState } from 'react'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  FileText, 
  MoreVertical, 
  CheckCircle2, 
  Circle, 
  Printer, 
  Copy, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  Paperclip,
  ListChecks
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useApi } from '../contexts/AuthContext'

type LessonPlan = {
  id: string;
  title: string;
  course_id: string;
  course_name: string;
  date: string;
  duration_minutes: number;
  status: 'draft' | 'ready' | 'completed';
  objectives: string;
  materials: string;
  procedure: string;
  assessment: string;
}

type Course = {
  id: string;
  name: string;
  code: string;
  grade: string;
}

const MOCK_LESSONS: LessonPlan[] = [
  {
    id: '1',
    title: 'Introduction to Photosynthesis',
    course_id: 'c1',
    course_name: 'Biology 101',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: 60,
    status: 'ready',
    objectives: '- Understand the chemical equation of photosynthesis\n- Identify key parts of the chloroplast',
    materials: 'Textbook p. 45, Projector, Leaf samples',
    procedure: '1. Bell ringer (5 min)\n2. Lecture on light reactions (20 min)\n3. Group lab activity (30 min)\n4. Exit ticket (5 min)',
    assessment: 'Exit ticket questions'
  }
]

export default function LessonPlanner() {
  const api = useApi()
  
  const [lessons, setLessons] = useState<LessonPlan[]>(MOCK_LESSONS)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedDate] = useState(new Date())
  
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Partial<LessonPlan>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await api('/api/courses')
        if (res.ok) {
          const data = await res.json()
          setCourses(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch courses", error)
      }
    }
    fetchCourses()
  }, [api])

  const handleNewPlan = () => {
    setEditingLesson({
      date: new Date().toISOString().split('T')[0],
      status: 'draft',
      duration_minutes: 60,
      objectives: '',
      procedure: '',
      materials: '',
      assessment: ''
    })
    setIsEditorOpen(true)
  }

  const handleEditPlan = (plan: LessonPlan) => {
    setEditingLesson({ ...plan })
    setIsEditorOpen(true)
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (editingLesson.id) {
      setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, ...editingLesson } as LessonPlan : l))
    } else {
      const newPlan = {
        ...editingLesson,
        id: Math.random().toString(36).substr(2, 9),
        course_name: courses.find(c => c.id === editingLesson.course_id)?.name || 'Unknown Course'
      } as LessonPlan
      setLessons(prev => [...prev, newPlan])
    }
    
    setIsEditorOpen(false)
    setIsSubmitting(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this lesson plan?')) {
      setLessons(prev => prev.filter(l => l.id !== id))
    }
  }

  const handleStatusToggle = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'ready' : 'completed'
    setLessons(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-slate-100 text-slate-500 border-slate-200 decoration-slate-400'
      case 'ready': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'draft': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-white'
    }
  }

  const sortedLessons = [...lessons].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="flex flex-col h-full space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Lesson Planner</h2>
          <p className="text-slate-500 mt-1">Organize your curriculum and daily activities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <Button variant="ghost" size="sm" className="bg-white shadow-sm"><CalendarIcon className="w-4 h-4 mr-2" /> Weekly</Button>
            <Button variant="ghost" size="sm" className="text-slate-500">Monthly</Button>
          </div>
          <Button onClick={handleNewPlan} className="bg-teal-500 hover:bg-teal-600 gap-2">
            <Plus className="w-4 h-4" /> Create Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        
        <div className="hidden lg:block lg:col-span-1 space-y-6">
           <Card className="border-slate-200">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold uppercase text-slate-500">Upcoming Classes</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               {courses.slice(0, 4).map(course => (
                 <div key={course.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded cursor-pointer">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                     <span className="text-sm font-medium text-slate-700">{course.name}</span>
                   </div>
                   <span className="text-xs text-slate-400">{course.code}</span>
                 </div>
               ))}
             </CardContent>
           </Card>

           <div className="bg-teal-50 rounded-xl p-6 border border-teal-100">
              <h3 className="font-bold text-teal-900 mb-2">Teaching Tip</h3>
              <p className="text-sm text-teal-700 leading-relaxed">
                Remember to differentiate instruction for your lessons. Try using visual aids and varied teaching strategies.
              </p>
           </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              Week of {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedLessons.map((plan) => (
              <Card key={plan.id} className={`group transition-all duration-200 hover:shadow-md border-l-4 border-slate-200 ${plan.course_name.includes('Math') ? 'border-l-blue-500' : 'border-l-teal-500'}`}>
                <CardContent className="p-5">
                  
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600">
                      {plan.course_name}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditPlan(plan)}><FileText className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem><Printer className="w-4 h-4 mr-2" /> Print</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(plan.id)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div onClick={() => handleEditPlan(plan)} className="cursor-pointer">
                    <h4 className={`font-bold text-lg leading-tight mb-1 ${plan.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {plan.title}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(plan.date).toLocaleDateString()}
                      <span className="text-slate-300">|</span>
                      <Clock className="w-3 h-3" />
                      {plan.duration_minutes} min
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                    <div className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${getStatusColor(plan.status)}`}>
                      {plan.status}
                    </div>
                    <button 
                      onClick={() => handleStatusToggle(plan.id, plan.status)}
                      className="text-slate-400 hover:text-teal-600 transition-colors"
                      title="Mark as taught"
                    >
                      {plan.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-teal-500" /> : <Circle className="w-5 h-5" />}
                    </button>
                  </div>

                </CardContent>
              </Card>
            ))}

            <button 
              onClick={handleNewPlan}
              className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-500 transition-all min-h-[200px]"
            >
              <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium">Plan New Lesson</span>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden z-[100]">
          
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <DialogTitle>Lesson Plan Editor</DialogTitle>
              <DialogDescription>Drafting lesson details</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSubmitting} className="gap-2 bg-teal-500 hover:bg-teal-600">
                <Save className="w-4 h-4" /> {isSubmitting ? 'Saving...' : 'Save Plan'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-1 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Lesson Title</label>
                  <Input 
                    placeholder="e.g., Intro to Algebra" 
                    value={editingLesson.title || ''} 
                    onChange={e => setEditingLesson({...editingLesson, title: e.target.value})} 
                    className="font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Course / Subject</label>
                  <Select 
                    value={editingLesson.course_id} 
                    onValueChange={v => setEditingLesson({...editingLesson, course_id: v})}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                    <SelectContent className="z-[101]">
                      {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date</label>
                  <Input 
                    type="date" 
                    value={editingLesson.date || ''} 
                    onChange={e => setEditingLesson({...editingLesson, date: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Duration (min)</label>
                  <Input 
                    type="number" 
                    value={editingLesson.duration_minutes || ''} 
                    onChange={e => setEditingLesson({...editingLesson, duration_minutes: parseInt(e.target.value)})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <Select 
                    value={editingLesson.status} 
                    onValueChange={(v: string) => setEditingLesson({...editingLesson, status: v as 'draft' | 'ready' | 'completed'})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[101]">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="ready">Ready to Teach</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-slate-100">
                    <TabsTrigger value="content">Content & Objectives</TabsTrigger>
                    <TabsTrigger value="procedure">Procedure</TabsTrigger>
                    <TabsTrigger value="resources">Materials & Assessment</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-teal-600">
                        <ListChecks className="w-4 h-4" /> Learning Objectives
                      </label>
                      <Textarea 
                        placeholder="- What will students be able to do?&#10;- Key concepts..." 
                        className="min-h-[200px] font-normal"
                        value={editingLesson.objectives || ''}
                        onChange={e => setEditingLesson({...editingLesson, objectives: e.target.value})}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="procedure" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-teal-600">
                        <Clock className="w-4 h-4" /> Step-by-Step Procedure
                      </label>
                      <Textarea 
                        placeholder="1. Introduction (5 min): ...&#10;2. Main Activity (20 min): ...&#10;3. Conclusion (5 min): ..." 
                        className="min-h-[300px] font-mono text-sm leading-relaxed"
                        value={editingLesson.procedure || ''}
                        onChange={e => setEditingLesson({...editingLesson, procedure: e.target.value})}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="resources" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-teal-600">
                        <Paperclip className="w-4 h-4" /> Materials Needed
                      </label>
                      <Input 
                        placeholder="Textbooks, Handouts, Projector, etc."
                        value={editingLesson.materials || ''}
                        onChange={e => setEditingLesson({...editingLesson, materials: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-teal-600">
                        <CheckCircle2 className="w-4 h-4" /> Assessment / Homework
                      </label>
                      <Textarea 
                        placeholder="How will you check for understanding?"
                        className="min-h-[150px]"
                        value={editingLesson.assessment || ''}
                        onChange={e => setEditingLesson({...editingLesson, assessment: e.target.value})}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

              </div>
            </div>
          </div>

        </DialogContent>
      </Dialog>

    </div>
  )
}
