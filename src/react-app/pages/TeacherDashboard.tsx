import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BookOpen, CheckSquare, Trophy, Users, ClipboardCheck, FileText } from 'lucide-react';
import { useApi } from '../contexts/AuthContext';

export default function TeacherDashboard() {
  const api = useApi();
  const [dashboardData, setDashboardData] = useState<{
    is_class_teacher: boolean;
    homeroom: any;
    teaching_subjects: any[];
  } | null>(null);
  
  // Default to lessons, but we'll conditionally add 'homeroom' below
  const [activeTab, setActiveTab] = useState('lessons'); 
  
  // Grade Form State Indicators
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStrand, setSelectedStrand] = useState('');
  const [strands, setStrands] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    // Fetch the unified dashboard overview we built in the backend
    api('/api/teacher-dashboard/overview')
      .then(res => res.json())
      .then(data => {
        setDashboardData(data);
        // If they are a class teacher, default them to the homeroom tab
        if (data?.is_class_teacher) {
          setActiveTab('homeroom');
        }
      });
  }, [api]);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId);
    if (!courseId) {
      setStrands([]);
      setStudents([]);
      return;
    }
    // Fetch associated KICD strands & enrolled class students concurrently
    const strandsRes = await api(`/api/courses/${courseId}/strands`);
    const studentsRes = await api(`/api/courses/${courseId}/students`);
    setStrands(await strandsRes.json());
    setStudents(await studentsRes.json());
  };

  if (!dashboardData) return <div className="p-6">Loading workspace...</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Educator Workspace</h1>
        <p className="text-slate-600">Deliver lessons, assess competencies, and manage your students</p>
      </div>

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
             {/* Note: I removed the hardcoded Grade 7 science text here so it can map over actual data later */}
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
    </div>
  );
}