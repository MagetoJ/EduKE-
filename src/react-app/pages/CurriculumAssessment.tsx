import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useApi, useAuth } from '../contexts/AuthContext'
import { BookOpen, Plus, TrendingUp, BarChart3 } from 'lucide-react'

type CurriculumType = '844' | 'british' | 'american' | 'ib' | 'cbc'

type MeritListEntry = {
  id: number
  first_name: string
  last_name: string
  admission_number: string
  position: number
  mean_score: number
  aggregate_score: number | null
  total_students_in_class: number
}

export default function CurriculumAssessment() {
  const { user } = useAuth()
  const apiFetch = useApi()
  const [curriculum, setCurriculum] = useState<CurriculumType>('cbc')
  const [meritLists, setMeritLists] = useState<MeritListEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedAcademicYear) {
        params.append('academic_year_id', selectedAcademicYear)
      }

      const response = await apiFetch(`/api/curriculum/merit-lists?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to load assessment data')
      }

      const data = await response.json()
      setMeritLists(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [apiFetch, selectedAcademicYear])

  useEffect(() => {
    loadData()
  }, [loadData, curriculum, searchTerm])

  const handleGenerateMeritList = async () => {
    if (!selectedAcademicYear) {
      setError('Please select an academic year')
      return
    }

    setIsLoading(true)
    try {
      const response = await apiFetch('/api/curriculum/merit-lists/generate', {
        method: 'POST',
        body: JSON.stringify({
          academic_year_id: selectedAcademicYear,
          grade_level: 'Grade 10',
          term_id: 1
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate merit list')
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate merit list')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMeritList = meritLists.filter(entry =>
    `${entry.first_name} ${entry.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const curriculumDescriptions = {
    '844': '8-4-4 System (Traditional)',
    'british': 'British Curriculum (IGCSE/GCE)',
    'american': 'American Curriculum',
    'ib': 'International Baccalaureate',
    'cbc': 'Competency Based Curriculum'
  }

  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-800">Access Denied</CardTitle>
          <CardDescription className="text-yellow-700">
            Only administrators and teachers can access curriculum assessments
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Curriculum Assessment</h1>
        <p className="text-gray-600">Multi-curriculum assessment management for different education systems</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Select Curriculum</Label>
          <Select value={curriculum} onValueChange={(value) => setCurriculum(value as CurriculumType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(curriculumDescriptions).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Academic Year</Label>
          <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
            <SelectTrigger>
              <SelectValue placeholder="Select academic year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024/2025</SelectItem>
              <SelectItem value="2023">2023/2024</SelectItem>
              <SelectItem value="2022">2022/2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="844">8-4-4 System</TabsTrigger>
          <TabsTrigger value="british">British Curriculum</TabsTrigger>
          <TabsTrigger value="american">American Curriculum</TabsTrigger>
          <TabsTrigger value="ib">IB Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Students</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredMeritList.length}</div>
                <p className="text-xs text-muted-foreground">Enrolled this term</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Curriculum</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{curriculumDescriptions[curriculum].split(' ')[0]}</div>
                <p className="text-xs text-muted-foreground">{curriculumDescriptions[curriculum]}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Merit Lists</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meritLists.length > 0 ? '✓' : '—'}</div>
                <p className="text-xs text-muted-foreground">{meritLists.length > 0 ? 'Generated' : 'Not generated'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-bold mb-2">Available Curriculums:</h4>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(curriculumDescriptions).map(([key, label]) => (
                      <li key={key} className="text-gray-600">
                        • {label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-2">Features:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Multi-curriculum support</li>
                    <li>• Merit list generation</li>
                    <li>• Automated grading schemes</li>
                    <li>• Student performance tracking</li>
                    <li>• Transcript generation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="844" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>8-4-4 System Assessment</CardTitle>
              <CardDescription>
                Traditional 8-4-4 system with form-based ranking and aggregate score calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">How it Works:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Subjects graded on a 12-point scale (A=12, A-=11, ... E=1)</li>
                  <li>• Best 7 subjects contribute to mean grade calculation</li>
                  <li>• Merit lists rank students by performance within form and stream</li>
                  <li>• Subject grading: 80-100=A (12pts), 75-79=A- (11pts), etc.</li>
                </ul>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredMeritList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No assessment data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold">Merit List - Form 4</h4>
                    <Button onClick={handleGenerateMeritList} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Position</th>
                        <th className="text-left py-2 px-4">Student Name</th>
                        <th className="text-left py-2 px-4">Admission No.</th>
                        <th className="text-right py-2 px-4">Mean Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMeritList.slice(0, 10).map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4">
                            <Badge>{entry.position}</Badge>
                          </td>
                          <td className="py-2 px-4 font-medium">{entry.first_name} {entry.last_name}</td>
                          <td className="py-2 px-4 text-gray-600">{entry.admission_number}</td>
                          <td className="py-2 px-4 text-right font-bold text-green-600">{entry.mean_score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="british" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>British Curriculum (IGCSE/GCE)</CardTitle>
              <CardDescription>
                Cambridge assessment system with Key Stages and predicted vs achieved grades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 p-4 rounded border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-2">Features:</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Key Stage tracking (KS3, KS4, KS5)</li>
                  <li>• Predicted vs. Mock Result comparison</li>
                  <li>• Effort grades (1-5 scale) separate from attainment</li>
                  <li>• Cambridge Checkpoint assessments (0.0-6.0 scale)</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded border border-gray-200 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-600">Assessment data will appear here</p>
                <Button className="mt-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="american" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>American Curriculum</CardTitle>
              <CardDescription>
                GPA-based system with credit hours and graduation tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 p-4 rounded border border-green-200">
                <h4 className="font-bold text-green-900 mb-2">Features:</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• GPA Calculation (4.0 scale)</li>
                  <li>• Credit hour tracking and graduation requirements</li>
                  <li>• MAP Test Integration (NWEA RIT scores)</li>
                  <li>• High School Transcript generation</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded border border-gray-200 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-600">Assessment data will appear here</p>
                <Button className="mt-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ib" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>International Baccalaureate (IB)</CardTitle>
              <CardDescription>
                Criteria-based assessment with CAS portfolio tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 p-4 rounded border border-orange-200">
                <h4 className="font-bold text-orange-900 mb-2">Features:</h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Criteria-based grading (Criteria A, B, C, D out of 8)</li>
                  <li>• 1-7 final grade scale with best fit algorithm</li>
                  <li>• MYP (Middle Years Programme) support</li>
                  <li>• CAS Portfolio (Creativity, Activity, Service)</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded border border-gray-200 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-600">Assessment data will appear here</p>
                <Button className="mt-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
