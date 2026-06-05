import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router'
import { Users, Calendar, BookOpen, Clock, FileText, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi, useAuth } from '../contexts/AuthContext'

// --- Types based on API/Schema ---
type Course = {
  id: string;
  name: string;
  code: string;
  teacher_name: string;
  grade: string;
  description: string;
  // 'schedule' is in mock data but not in your 'courses' table or API response.
  // You will need to add this to your schema and API if you want to display it.
}

type Student = {
  id: string;
  name: string; // Assuming 'first_name' + 'last_name'
  status: string;
  progress: string; // Note: 'progress' is not in your 'students' table.
}

type Assignment = {
  id: string;
  title: string;
  due_date: string;
  status: string;
  course_id: string; // Used for filtering
  // 'submissions' is in mock data but not in your API response.
}

type Exam = {
  id: string;
  title: string;
  exam_date: string;
  duration_minutes: number;
  total_marks: number;
  status: string;
  course_id: string; // Used for filtering
}

// Mock data removed

type CourseResource = {
  id: string
  title: string
  description?: string | null
  type?: string | null
  url?: string | null
  createdAt?: string | null
  createdByName?: string | null
}

type ResourceFormState = {
  title: string
  type: string
  url: string
  description: string
}

const formatResourceDate = (value?: string | null) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

