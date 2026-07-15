import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BookOpen, CheckSquare, Award, Trophy, Users } from 'lucide-react';
import { useApi } from '../contexts/AuthContext';

export default function TeacherDashboard() {
  const api = useApi();
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [activeTab, setActiveTab] = useState('lessons'); // lessons | grades | clubs
  
  // Grade Form State Indicators
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStrand, setSelectedStrand] = useState('');
  const [strands, setStrands] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    // Fetch courses where teacher_id matches current user profile context
    api('/api/courses/teacher-assignments')
      .then(res => res.json())
      .then(data => setAssignedCourses(data || []));
  }, [api]);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId);
    // Fetch associated KICD strands & enrolled class students concurrently
    const strandsRes = await api(`/api/courses/${courseId}/strands`);
    const studentsRes = await api(`/api/courses/${courseId}/students`);
    setStrands(await strandsRes.json());
    setStudents(await studentsRes.json());
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Subject Teacher Dashboard</h1>
        <p className="text-slate-600">Deliver lessons, assess competencies, and manage assigned learning areas</p>
      </div>

      {/* Primary Feature Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button variant={activeTab === 'lessons' ? 'default' : 'ghost'} onClick={() => setActiveTab('lessons')} className="gap-2">
          <BookOpen className="w-4 h-4" /> Lesson Planning & Schemes
        </Button>
        <Button variant={activeTab === 'grades' ? 'default' : 'ghost'} onClick={() => setActiveTab('grades')} className="gap-2">
          <CheckSquare className="w-4 h-4" /> Record CBC Competencies
        </Button>
        <Button variant={activeTab === 'clubs' ? 'default' : 'ghost'} onClick={() => setActiveTab('clubs')} className="gap-2">
          <Trophy className="w-4 h-4" /> Co-Curricular & Clubs
        </Button>
      </div>

      {/* Tab Area 1: Lesson Planning & Schemes of Work */}
      {activeTab === 'lessons' && (
        <Card>
          <CardHeader><CardTitle>Active Schemes of Work & KICD Progress Logs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button size="sm">Create New Scheme of Work</Button>
              <Button size="sm" variant="outline">Upload Lesson Plan PDF</Button>
            </div>
            <div className="p-4 border rounded-lg bg-muted/20 flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-sm">Grade 7 - Integrated Science (Term 2)</h4>
                <p className="text-xs text-muted-foreground">Strand: Matter | Sub-strand: Separating Mixtures</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">Approved by HOD</span>
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
                  {assignedCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.local_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Select KICD Sub-Strand Target</label>
                <select className="w-full p-2 border rounded bg-background" disabled={!selectedCourse} onChange={(e) => setSelectedStrand(e.target.value)}>
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
              <CardHeader><CardTitle>Granular Student Competency Evaluation Board</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {students.map((student: any) => (
                  <div key={student.id} className="p-3 border rounded-lg flex items-center justify-between bg-background">
                    <span className="font-medium text-sm">{student.first_name} {student.last_name} ({student.admission_number})</span>
                    <select className="p-1.5 border rounded text-xs font-bold bg-muted/50">
                      <option value="4">EE (Exceeding Expectations)</option>
                      <option value="3">ME (Meeting Expectations)</option>
                      <option value="2">AE (Approaching Expectations)</option>
                      <option value="1">BE (Below Expectations)</option>
                    </select>
                  </div>
                ))}
                <Button className="mt-4 w-full">Save Term Formative Marks</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab Area 3: Co-Curricular Tracking */}
      {activeTab === 'clubs' && (
        <Card>
          <CardHeader><CardTitle>Assigned Club Rosters & Activity Journals</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-xl space-y-2 bg-background">
              <h3 className="font-bold text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Scouting Movement</h3>
              <p className="text-xs text-muted-foreground">Meeting Schedule: Friday 14:00 - 16:00</p>
              <Button size="sm" variant="outline" className="w-full text-xs">Manage Club Roll Attendance</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}