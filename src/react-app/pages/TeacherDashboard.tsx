import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
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
  UserCog, MessageSquareWarning, CalendarClock, Mail, Upload,
  GraduationCap, Search, X, Loader2
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
  teaching_subjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
  reports_to: HODContact[];
  reports_to_is_fallback: boolean;
  recent_progress_reports: ProgressReportSummary[];
  recent_escalations: EscalationSummary[];
  recent_leave_requests: LeaveRequestSummary[];
}

interface LessonPlan {
  id: number;
  title: string;
  course_id: number | null;
  course_name: string | null;
  week_start_date: string | null;
  term: string | null;
  objectives: string | null;
  content: string | null;
  status: string;
  has_file: boolean;
  file_name: string | null;
  created_at: string | null;
}

interface ManagedStudent {
  id: number;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  grade: string;
  stream_section: string | null;
  status: string;
  is_homeroom_student: boolean;
  subjects_taught: string[];
}

interface StudentRecord {
  id: number;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  grade: string;
  stream_section: string | null;
  status: string;
  current_balance: number;
  attendance_summary: { status: string; count: number }[];
  recent_grades: { exam_title: string; course_name: string; score: number; max_score: number; term: string | null }[];
  discipline_records: { incident_type: string; severity: string; status: string; date: string | null }[];
}

interface AssignmentSummary {
  id: number;
  title: string;
  course_id: number;
  course_name: string;
  due_date: string | null;
  status: string;
  assignment_type: string;
  total_marks: number;
  total_students: number;
  graded_count: number;
  submitted_count: number;
}

interface AssignmentSubmissionRow {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  status: string;
  score: number | null;
  max_grade: number | null;
  is_late: boolean;
  submitted_at: string | null;
  submission_text: string | null;
  feedback: string | null;
}

interface TimetableSlotRow {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  grade_level: string | null;
  stream_section: string | null;
  course_name: string;
}

interface GuardianContact {
  id: number;
  name: string;
  relationship_label: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface GuardianMessage {
  id: number;
  student_id: number;
  student_name: string;
  guardian_contact_id: number | null;
  guardian_name: string | null;
  subject: string;
  body: string;
  created_at: string | null;
}

const statusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const s = status.toLowerCase();
  if (s.includes('reject')) return 'destructive';
  if (s.includes('approve') || s === 'resolved') return 'default';
  return 'secondary';
};

