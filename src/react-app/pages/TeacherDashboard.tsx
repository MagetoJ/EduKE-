import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription
} from '../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '../components/ui/select';
import {
  BookOpen, CheckSquare, Trophy, Users, ClipboardCheck, FileText,
  UserCog, MessageSquareWarning, CalendarClock, Mail
} from 'lucide-react';
import { useApi } from '../contexts/AuthContext';

interface HODContact {
  id: number;
  name: string;
  email: string;
  department: string;
}

interface ProgressReportSummary {
  id: number;
  course_name: string;
  week_start_date: string;
  coverage_percent: number;
  comment_count: number;
}

interface EscalationSummary {
  id: number;
  student_name: string;
  reason: string;
  status: string;
  created_at: string;
}

interface LeaveRequestSummary {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface DashboardData {
  is_class_teacher: boolean;
  homeroom: { class_name: string; grade_level: string; stream_section: string | null; total_students: number } | null;
  teaching_subjects: { class_name: string; subject_name: string; subject_code: string | null }[];
  reports_to: HODContact[];
  reports_to_is_fallback: boolean;
  recent_progress_reports: ProgressReportSummary[];
  recent_escalations: EscalationSummary[];
  recent_leave_requests: LeaveRequestSummary[];
}

const statusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const s = status.toLowerCase();
  if (s.includes('reject')) return 'destructive';
  if (s.includes('approve') || s === 'resolved') return 'default';
  return 'secondary';
};

export default function TeacherDashboard() {
  const api = useApi();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('lessons');

  // Grade Form State Indicators
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStrand, setSelectedStrand] = useState('');
  const [strands, setStrands] = useState([]);
  const [students, setStudents] = useState([]);

  // Homeroom students, loaded lazily only when the Escalate dialog opens
  const [homeroomStudents, setHomeroomStudents] = useState<{ id: number; first_name: string; last_name: string }[]>([]);

