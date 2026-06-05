import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Award, CalendarDays, Clock3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { useApi } from '../contexts/AuthContext'

// --- Types based on your API ---
type Exam = {
  id: string;
  title: string;
  course_name: string; // NOTE: Your GET /api/exams/:id endpoint does not provide this!
  exam_date: string;
  duration_minutes: number;
  total_marks: number;
  status: string;
  description: string;
  // Mock data fields 'venue' and 'instructions' are not in your schema.
}

type ExamResult = {
  id: string;
  student_id: string; // You'll need to fetch student name separately
  score: number;
  grade: string;
  status: string;
}

// Mock data removed

export function ExamDetail() {
  const { id } = useParams<{ id: string }>()
  const api = useApi()

  const [exam, setExam] = useState<Exam | null>(null)
  const [results, setResults] = useState<ExamResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError("No exam ID found.")
      setIsLoading(false)
      return
    }

    const fetchExamData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [examRes, resultsRes] = await Promise.all([
          api(`/api/exams/${id}`),
          api(`/api/exams/${id}/results`)
        ])

        if (!examRes.ok) {
          throw new Error('Failed to fetch exam details')
        }
        if (!resultsRes.ok) {
          throw new Error('Failed to fetch exam results')
        }

        const examData = await examRes.json()
        const resultsData = await resultsRes.json()

        setExam(examData.data)
        setResults(resultsData.data)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchExamData()
  }, [id, api])


  if (isLoading) {
    return <p>Loading exam details...</p>
  }

  if (error) {
    return <p className="text-red-500">{error}</p>
  }

  if (!exam) {
    return <p>Exam not found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
        <p className="text-gray-600">{exam.course_name || 'Course'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Exam timing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-900">
              <CalendarDays className="w-4 h-4" />
              <span>{new Date(exam.exam_date).toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <Clock3 className="w-4 h-4" />
              <span>Duration {exam.duration_minutes} minutes</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exam Details</CardTitle>
            <CardDescription>Structure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2 text-gray-900">
              <Award className="w-4 h-4" />
              <span>Total Marks {exam.total_marks}</span>
            </div>
            {/* 'venue' is not in your schema. Removing. */}
            <Badge variant={exam.status === 'Completed' ? 'secondary' : 'outline'} className="w-fit">{exam.status || 'Scheduled'}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>Guidelines</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 'instructions' is not in your schema. Using 'description' instead. */}
            <p className="text-sm text-gray-700 leading-relaxed">{exam.description || 'No instructions provided.'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="results" className="space-y-6">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          {/* Analytics tab removed as backend does not support it */}
        </TabsList>

        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Results</CardTitle>
              <CardDescription>Performance overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length === 0 ? (
                <p className="text-sm text-gray-600">Results will appear after grading is completed.</p>
              ) : (
                results.map((result) => (
                  <div key={result.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg">
                    <div>
                      {/* NOTE: You need to join with students table in GET /api/exams/:id/results to get names */ }
                      <p className="font-medium text-gray-900">Student ID: {result.student_id}</p>
                      <p className="text-sm text-gray-600">Status {result.status}</p>
                    </div>
                    <div className="flex items-center gap-6 mt-3 md:mt-0">
                      <p className="text-lg font-semibold text-gray-900">{result.score}</p>
                      <Badge variant={result.status === 'Confirmed' ? 'secondary' : 'outline'}>{result.grade}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}