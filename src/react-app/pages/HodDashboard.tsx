import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { useApi } from '../contexts/AuthContext'
import { Users, BookOpen, AlertTriangle, CheckCircle, XCircle, BarChart3, Package, Calendar, RefreshCw } from 'lucide-react'

type Teacher = { id: number; name: string; email: string; weekly_periods: number }
type Course = { id: number; name: string; code: string; grade: string; syllabus_coverage: number }
type Performance = { course_id: number; course_name: string; average_score: number }
type Escalation = { id: number; student_name: string; reason: string; details: string; status: string; created_at: string }
type LeaveRequest = { id: number; staff_name: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string }
type Asset = { id: number; name: string; sku: string; quantity: number; asset_type: string }

export default function HodDashboard() {
  const api = useApi()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  
  const [deptInfo, setDeptInfo] = useState<{ name: string; code: string; teachers: Teacher[]; courses: Course[] } | null>(null)
  const [performance, setPerformance] = useState<Performance[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [inventory, setInventory] = useState<Asset[]>([])

  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [resolutionText, setResolutionText] = useState('')

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
    } catch (err) {
      console.error("Dashboard payload mapping error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const handleEscalationResolve = async (id: number) => {
    if (!resolutionText.trim()) return;
    const res = await api(`/api/hod/escalations/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_details: resolutionText }) })
    if (res.ok) { setResolvingId(null); setResolutionText(''); loadDashboard(); }
  }

  const handleLeaveAction = async (id: number, action: 'approve_hod' | 'reject_hod') => {
    const res = await api(`/api/hod/leave-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ action }) })
    if (res.ok) loadDashboard()
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

      {/* Top Scoped Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6 flex items-center space-x-4"><Users className="w-8 h-8 text-blue-500" /><div><p className="text-xs text-gray-400 font-medium">Faculty Strength</p><h3 className="text-xl font-bold">{deptInfo?.teachers.length || 0}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><BookOpen className="w-8 h-8 text-indigo-500" /><div><p className="text-xs text-gray-400 font-medium">Syllabus Subjects</p><h3 className="text-xl font-bold">{deptInfo?.courses.length || 0}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><AlertTriangle className="w-8 h-8 text-amber-500" /><div><p className="text-xs text-gray-400 font-medium">Welfare Open Items</p><h3 className="text-xl font-bold">{escalations.length}</h3></div></CardContent></Card>
        <Card><CardContent className="p-6 flex items-center space-x-4"><Calendar className="w-8 h-8 text-emerald-500" /><div><p className="text-xs text-gray-400 font-medium">Staff Leaves Pending</p><h3 className="text-xl font-bold">{leaves.length}</h3></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Syllabus & Analytics</TabsTrigger>
          <TabsTrigger value="staff">Staff Workloads</TabsTrigger>
          <TabsTrigger value="escalations">Escalations ({escalations.length})</TabsTrigger>
          <TabsTrigger value="leaves">Leave Handshakes ({leaves.length})</TabsTrigger>
          <TabsTrigger value="inventory">Asset Inventory</TabsTrigger>
        </TabsList>

        {/* Tab 1: Syllabus Tracking and Exam Distributions */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center text-sm font-semibold"><BookOpen className="w-4 h-4 mr-2" />Syllabus Progress Tracker</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {deptInfo?.courses.map(c => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex justify-between text-xs"><span className="font-medium text-gray-700">{c.name} ({c.code})</span><span className="text-gray-500 font-semibold">{c.syllabus_coverage}% Done</span></div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-indigo-600 h-full rounded-full" style={{ width: `${c.syllabus_coverage}%` }} /></div>
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

        {/* Tab 2: Faculty Supervision & Period Workloads */}
        <TabsContent value="staff">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Teacher Contact Periods Audit</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {deptInfo?.teachers.map(t => (
                <div key={t.id} className="py-3 flex justify-between items-center text-xs">
                  <div><p className="font-semibold text-gray-900">{t.name}</p><p className="text-gray-500">{t.email}</p></div>
                  <div className="text-right"><p className="font-bold text-gray-900">{t.weekly_periods} Periods / wk</p><p className="text-gray-400 text-[10px]">Active Schedule Load</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Welfare Escalation Moderations */}
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

        {/* Tab 4: Localized First-Tier Leave Signoffs */}
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

        {/* Tab 5: Physical Assets & Resource Ledger */}
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