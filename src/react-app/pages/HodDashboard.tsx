import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { useApi } from '../contexts/AuthContext'
import { Users, BookOpen, AlertTriangle, CheckCircle, XCircle, BarChart3, Package, RefreshCw, MessageSquare } from 'lucide-react'

type Teacher = { id: number; name: string; email: string; weekly_periods: number }
type Course = { id: number; name: string; code: string; grade: string; syllabus_coverage: number; assigned_teacher: { id: number; name: string } | null }
type Performance = { course_id: number; course_name: string; average_score: number }
type Escalation = { id: number; student_name: string; reason: string; details: string; status: string; created_at: string }
type LeaveRequest = { id: number; staff_name: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string }
type Asset = { id: number; name: string; sku: string; quantity: number; asset_type: string }

type ProgressReport = {
  id: number
  course_name: string
  course_code: string
  week_start: string
  topics_covered: string
  coverage_percent: number
  challenges: string
  blockers: string
  comments: { id: number; author_name: string; comment: string; created_at: string }[]
}

type RosterTeacher = {
  id: number
  name: string
  email: string
  department_courses: { id: number; name: string; code: string; grade: string }[]
  department_periods: number
}

type EligibleTeacher = {
  id: number
  name: string
  email: string
}

export default function HodDashboard() {
  const api = useApi()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  
  const [deptInfo, setDeptInfo] = useState<{ name: string; code: string; teachers: Teacher[]; courses: Course[] } | null>(null)
  const [performance, setPerformance] = useState<Performance[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [inventory, setInventory] = useState<Asset[]>([])
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([])

  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [resolutionText, setResolutionText] = useState('')
  
  const [commentingReportId, setCommentingReportId] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')

  const [roster, setRoster] = useState<RosterTeacher[]>([])
  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([])
  const [selectedEligibleId, setSelectedEligibleId] = useState<string>('')
  const [addingToRoster, setAddingToRoster] = useState(false)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const dRes = await api('/api/hod/my-department'); const dJson = await dRes.json();
      if (dRes.ok) setDeptInfo(dJson.data)

      const pRes = await api('/api/hod/subject-overview'); const pJson = await pRes.json();
      if (pRes.ok) setPerformance(pJson.data)

      const eRes = await api('/api/hod/escalations'); const eJson = await eRes.json();
      if (eRes.ok) setEscalations(eJson.data)

      const lRes = await api('/api/hod/leave-requests'); const lJson = await lRes.json();
      if (lRes.ok) setLeaves(lJson.data)

      const iRes = await api('/api/hod/inventory'); const iJson = await iRes.json();
      if (iRes.ok) setInventory(iJson.data)

      const prRes = await api('/api/hod/progress-reports'); const prJson = await prRes.json();
      if (prRes.ok) setProgressReports(prJson.data)

      const rRes = await api('/api/hod/staff-roster'); const rJson = await rRes.json();
      if (rRes.ok) setRoster(rJson.data)

      const elRes = await api('/api/hod/eligible-teachers'); const elJson = await elRes.json();
      if (elRes.ok) setEligibleTeachers(elJson.data)
    } catch (err) {
      console.error("Dashboard payload mapping error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const handleTeacherAssign = async (courseId: number, teacherId: number) => {
    const res = await api(`/api/hod/courses/${courseId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId })
    })
    if (res.ok) {
      loadDashboard()
    }
  }

  const handleAddComment = async (reportId: number) => {
    if (!commentText.trim()) return
    const res = await api(`/api/hod/progress-reports/${reportId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment: commentText })
    })
    if (res.ok) {
      setCommentText('')
      setCommentingReportId(null)
      loadDashboard()
    }
  }

  const handleEscalationResolve = async (id: number) => {
    if (!resolutionText.trim()) return;
    const res = await api(`/api/hod/escalations/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_details: resolutionText }) })
    if (res.ok) { setResolvingId(null); setResolutionText(''); loadDashboard(); }
  }

  const handleLeaveAction = async (id: number, action: 'approve_hod' | 'reject_hod') => {
    const res = await api(`/api/hod/leave-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ action }) })
    if (res.ok) loadDashboard()
  }

  const handleAddToRoster = async () => {
    if (!selectedEligibleId) return
    setAddingToRoster(true)
    const res = await api('/api/hod/staff-roster/add', {
      method: 'POST',
      body: JSON.stringify({ teacher_id: Number(selectedEligibleId) })
    })
    if (res.ok) {
      setSelectedEligibleId('')
      await loadDashboard()
    }
    setAddingToRoster(false)
  }

  if (loading) return <div className="flex justify-center items-center h-64 animate-pulse text-gray-500">Compiling Scoped Department Ledger...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{deptInfo?.name || "Department Oversight"}</h1>
          <p className="text-sm text-gray-500">Curriculum Scope Code: {deptInfo?.code || "N/A"}</p>
        </div>
        <Button variant="outline" onClick={loadDashboard}><RefreshCw className="w-4 h-4 mr-2" />Sync Station</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6 flex items-center space-x-4"><Users className="w-8 h-8 text-blue-500" /><div><p className="text-xs text-gray-400 font-medium">Faculty Strength</p><h3 className="text-xl font-bold">{deptInfo?.teachers.length || 0}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><BookOpen className="w-8 h-8 text-indigo-500" /><div><p className="text-xs text-gray-400 font-medium">Syllabus Subjects</p><h3 className="text-xl font-bold">{deptInfo?.courses.length || 0}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><AlertTriangle className="w-8 h-8 text-amber-500" /><div><p className="text-xs text-gray-400 font-medium">Welfare Open Items</p><h3 className="text-xl font-bold">{escalations.length}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><MessageSquare className="w-8 h-8 text-emerald-500" /><div><p className="text-xs text-gray-400 font-medium">New Progress Reports</p><h3 className="text-xl font-bold">{progressReports.length}</h3></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Syllabus & Assignments</TabsTrigger>
          <TabsTrigger value="reports">Progress Reports ({progressReports.length})</TabsTrigger>
          <TabsTrigger value="staff">Staff Workloads</TabsTrigger>
          <TabsTrigger value="escalations">Escalations ({escalations.length})</TabsTrigger>
          <TabsTrigger value="leaves">Leave Handshakes ({leaves.length})</TabsTrigger>
          <TabsTrigger value="inventory">Asset Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center text-sm font-semibold"><BookOpen className="w-4 h-4 mr-2" />Syllabus Progress & Assignments</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {deptInfo?.courses.map(c => (
                  <div key={c.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-900">{c.name} ({c.code})</span>
                      <span className="text-indigo-600 font-semibold">{c.syllabus_coverage}% Documented</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${c.syllabus_coverage}%` }} />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t text-xs">
                      <span className="text-gray-500 font-medium">Assigned Teacher:</span>
                      <select
                        className="bg-white border rounded px-2 py-1"
                        value={c.assigned_teacher?.id || ""}
                        onChange={(e) => handleTeacherAssign(c.id, Number(e.target.value))}
                      >
                        <option value="">-- Assign Instructor --</option>
                        {deptInfo.teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center text-sm font-semibold"><BarChart3 className="w-4 h-4 mr-2" />Comparative Exam Distributions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {performance.map(p => (
                  <div key={p.course_id} className="flex justify-between items-center p-3 border rounded-lg bg-gray-50/50">
                    <span className="text-xs font-medium text-gray-900">{p.course_name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.average_score >= 50 ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-red-800'}`}>{p.average_score}% Avg</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Teacher Progression Feed & Direct Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {progressReports.map(r => (
                <div key={r.id} className="p-4 border rounded-lg space-y-4 bg-gray-50/30 text-xs">
                  <div className="flex justify-between border-b pb-2">
                    <div>
                      <h4 className="font-bold text-gray-900">{r.course_name} ({r.course_code})</h4>
                      <p className="text-gray-400">Week: {r.week_start}</p>
                    </div>
                    <div className="text-right">
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-bold">{r.coverage_percent}% Complete</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Topics Covered This Week:</p>
                    <p className="text-gray-600 italic bg-white p-2 border rounded mt-1">{r.topics_covered}</p>
                  </div>
                  {(r.challenges || r.blockers) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {r.challenges && (
                        <div>
                          <p className="font-semibold text-amber-700">Identified Challenges:</p>
                          <p className="text-gray-600 bg-amber-50/40 p-2 border border-amber-100 rounded mt-1">{r.challenges}</p>
                        </div>
                      )}
                      {r.blockers && (
                        <div>
                          <p className="font-semibold text-red-700">Critical Blockers:</p>
                          <p className="text-gray-600 bg-red-50/40 p-2 border border-red-100 rounded mt-1">{r.blockers}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comment Thread Loop */}
                  <div className="space-y-2 border-t pt-3">
                    <p className="font-bold text-gray-700 flex items-center"><MessageSquare className="w-3.5 h-3.5 mr-1" /> Discussion Thread</p>
                    <div className="space-y-2 bg-white p-3 border rounded-lg max-h-48 overflow-y-auto">
                      {r.comments.map(c => (
                        <div key={c.id} className="border-b last:border-0 pb-2 mb-2">
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span className="font-semibold text-gray-700">{c.author_name}</span>
                            <span>{c.created_at}</span>
                          </div>
                          <p className="text-gray-600 mt-1">{c.comment}</p>
                        </div>
                      ))}
                      {r.comments.length === 0 && <p className="text-gray-400 italic">No feedback messages sent yet.</p>}
                    </div>

                    {commentingReportId === r.id ? (
                      <div className="space-y-2 pt-1">
                        <Input placeholder="Respond with pedagogical advice, comments or instruction..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                        <div className="flex justify-end space-x-2"><Button size="sm" variant="outline" onClick={() => setCommentingReportId(null)}>Cancel</Button><Button size="sm" onClick={() => handleAddComment(r.id)}>Send Feedback</Button></div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setCommentingReportId(r.id)}>Leave HOD Feedback</Button>
                    )}
                  </div>
                </div>
              ))}
              {progressReports.length === 0 && <p className="text-center py-6 text-gray-400">No teacher progress reports filed yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Existing Tabs stay exactly as previously defined */}
        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-sm font-bold">Department Roster & Subject Allocations</CardTitle>
                <p className="text-[11px] text-gray-500">Manage teachers assigned specifically to your academic wing.</p>
              </div>

              {/* Add existing school teacher to roster (not a new global staff account) */}
              <div className="flex items-center space-x-2">
                <select
                  className="text-xs bg-white border rounded p-1.5 min-w-[200px]"
                  value={selectedEligibleId}
                  onChange={(e) => setSelectedEligibleId(e.target.value)}
                >
                  <option value="">-- Add School Teacher to Roster --</option>
                  {eligibleTeachers.map(et => (
                    <option key={et.id} value={et.id}>{et.name} ({et.email})</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!selectedEligibleId || addingToRoster}
                  onClick={handleAddToRoster}
                >
                  {addingToRoster ? 'Adding...' : 'Add to Department'}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50/75">
                      <th className="p-3 font-semibold text-gray-600">Teacher</th>
                      <th className="p-3 font-semibold text-gray-600">Department Subjects Taught</th>
                      <th className="p-3 font-semibold text-gray-600 text-right">Dept Workload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {roster.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">{t.name}</div>
                          <div className="text-[10px] text-gray-400">{t.email}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {t.department_courses.map(c => (
                              <span key={c.id} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium border border-indigo-100">
                                {c.name} ({c.code})
                              </span>
                            ))}
                            {t.department_courses.length === 0 && (
                              <span className="text-gray-400 italic text-[11px]">No department subjects assigned yet.</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-bold text-gray-900">{t.department_periods} Periods/wk</div>
                          <div className="text-[9px] text-gray-400">Within {deptInfo?.code}</div>
                        </td>
                      </tr>
                    ))}
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-gray-400 italic">
                          Your roster is currently empty. Use the select menu above to register school faculty to your department.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalations">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Intervention Directives Log</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {escalations.map(e => (
                <div key={e.id} className="p-4 border rounded-lg bg-amber-50/40 border-amber-100 space-y-2 text-xs">
                  <div className="flex justify-between font-semibold"><span className="text-gray-900">Student: {e.student_name}</span><span className="text-amber-800">Reason: {e.reason}</span></div>
                  <p className="text-gray-600 bg-white p-2 border rounded">{e.details}</p>
                  {resolvingId === e.id ? (
                    <div className="space-y-2 pt-2">
                      <Input placeholder="Enter diagnostic action parameters..." value={resolutionText} onChange={(ev) => setResolutionText(ev.target.value)} />
                      <div className="flex space-x-2 justify-end"><Button size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancel</Button><Button size="sm" onClick={() => handleEscalationResolve(e.id)}>Commit Solution</Button></div>
                    </div>
                  ) : <Button size="sm" variant="outline" className="text-amber-900" onClick={() => setResolvingId(e.id)}>Resolve Incident</Button>}
                </div>
              ))}
              {escalations.length === 0 && <p className="text-center py-6 text-xs text-gray-400">Pastoral pipeline clean — no active student drop-outs.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">First-Line Leave Request Gatekeeping</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {leaves.map(l => (
                <div key={l.id} className="p-4 border rounded-lg flex justify-between items-center text-xs">
                  <div><p className="font-semibold text-gray-900">{l.staff_name} ({l.leave_type})</p><p className="text-gray-500">Duration: {l.start_date} to {l.end_date}</p><p className="text-gray-400 mt-1 italic">Reason: "{l.reason}"</p></div>
                  <div className="flex space-x-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleLeaveAction(l.id, 'approve_hod')}><CheckCircle className="w-3.5 h-3.5 mr-1" />Endorse</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleLeaveAction(l.id, 'reject_hod')}><XCircle className="w-3.5 h-3.5 mr-1" />Deny</Button>
                  </div>
                </div>
              ))}
              {leaves.length === 0 && <p className="text-center py-6 text-xs text-gray-400">No pending leave cards submitted by department staff.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Department Materials & Lab Kits Ledger</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {inventory.map(a => (
                  <div key={a.id} className="p-4 border rounded-lg bg-gray-50 flex items-center space-x-3 text-xs">
                    <Package className="w-6 h-6 text-gray-400" />
                    <div><h4 className="font-bold text-gray-900">{a.name}</h4><p className="text-gray-500">Serial/SKU: {a.sku}</p><p className="text-indigo-600 font-semibold mt-1">Available Qty: {a.quantity}</p></div>
                  </div>
                ))}
                {inventory.length === 0 && <p className="text-center py-6 text-xs text-gray-400 col-span-3">No inventory items mapped under this department's ID.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}