const loadDashboard = useCallback(() => {
    api('/api/teacher-dashboard/overview')
      .then(res => res.json())
      .then((data: DashboardData) => {
        setDashboardData(data);
        if (data?.is_class_teacher) {
          setActiveTab('homeroom');
        }
      });
  }, [api]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId);
    if (!courseId) {
      setStrands([]);
      setStudents([]);
      return;
    }
    const strandsRes = await api(`/api/courses/${courseId}/strands`);
    const studentsRes = await api(`/api/courses/${courseId}/students`);
    setStrands(await strandsRes.json());
    setStudents(await studentsRes.json());
  };

  const loadHomeroomStudents = async () => {
    if (homeroomStudents.length > 0) return;
    const res = await api('/api/class-teacher/my-managed-stream');
    const data = await res.json();
    setHomeroomStudents(data?.students || []);
  };

  if (!dashboardData) return <div className="p-6">Loading workspace...</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Educator Workspace</h1>
        <p className="text-slate-600">Deliver lessons, assess competencies, and manage your students</p>
      </div>

      <ReportingCard data={dashboardData} />

      <QuickActions
        api={api}
        dashboardData={dashboardData}
        homeroomStudents={homeroomStudents}
        onOpenEscalate={loadHomeroomStudents}
        onSubmitted={loadDashboard}
      />

      {/* Primary Feature Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {dashboardData.is_class_teacher && (
          <Button
            variant={activeTab === 'homeroom' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('homeroom')}
            className={`gap-2 ${activeTab === 'homeroom' ? 'bg-blue-600 hover:bg-blue-700' : 'text-blue-600'}`}
          >
            <Users className="w-4 h-4" /> My Homeroom
          </Button>
        )}
        <Button variant={activeTab === 'lessons' ? 'default' : 'ghost'} onClick={() => setActiveTab('lessons')} className="gap-2">
          <BookOpen className="w-4 h-4" /> Lesson Planning
        </Button>
        <Button variant={activeTab === 'grades' ? 'default' : 'ghost'} onClick={() => setActiveTab('grades')} className="gap-2">
          <CheckSquare className="w-4 h-4" /> CBC Competencies
        </Button>
        <Button variant={activeTab === 'clubs' ? 'default' : 'ghost'} onClick={() => setActiveTab('clubs')} className="gap-2">
          <Trophy className="w-4 h-4" /> Co-Curricular
        </Button>
        <Button variant={activeTab === 'reports' ? 'default' : 'ghost'} onClick={() => setActiveTab('reports')} className="gap-2">
          <FileText className="w-4 h-4" /> Reports & Requests
        </Button>
      </div>

      {/* Tab Area 0: Homeroom (Only accessible if is_class_teacher === true) */}
      {activeTab === 'homeroom' && dashboardData.homeroom && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-blue-900">Class Teacher Overview: {dashboardData.homeroom.class_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div>
                <p className="text-sm text-slate-600">Total Enrolled: <span className="font-bold text-slate-900">{dashboardData.homeroom.total_students}</span></p>
                <p className="text-sm text-slate-600">Daily Attendance Status: <span className="text-red-600 font-medium">Pending</span></p>
              </div>
              <div className="flex gap-2">
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><ClipboardCheck className="w-4 h-4" /> Mark Roll Register</Button>
                <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"><FileText className="w-4 h-4" /> Term Reports</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Area 1: Lesson Planning & Schemes of Work */}
      {activeTab === 'lessons' && (
        <Card>
          <CardHeader><CardTitle>Active Schemes of Work & KICD Progress Logs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button size="sm">Create New Scheme of Work</Button>
              <Button size="sm" variant="outline">Upload Lesson Plan PDF</Button>
            </div>
            <div className="p-8 border border-dashed rounded-lg text-center text-slate-500">
              No active lesson plans for this week.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Area 2: Record CBC Competency Matrix Descriptors */}
      {activeTab === 'grades' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assessment Configuration Parameters</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Select Learning Area Offering</label>
                <select className="w-full p-2 border rounded bg-background" onChange={(e) => handleCourseChange(e.target.value)}>
                  <option value="">-- Choose Class Offering --</option>
                  {dashboardData.teaching_subjects.map((c: any) => (
                    <option key={c.subject_code} value={c.subject_code}>
                      {c.class_name} - {c.subject_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Select KICD Sub-Strand Target</label>
                <select className="w-full p-2 border rounded bg-background disabled:opacity-50" disabled={!selectedCourse} onChange={(e) => setSelectedStrand(e.target.value)}>
                  <option value="">-- Choose Sub-Strand Target --</option>
                  {strands.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {selectedStrand && (
            <Card>
              <CardHeader><CardTitle>Granular Student Competency Evaluation</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {students.length === 0 ? (
                  <p className="text-sm text-slate-500">No students found for this class.</p>
                ) : (
                  students.map((student: any) => (
                    <div key={student.id} className="p-3 border rounded-lg flex items-center justify-between bg-background">
                      <span className="font-medium text-sm">{student.first_name} {student.last_name} ({student.admission_number})</span>
                      <select className="p-1.5 border rounded text-xs font-bold bg-muted/50">
                        <option value="4">EE (Exceeding Expectations)</option>
                        <option value="3">ME (Meeting Expectations)</option>
                        <option value="2">AE (Approaching Expectations)</option>
                        <option value="1">BE (Below Expectations)</option>
                      </select>
                    </div>
                  ))
                )}
                <Button className="mt-4 w-full">Save Term Formative Marks</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab Area 3: Co-Curricular Tracking */}
      {activeTab === 'clubs' && (
         <Card>
           {/* Your existing club code remains exactly the same here */}
         </Card>
      )}

      {/* Tab Area 4: Reports & Requests - everything filed to the HOD */}
      {activeTab === 'reports' && <RecentActivity data={dashboardData} />}
    </div>
  );
}

// ==================== Reports To ====================

function ReportingCard({ data }: { data: DashboardData }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-slate-700">
          <UserCog className="w-4 h-4" /> You Report To
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.reports_to.length === 0 ? (
          <p className="text-sm text-slate-500">No HOD has been assigned at your school yet. Contact your Admin.</p>
        ) : (
          <>
            {data.reports_to_is_fallback && (
              <p className="text-xs text-amber-600 mb-2">
                You're not yet linked to a specific department, so this shows every HOD at your school.
                Ask your Admin or HOD to add you to a department roster for a direct reporting line.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {data.reports_to.map(hod => (
                <div key={hod.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{hod.name}</p>
                    <p className="text-xs text-slate-500">{hod.department} Dept.</p>
                  </div>
                  <a href={`mailto:${hod.email}`} className="text-slate-400 hover:text-blue-600">
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Quick Actions ====================

function QuickActions({
  api, dashboardData, homeroomStudents, onOpenEscalate, onSubmitted
}: {
  api: ReturnType<typeof useApi>;
  dashboardData: DashboardData;
  homeroomStudents: { id: number; first_name: string; last_name: string }[];
  onOpenEscalate: () => void;
  onSubmitted: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <ProgressReportDialog api={api} onSubmitted={onSubmitted} />
      {dashboardData.is_class_teacher && (
        <EscalateDialog api={api} homeroomStudents={homeroomStudents} onOpen={onOpenEscalate} onSubmitted={onSubmitted} />
      )}
      <LeaveRequestDialog api={api} onSubmitted={onSubmitted} />
    </div>
  );
}

function ProgressReportDialog({ api, onSubmitted }: {
  api: ReturnType<typeof useApi>; 
  onSubmitted: () => void;
})
  
  {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<{ id: number; name: string; code: string }[]>([]);
  const [courseId, setCourseId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [topics, setTopics] = useState('');
  const [coverage, setCoverage] = useState('0');
  const [challenges, setChallenges] = useState('');
  const [blockers, setBlockers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && courses.length === 0) {
      const res = await api('/api/teacher/progress/my-classes');
      const data = await res.json();
      setCourses(data?.data || []);
    }
  };

  const handleSubmit = async () => {
    if (!courseId || !weekStart || !topics) {
      setError('Please fill in the subject, week, and topics covered.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api('/api/teacher/progress/reports', {
        method: 'POST',
        body: JSON.stringify({
          course_id: Number(courseId),
          week_start_date: weekStart,
          topics_covered: topics,
          syllabus_coverage_percent: Number(coverage),
          challenges: challenges || undefined,
          blockers: blockers || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to file report');
      setOpen(false);
      setCourseId(''); setWeekStart(''); setTopics(''); setCoverage('0'); setChallenges(''); setBlockers('');
      onSubmitted();
    } catch (e) {
      setError('Could not submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <FileText className="w-4 h-4" /> File Progress Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File a Progress Report</DialogTitle>
          <DialogDescription>This goes straight to your HOD's dashboard.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Subject</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select a subject you teach" /></SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Week Starting</Label>
            <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          </div>
          <div>
            <Label>Topics Covered</Label>
            <Textarea value={topics} onChange={e => setTopics(e.target.value)} placeholder="What did you teach this week?" />
          </div>
          <div>
            <Label>Syllabus Coverage (%)</Label>
            <Input type="number" min={0} max={100} value={coverage} onChange={e => setCoverage(e.target.value)} />
          </div>
          <div>
            <Label>Challenges (optional)</Label>
            <Textarea value={challenges} onChange={e => setChallenges(e.target.value)} />
          </div>
          <div>
            <Label>Blockers (optional)</Label>
            <Textarea value={blockers} onChange={e => setBlockers(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Report'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EscalateDialog({ api, homeroomStudents, onOpen, onSubmitted }: {
  api: ReturnType<typeof useApi>;
  homeroomStudents: { id: number; first_name: string; last_name: string }[];
  onOpen: () => void;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) onOpen();
  };

  const handleSubmit = async () => {
    if (!studentId || !reason) {
      setError('Please select a student and describe the concern.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api('/api/class-teacher/escalate', {
        method: 'POST',
        body: JSON.stringify({ student_id: Number(studentId), reason, details: details || undefined }),
      });
      if (!res.ok) throw new Error('Failed to escalate');
      setOpen(false);
      setStudentId(''); setReason(''); setDetails('');
      onSubmitted();
    } catch (e) {
      setError('Could not submit the escalation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
          <MessageSquareWarning className="w-4 h-4" /> Escalate a Concern
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate a Student Welfare Concern</DialogTitle>
          <DialogDescription>This notifies your HOD immediately so it doesn't wait for a scheduled check-in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select a student in your homeroom" /></SelectTrigger>
              <SelectContent>
                {homeroomStudents.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Repeated absenteeism" />
          </div>
          <div>
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting...' : 'Escalate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveRequestDialog({ api, onSubmitted }: { api: ReturnType<typeof useApi>; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      setError('Please fill in the dates and reason.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api('/api/leave-requests', {
        method: 'POST',
        body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setOpen(false);
      setStartDate(''); setEndDate(''); setReason('');
      onSubmitted();
    } catch (e) {
      setError('Could not submit the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarClock className="w-4 h-4" /> Request Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>Your HOD reviews this first, before it goes to Admin for final approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                <SelectItem value="Paternity Leave">Paternity Leave</SelectItem>
                <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Recent Activity ====================

function RecentActivity({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Progress Reports</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.recent_progress_reports.length === 0 ? (
            <p className="text-sm text-slate-500">No reports filed yet.</p>
          ) : (
            data.recent_progress_reports.map(r => (
              <div key={r.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm">{r.course_name}</p>
                  <Badge variant="secondary">{r.coverage_percent}% covered</Badge>
                </div>
                <p className="text-xs text-slate-500">Week of {r.week_start_date}</p>
                {r.comment_count > 0 && (
                  <p className="text-xs text-blue-600 mt-1">{r.comment_count} HOD comment{r.comment_count > 1 ? 's' : ''}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {data.is_class_teacher && (
        <Card>
          <CardHeader><CardTitle className="text-base">Escalations Filed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recent_escalations.length === 0 ? (
              <p className="text-sm text-slate-500">No concerns escalated yet.</p>
            ) : (
              data.recent_escalations.map(e => (
                <div key={e.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{e.student_name}</p>
                    <Badge variant={statusBadgeVariant(e.status)}>{e.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{e.reason} • {e.created_at}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Leave Requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.recent_leave_requests.length === 0 ? (
            <p className="text-sm text-slate-500">No leave requests yet.</p>
          ) : (
            data.recent_leave_requests.map(l => (
              <div key={l.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm">{l.leave_type}</p>
                  <Badge variant={statusBadgeVariant(l.status)}>{l.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">{l.start_date} → {l.end_date}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