export default function TeacherDashboard() {
  const api = useApi();
  const navigate = useNavigate();
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
        <Button variant={activeTab === 'students' ? 'default' : 'ghost'} onClick={() => setActiveTab('students')} className="gap-2">
          <GraduationCap className="w-4 h-4" /> Manage Students
        </Button>
        <Button variant={activeTab === 'lessons' ? 'default' : 'ghost'} onClick={() => setActiveTab('lessons')} className="gap-2">
          <BookOpen className="w-4 h-4" /> Lesson Planning
        </Button>
        <Button variant={activeTab === 'grades' ? 'default' : 'ghost'} onClick={() => setActiveTab('grades')} className="gap-2">
          <CheckSquare className="w-4 h-4" /> CBC Competencies
        </Button>
        <Button variant={activeTab === 'assignments' ? 'default' : 'ghost'} onClick={() => setActiveTab('assignments')} className="gap-2">
          <ClipboardCheck className="w-4 h-4" /> Assignments
        </Button>
        <Button variant={activeTab === 'timetable' ? 'default' : 'ghost'} onClick={() => setActiveTab('timetable')} className="gap-2">
          <CalendarClock className="w-4 h-4" /> My Timetable
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
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => navigate('/dashboard/attendance')}><ClipboardCheck className="w-4 h-4" /> Mark Roll Register</Button>
                <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"><FileText className="w-4 h-4" /> Term Reports</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Area 0.5: Manage Students (every student the teacher is responsible for) */}
      {activeTab === 'students' && (
        <StudentsPanel api={api} />
      )}

      {/* Tab Area 1: Lesson Planning & Schemes of Work */}
      {activeTab === 'lessons' && (
        <LessonPlanningPanel api={api} teachingSubjects={dashboardData.teaching_subjects} />
      )}

      {/* Tab Area 1.5: Assignments & Homework */}
      {activeTab === 'assignments' && (
        <AssignmentsPanel api={api} teachingSubjects={dashboardData.teaching_subjects} />
      )}

      {/* Tab Area 1.7: My Timetable */}
      {activeTab === 'timetable' && (
        <MyTimetablePanel api={api} />
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

// ==================== Manage Students ====================

function StudentsPanel({ api }: { api: ReturnType<typeof useApi> }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allStudents, setAllStudents] = useState<ManagedStudent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/teacher-dashboard/my-students');
      const data = await res.json();
      setAllStudents(data?.data || []);
    } catch {
      setError('Could not load your students. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = allStudents.filter(s => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(term) ||
      (s.admission_number || '').toLowerCase().includes(term) ||
      s.grade.toLowerCase().includes(term)
    );
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle>Students You Teach</CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Search by name, admission no. or grade"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your students...
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              {allStudents.length === 0
                ? "No students found yet. You'll see students here once you're assigned a homeroom or a subject to teach."
                : 'No students match your search.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className="w-full text-left p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-slate-900">
                      {s.first_name} {s.last_name}
                      {s.admission_number && <span className="text-slate-400 font-normal"> · {s.admission_number}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.grade}{s.stream_section ? ` ${s.stream_section}` : ''}
                      {s.subjects_taught.length > 0 && ` · ${s.subjects_taught.join(', ')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.is_homeroom_student && <Badge variant="secondary">Homeroom</Badge>}
                    <Badge variant={s.status === 'active' ? 'default' : 'outline'}>{s.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudentId !== null && (
        <StudentRecordDialog api={api} studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />
      )}
    </>
  );
}

function StudentRecordDialog({ api, studentId, onClose }: {
  api: ReturnType<typeof useApi>;
  studentId: number;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api(`/api/teacher-dashboard/my-students/${studentId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setRecord(data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this student\'s record.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, studentId]);

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record ? `${record.first_name} ${record.last_name}` : 'Student Record'}
          </DialogTitle>
          {record && (
            <DialogDescription>
              {record.grade}{record.stream_section ? ` ${record.stream_section}` : ''}
              {record.admission_number ? ` · Adm No. ${record.admission_number}` : ''}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading record...
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : record ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={record.status === 'active' ? 'default' : 'outline'}>{record.status}</Badge>
              <Badge variant="secondary">Fee balance: KES {record.current_balance.toLocaleString()}</Badge>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Attendance Summary</h4>
              {record.attendance_summary.length === 0 ? (
                <p className="text-sm text-slate-500">No attendance recorded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {record.attendance_summary.map(a => (
                    <Badge key={a.status} variant="outline">{a.status}: {a.count}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Recent Grades</h4>
              {record.recent_grades.length === 0 ? (
                <p className="text-sm text-slate-500">No grades recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {record.recent_grades.map((g, i) => (
                    <div key={i} className="p-2 border rounded flex justify-between text-sm">
                      <span>{g.course_name} — {g.exam_title}{g.term ? ` (${g.term})` : ''}</span>
                      <span className="font-medium">{g.score}/{g.max_score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Discipline Records</h4>
              {record.discipline_records.length === 0 ? (
                <p className="text-sm text-slate-500">No discipline records.</p>
              ) : (
                <div className="space-y-1.5">
                  {record.discipline_records.map((d, i) => (
                    <div key={i} className="p-2 border rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{d.incident_type}</span>
                        <Badge variant={d.severity === 'Major' ? 'destructive' : 'secondary'}>{d.severity}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{d.status}{d.date ? ` · ${d.date}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <GuardianMessagingSection api={api} studentId={studentId} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GuardianMessagingSection({ api, studentId }: { api: ReturnType<typeof useApi>; studentId: number }) {
  const [guardians, setGuardians] = useState<GuardianContact[]>([]);
  const [messages, setMessages] = useState<GuardianMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gRes, mRes] = await Promise.all([
        api(`/api/teacher/students/${studentId}/guardians`),
        api(`/api/teacher/students/${studentId}/messages`),
      ]);
      setGuardians(await gRes.json());
      setMessages(await mRes.json());
    } catch {
      setError('Could not load guardian info.');
    } finally {
      setLoading(false);
    }
  }, [api, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">Guardians & Messages</h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddGuardian(true)}>Add Guardian</Button>
          <Button size="sm" onClick={() => setShowCompose(true)} disabled={guardians.length === 0}>
            <Mail className="w-4 h-4 mr-1" /> Message
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          {guardians.length === 0 ? (
            <p className="text-sm text-slate-500">No guardian contacts on file yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-2">
              {guardians.map(g => (
                <Badge key={g.id} variant="outline">
                  {g.name}{g.relationship_label ? ` (${g.relationship_label})` : ''}{g.is_primary ? ' · Primary' : ''}
                </Badge>
              ))}
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {messages.map(m => (
                <div key={m.id} className="p-2 border rounded text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{m.subject}</span>
                    <span className="text-xs text-slate-500">{m.created_at}</span>
                  </div>
                  <p className="text-slate-600">{m.body}</p>
                  {m.guardian_name && <p className="text-xs text-slate-400 mt-0.5">To: {m.guardian_name}</p>}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 mt-2">
            Messages are logged here for the school's records; this project has no SMS/email provider configured yet, so nothing is sent externally.
          </p>
        </>
      )}

      {showAddGuardian && (
        <AddGuardianDialog api={api} studentId={studentId} onClose={() => setShowAddGuardian(false)} onAdded={load} />
      )}
      {showCompose && (
        <ComposeGuardianMessageDialog
          api={api} studentId={studentId} guardians={guardians}
          onClose={() => setShowCompose(false)} onSent={load}
        />
      )}
    </div>
  );
}

function AddGuardianDialog({ api, studentId, onClose, onAdded }: {
  api: ReturnType<typeof useApi>; studentId: number; onClose: () => void; onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Guardian name is required.'); return; }
    if (!phone.trim() && !email.trim()) { setError('Provide a phone number or an email.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api(`/api/teacher/students/${studentId}/guardians`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          relationship_label: relationshipLabel || undefined,
          phone: phone || undefined,
          email: email || undefined,
          is_primary: isPrimary,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to add guardian');
      }
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add guardian.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Guardian Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Wanjiru" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Relationship</Label>
              <Input value={relationshipLabel} onChange={e => setRelationshipLabel(e.target.value)} placeholder="Mother, Father, Guardian..." />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
                Primary contact
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guardian@example.com" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Add Guardian'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComposeGuardianMessageDialog({ api, studentId, guardians, onClose, onSent }: {
  api: ReturnType<typeof useApi>; studentId: number; guardians: GuardianContact[]; onClose: () => void; onSent: () => void;
}) {
  const [guardianId, setGuardianId] = useState(guardians.find(g => g.is_primary)?.id ? String(guardians.find(g => g.is_primary)!.id) : String(guardians[0]?.id || ''));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim() || !body.trim()) { setError('Subject and message are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api(`/api/teacher/students/${studentId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          guardian_contact_id: guardianId ? Number(guardianId) : undefined,
          subject,
          body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to send message');
      }
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message Guardian</DialogTitle>
          <DialogDescription>Logged to the school record. No SMS/email provider is configured, so this isn't dispatched externally yet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>To</Label>
            <Select value={guardianId} onValueChange={setGuardianId}>
              <SelectTrigger><SelectValue placeholder="Select a guardian" /></SelectTrigger>
              <SelectContent>
                {guardians.map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}{g.relationship_label ? ` (${g.relationship_label})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Missed homework this week" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Sending...' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Lesson Planning ====================

function LessonPlanningPanel({ api, teachingSubjects }: {
  api: ReturnType<typeof useApi>;
  teachingSubjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
}) {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/teacher/lesson-plans');
      const data = await res.json();
      setPlans(data?.data || []);
    } catch {
      setError('Could not load your lesson plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (plan: LessonPlan) => {
    const res = await api(`/api/teacher/lesson-plans/${plan.id}/file`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plan.file_name || `lesson-plan-${plan.id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDelete = async (plan: LessonPlan) => {
    if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    await api(`/api/teacher/lesson-plans/${plan.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle>Active Schemes of Work & Lesson Plans</CardTitle>
        <div className="flex gap-2">
          <CreateSchemeDialog api={api} teachingSubjects={teachingSubjects} onCreated={load} />
          <UploadLessonPlanDialog api={api} teachingSubjects={teachingSubjects} onCreated={load} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading lesson plans...
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : plans.length === 0 ? (
          <div className="p-8 border border-dashed rounded-lg text-center text-slate-500">
            No active lesson plans for this week. Create a scheme of work or upload a PDF to get started.
          </div>
        ) : (
          plans.map(plan => (
            <div key={plan.id} className="p-3 border rounded-lg flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-slate-900">{plan.title}</p>
                  <Badge variant={plan.status === 'submitted' ? 'default' : 'secondary'}>{plan.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {plan.course_name || 'No subject linked'}
                  {plan.week_start_date && ` · Week of ${plan.week_start_date}`}
                  {plan.term && ` · ${plan.term}`}
                </p>
                {plan.objectives && <p className="text-sm text-slate-600 mt-1">{plan.objectives}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {plan.has_file && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(plan)}>
                    {plan.file_name || 'Download'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(plan)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CreateSchemeDialog({ api, teachingSubjects, onCreated }: {
  api: ReturnType<typeof useApi>;
  teachingSubjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [objectives, setObjectives] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle(''); setCourseId(''); setWeekStart(''); setObjectives(''); setContent('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please give this scheme of work a title.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api('/api/teacher/lesson-plans', {
        method: 'POST',
        body: JSON.stringify({
          title,
          course_id: courseId ? Number(courseId) : undefined,
          week_start_date: weekStart || undefined,
          objectives: objectives || undefined,
          content: content || undefined,
          status: 'draft',
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      setOpen(false);
      reset();
      onCreated();
    } catch {
      setError('Could not create the scheme of work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create New Scheme of Work</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Scheme of Work</DialogTitle>
          <DialogDescription>Outline what you'll cover — you can edit or submit it later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Term 2 Week 3 — Fractions" />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select a subject you teach (optional)" /></SelectTrigger>
              <SelectContent>
                {teachingSubjects.map(c => (
                  <SelectItem key={c.course_id} value={String(c.course_id)}>{c.class_name} - {c.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Week Starting</Label>
            <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          </div>
          <div>
            <Label>Objectives</Label>
            <Textarea value={objectives} onChange={e => setObjectives(e.target.value)} placeholder="What should students be able to do by the end?" />
          </div>
          <div>
            <Label>Content / Notes</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Lesson content, activities, resources..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Scheme of Work'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadLessonPlanDialog({ api, teachingSubjects, onCreated }: {
  api: ReturnType<typeof useApi>;
  teachingSubjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please give this lesson plan a title.');
      return;
    }
    if (!file) {
      setError('Please choose a PDF or Word file to upload.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', title);
      if (courseId) formData.append('course_id', courseId);
      formData.append('file', file);

      const res = await api('/api/teacher/lesson-plans/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload');
      setOpen(false);
      setTitle(''); setCourseId(''); setFile(null);
      onCreated();
    } catch {
      setError('Could not upload the lesson plan. Please check the file and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="w-4 h-4" /> Upload Lesson Plan PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a Lesson Plan</DialogTitle>
          <DialogDescription>Accepts PDF or Word documents, up to 10MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Grade 5 Science — Week 4" />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select a subject you teach (optional)" /></SelectTrigger>
              <SelectContent>
                {teachingSubjects.map(c => (
                  <SelectItem key={c.course_id} value={String(c.course_id)}>{c.class_name} - {c.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File</Label>
            <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Uploading...' : 'Upload'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Assignments & Homework ====================

function AssignmentsPanel({ api, teachingSubjects }: {
  api: ReturnType<typeof useApi>;
  teachingSubjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
}) {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradingAssignment, setGradingAssignment] = useState<AssignmentSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/assignments');
      const data = await res.json();
      setAssignments(data?.data || []);
    } catch {
      setError('Could not load your assignments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (assignment: AssignmentSummary) => {
    if (!window.confirm(`Delete "${assignment.title}"? This cannot be undone.`)) return;
    await api(`/api/assignments/${assignment.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle>Assignments & Homework</CardTitle>
          <CreateAssignmentDialog api={api} teachingSubjects={teachingSubjects} onCreated={load} />
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading assignments...
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : assignments.length === 0 ? (
            <div className="p-8 border border-dashed rounded-lg text-center text-slate-500">
              No assignments yet. Create one to start collecting and grading student work.
            </div>
          ) : (
            assignments.map(a => (
              <button
                key={a.id}
                onClick={() => setGradingAssignment(a)}
                className="w-full text-left p-3 border rounded-lg flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-slate-900">{a.title}</p>
                    <Badge variant="secondary">{a.assignment_type}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {a.course_name}
                    {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString()}`}
                    {` · Out of ${a.total_marks}`}
                  </p>
                  {a.total_students > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {a.submitted_count}/{a.total_students} submitted · {a.graded_count}/{a.total_students} graded
                    </p>
                  )}
                </div>
                <Button
                  size="sm" variant="ghost" className="text-red-600 hover:text-red-700 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {gradingAssignment && (
        <AssignmentSubmissionsDialog
          api={api}
          assignment={gradingAssignment}
          onClose={() => setGradingAssignment(null)}
          onGraded={load}
        />
      )}
    </>
  );
}

function CreateAssignmentDialog({ api, teachingSubjects, onCreated }: {
  api: ReturnType<typeof useApi>;
  teachingSubjects: { course_id: number; class_name: string; subject_name: string; subject_code: string | null }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignmentType, setAssignmentType] = useState('homework');
  const [maxScore, setMaxScore] = useState('100');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Please give the assignment a title.'); return; }
    if (!courseId) { setError('Please select a subject.'); return; }
    if (!dueDate) { setError('Please set a due date.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await api('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title,
          course_id: Number(courseId),
          due_date: dueDate,
          max_score: Number(maxScore) || 100,
          assignment_type: assignmentType,
          description: description || undefined,
          instructions: instructions || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Failed to create');
      }
      setOpen(false);
      setTitle(''); setCourseId(''); setDueDate(''); setDescription(''); setInstructions(''); setMaxScore('100');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><ClipboardCheck className="w-4 h-4" /> New Assignment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an Assignment</DialogTitle>
          <DialogDescription>Every student enrolled in the subject will appear in your grading list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 4 Worksheet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {teachingSubjects.map(c => (
                    <SelectItem key={c.course_id} value={String(c.course_id)}>{c.class_name} - {c.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={assignmentType} onValueChange={setAssignmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homework">Homework</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Total Marks</Label>
              <Input type="number" min="1" value={maxScore} onChange={e => setMaxScore(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this assignment about?" />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instructions for students..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating...' : 'Create Assignment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentSubmissionsDialog({ api, assignment, onClose, onGraded }: {
  api: ReturnType<typeof useApi>;
  assignment: AssignmentSummary;
  onClose: () => void;
  onGraded: () => void;
}) {
  const [submissions, setSubmissions] = useState<AssignmentSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/api/assignments/${assignment.id}/submissions`);
      const data = await res.json();
      setSubmissions(data?.data || []);
    } catch {
      setError('Could not load submissions.');
    } finally {
      setLoading(false);
    }
  }, [api, assignment.id]);

  useEffect(() => {
    load();
  }, [load]);

  const startGrading = (row: AssignmentSubmissionRow) => {
    setGradingId(row.id);
    setScoreDraft(row.score !== null ? String(row.score) : '');
    setFeedbackDraft(row.feedback || '');
  };

  const saveGrade = async (submissionId: number) => {
    if (scoreDraft === '' || isNaN(Number(scoreDraft))) return;
    setSaving(true);
    try {
      await api(`/api/assignments/submissions/${submissionId}/grade`, {
        method: 'POST',
        body: JSON.stringify({ grade: Number(scoreDraft), feedback: feedbackDraft || undefined }),
      });
      setGradingId(null);
      await load();
      onGraded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment.title}</DialogTitle>
          <DialogDescription>{assignment.course_name} · Out of {assignment.total_marks} marks</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading submissions...
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            No students are enrolled in this subject yet, so there's nothing to grade.
          </p>
        ) : (
          <div className="space-y-2">
            {submissions.map(s => (
              <div key={s.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {s.first_name} {s.last_name}
                      {s.admission_number && <span className="text-slate-400 font-normal"> · {s.admission_number}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.status === 'graded' ? `Graded: ${s.score}/${assignment.total_marks}` :
                       s.status === 'submitted' ? 'Submitted, awaiting grade' : 'Not submitted yet'}
                      {s.is_late && ' · Late'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === 'graded' ? 'default' : s.status === 'submitted' ? 'secondary' : 'outline'}>
                      {s.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => startGrading(s)}>
                      {s.status === 'graded' ? 'Edit Grade' : 'Grade'}
                    </Button>
                  </div>
                </div>

                {s.submission_text && (
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded p-2">{s.submission_text}</p>
                )}

                {gradingId === s.id && (
                  <div className="mt-3 flex items-end gap-2 flex-wrap">
                    <div className="w-24">
                      <Label>Score</Label>
                      <Input type="number" min="0" max={assignment.total_marks} value={scoreDraft} onChange={e => setScoreDraft(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <Label>Feedback</Label>
                      <Input value={feedbackDraft} onChange={e => setFeedbackDraft(e.target.value)} placeholder="Optional feedback" />
                    </div>
                    <Button size="sm" onClick={() => saveGrade(s.id)} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== My Timetable ====================

function MyTimetablePanel({ api }: { api: ReturnType<typeof useApi> }) {
  const [slots, setSlots] = useState<TimetableSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api('/api/teacher-dashboard/my-timetable')
      .then(res => res.json())
      .then(data => { if (!cancelled) setSlots(data?.data || []); })
      .catch(() => { if (!cancelled) setError('Could not load your timetable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const byDay = days.map(day => ({
    day,
    slots: slots.filter(s => s.day_of_week === day).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Weekly Timetable</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading timetable...
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : slots.length === 0 ? (
          <div className="p-8 border border-dashed rounded-lg text-center text-slate-500">
            No timetable slots have been assigned to you yet. Once the timetable manager schedules your classes, they'll show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {byDay.map(({ day, slots: daySlots }) => (
              <div key={day}>
                <p className="text-sm font-semibold text-slate-700 mb-2">{day}</p>
                <div className="space-y-2">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400">No classes</p>
                  ) : (
                    daySlots.map(s => (
                      <div key={s.id} className="p-2 border rounded-lg bg-slate-50">
                        <p className="text-xs font-medium text-slate-900">{s.start_time}–{s.end_time}</p>
                        <p className="text-sm text-slate-800">{s.course_name}</p>
                        <p className="text-xs text-slate-500">
                          {s.grade_level}{s.stream_section ? ` ${s.stream_section}` : ''}
                          {s.room && ` · ${s.room}`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