export function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const api = useApi()

  // --- State for fetched data ---
  const [course, setCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [resources, setResources] = useState<CourseResource[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- State for Resources Tab ---
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false)
  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
    title: '',
    type: 'Document',
    url: '',
    description: ''
  })

  // Add these two lines back
  const [resourceSaving, setResourceSaving] = useState(false)
  const [resourceDeletingId, setResourceDeletingId] = useState<string | null>(null)


  const parseResources = useCallback((payload: unknown): CourseResource[] => {
    if (!Array.isArray(payload)) {
      return []
    }
    return payload.map((item: { 
      id: string | number; 
      title?: string; 
      description?: string; 
      type?: string; 
      resource_type?: string; 
      url?: string; 
      createdAt?: string; 
      created_at?: string;
      createdBy?: { name?: string };
      createdByName?: string;
    }) => {
      // (parsing logic as you had it)
      const title = typeof item.title === 'string' && item.title.trim() !== '' ? item.title.trim() : 'Untitled resource'
      const description = typeof item.description === 'string' && item.description.trim() !== '' ? item.description.trim() : null
      const typeValue =
        typeof item.type === 'string' && item.type.trim() !== ''
          ? item.type.trim()
          : typeof item.resource_type === 'string' && item.resource_type.trim() !== ''
            ? item.resource_type.trim()
            : 'Document'
      const urlValue = typeof item.url === 'string' && item.url.trim() !== '' ? item.url.trim() : null
      const createdAtValue =
        typeof item.createdAt === 'string'
          ? item.createdAt
          : typeof item.created_at === 'string'
            ? item.created_at
            : null
      let createdByName: string | null = null
      if (item.createdBy && typeof item.createdBy === 'object' && item.createdBy !== null && 'name' in item.createdBy) {
        const nameValue = (item.createdBy as { name?: unknown }).name
        createdByName = typeof nameValue === 'string' ? nameValue : null
      } else if (typeof item.createdByName === 'string') {
        createdByName = item.createdByName
      }
      return {
        id: String(item.id),
        title,
        description,
        type: typeValue,
        url: urlValue,
        createdAt: createdAtValue,
        createdByName
      }
    })
  }, [])

  const loadAllData = useCallback(async () => {
    if (!id) {
      setError("No course ID found.")
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    // Set resources loading for its tab
    setResourcesLoading(true)
    setResourceError(null)

    try {
      // Fetch all data in parallel
      const [
        courseRes, 
        assignmentsRes, 
        examsRes,
        studentsRes,
        resourcesRes
      ] = await Promise.all([
        api(`/api/courses/${id}`),
        api('/api/assignments'), // Fetches all, will filter client-side
        api('/api/exams'),       // Fetches all, will filter client-side
        api(`/api/courses/${id}/students`), // **NOTE: This endpoint is missing in your backend!**
        api(`/api/courses/${id}/resources`)  // **NOTE: This endpoint is also missing!**
      ])

      // --- Process Course ---
      if (!courseRes.ok) throw new Error('Failed to load course details')
      const courseData = await courseRes.json()
      setCourse(courseData.data)

      // --- Process Assignments ---
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json()
        const courseIdStr = String(id)
        setAssignments((assignmentsData.data || []).filter((a: Assignment) => String(a.course_id) === courseIdStr))
      }

      // --- Process Exams ---
      if (examsRes.ok) {
        const examsData = await examsRes.json()
        const courseIdStr = String(id)
        setExams((examsData.data || []).filter((e: Exam) => String(e.course_id) === courseIdStr))
      }

      // --- Process Students ---
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json()
        setStudents(studentsData.data || []) // Assuming API returns { data: [...] }
      } else {
        console.warn('Could not load students. Endpoint /api/courses/:id/students might be missing.')
        setStudents([]) // Set to empty array
      }

      // --- Process Resources ---
      if (resourcesRes.ok) {
        const resourcesData = await resourcesRes.json()
        setResources(parseResources(resourcesData.data ?? []))
      } else {
         console.warn('Could not load resources. Endpoint /api/courses/:id/resources might be missing.')
         setResources([]) // Set to empty array
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load course data')
    } finally {
      setIsLoading(false)
      setResourcesLoading(false)
    }
  }, [api, id, parseResources])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const canManageResources = Boolean(user && ['super_admin', 'admin', 'teacher'].includes(user.role))

  const handleResourceSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResourceSaving(true)
    try {
      const response = await api(`/api/courses/${id}/resources`, {
        method: 'POST',
        body: JSON.stringify({
          title: resourceForm.title,
          type: resourceForm.type,
          url: resourceForm.url || null,
          description: resourceForm.description || null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create resource')
      }

      // Reset form and close dialog
      setResourceForm({ title: '', type: 'Document', url: '', description: '' })
      setIsResourceDialogOpen(false)

      // Reload resources
      loadAllData()
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : 'Failed to create resource')
    } finally {
      setResourceSaving(false)
    }
  }, [api, id, loadAllData, resourceForm])

  const handleDeleteResource = useCallback(async (resourceId: string) => {
    if (!id || !canManageResources) {
      return
    }
    setResourceDeletingId(resourceId)
    try {
      const response = await api(`/api/courses/${id}/resources/${resourceId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete resource')
      }

      // Reload resources
      loadAllData()
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : 'Failed to delete resource')
    } finally {
      setResourceDeletingId(null)
    }
  }, [api, id, loadAllData, canManageResources])

  if (isLoading) {
    return <p>Loading course details...</p>
  }

  if (error) {
    return <p className="text-red-500">{error}</p>
  }

  if (!course) {
    return <p>Course not found.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{course.name}</h1>
        <p className="text-gray-600">Course ID: {course.code}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Instructor</CardTitle>
            <CardDescription>Course lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">{course.teacher_name}</p>
            <p className="text-sm text-gray-600">{course.grade}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Weekly sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-900">
              <Calendar className="w-4 h-4" />
              {/* 'schedule' is not in your API response. Add to 'courses' table and secure.js API */ }
              <span>(Schedule TBD)</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Duration varies per session</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enrollment</CardTitle>
            <CardDescription>Current roster</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-gray-900">
              <Users className="w-4 h-4" />
              <span>{students.length} students</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <BookOpen className="w-4 h-4" />
              <span>Assignments {assignments.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Overview</CardTitle>
          <CardDescription>Objectives and scope</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{course.description}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Roster</CardTitle>
              <CardDescription>Enrolled learners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {students.length === 0 ? (
                <p className="text-sm text-gray-600">No students enrolled or endpoint is missing.</p>
              ) : (
                students.map((student) => (
                  <div key={student.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{student.name}</p>
                      {/* 'progress' is not in your API. Add to 'course_enrollments' table and new API */ }
                      {/* <p className="text-sm text-gray-600">Progress {student.progress}</p> */}
                    </div>
                    <Badge variant={student.status === 'Active' ? 'secondary' : 'outline'} className="mt-3 md:mt-0">{student.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
              <CardDescription>Assessment tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{assignment.title}</p>
                    <p className="text-sm text-gray-600">Due {new Date(assignment.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-8 mt-3 md:mt-0">
                    {/* 'submissions' count is not in your API response. */ }
                    <Badge variant={assignment.status === 'Completed' ? 'secondary' : 'outline'}>{assignment.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Examinations</CardTitle>
              <CardDescription>Upcoming and completed exams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {exams.map((exam) => (
                <div key={exam.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{exam.title}</p>
                    <p className="text-sm text-gray-600">{new Date(exam.exam_date).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-8 mt-3 md:mt-0">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="text-lg font-semibold text-gray-900">{exam.duration_minutes} mins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total Marks</p>
                      <p className="text-lg font-semibold text-gray-900">{exam.total_marks}</p>
                    </div>
                    <Badge variant={exam.status === 'Completed' ? 'secondary' : 'outline'}>{exam.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          {/* This tab's logic was already present and is preserved. */}
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Course Resources</CardTitle>
                <CardDescription>Supporting materials</CardDescription>
              </div>
              {canManageResources ? (
                <Dialog
                  open={isResourceDialogOpen}
                  onOpenChange={(open) => {
                    setIsResourceDialogOpen(open)
                    if (!open) {
                      setResourceForm({ title: '', type: 'Document', url: '', description: '' })
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Resource
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share a resource</DialogTitle>
                      <DialogDescription>Upload supporting links or materials for this course.</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={handleResourceSubmit}>
                      <div className="space-y-2">
                        <Label htmlFor="resource-title">Title</Label>
                        <Input
                          id="resource-title"
                          value={resourceForm.title}
                          onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resource-type">Type</Label>
                        <Select
                          value={resourceForm.type}
                          onValueChange={(value) => setResourceForm((current) => ({ ...current, type: value }))}
                        >
                          <SelectTrigger id="resource-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Document">Document</SelectItem>
                            <SelectItem value="PDF">PDF</SelectItem>
                            <SelectItem value="Presentation">Presentation</SelectItem>
                            <SelectItem value="Video">Video</SelectItem>
                            <SelectItem value="Link">Link</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resource-url">Link</Label>
                        <Input
                          id="resource-url"
                          placeholder="https://..."
                          value={resourceForm.url}
                          onChange={(event) => setResourceForm((current) => ({ ...current, url: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resource-description">Description</Label>
                        <Textarea
                          id="resource-description"
                          rows={3}
                          value={resourceForm.description}
                          onChange={(event) => setResourceForm((current) => ({ ...current, description: event.target.value }))}
                        />
                      </div>
                      {resourceError && <p className="text-sm text-red-500">{resourceError}</p>}
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsResourceDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={resourceSaving}>
                          {resourceSaving ? 'Saving...' : 'Share Resource'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {resourceError ? (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{resourceError}</div>
              ) : null}
              {resourcesLoading ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Loading resources...
                </div>
              ) : resources.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No resources available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {resources.map((resource) => {
                    const formattedDate = formatResourceDate(resource.createdAt)
                    return (
                      <div
                        key={resource.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-gray-900">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">{resource.title}</span>
                            <Badge variant="outline">{resource.type ?? 'Document'}</Badge>
                          </div>
                          {resource.description ? (
                            <p className="text-sm text-gray-600">{resource.description}</p>
                          ) : null}
                          {resource.createdByName || formattedDate ? (
                            <p className="text-xs text-muted-foreground">
                              {resource.createdByName ? `Shared by ${resource.createdByName}` : 'Shared'}
                              {formattedDate ? ` • ${formattedDate}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {resource.url ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open
                              </a>
                            </Button>
                          ) : null}
                          {canManageResources ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteResource(resource.id)}
                              disabled={resourceDeletingId === resource.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}