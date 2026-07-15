import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ClipboardList, FileText, Landmark, ShieldAlert } from 'lucide-react';
import { useApi } from '../contexts/AuthContext';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  admission_number: string;
  current_balance: number;
}

export default function ClassTeacherDashboard() {
  const api = useApi();
  const [classDetails, setClassDetails] = useState<any>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState('attendance'); 

  // Local Form States
  const [attendance, setAttendance] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [selectedTerm, setSelectedTerm] = useState<number>(1);
  
  // Escalation State
  const [escalationStudent, setEscalationStudent] = useState<Student | null>(null);
  const [escalationReason, setEscalationReason] = useState('Behavioral Issue');
  const [escalationDetails, setEscalationDetails] = useState('');

  useEffect(() => {
    // Corrected target endpoint link
    api('/api/class-teacher/my-managed-stream')
      .then(res => res.json())
      .then(data => {
        setClassDetails(data.stream_info);
        setRoster(data.students || []);
        
        // Default student attendance logs to "present"
        const initialAttendance: Record<number, string> = {};
        data.students?.forEach((s: Student) => {
          initialAttendance[s.id] = 'present';
        });
        setAttendance(initialAttendance);
      });
  }, [api]);

  const handleAttendanceChange = (studentId: number, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    const entries = Object.keys(attendance).map(id => ({
      student_id: parseInt(id),
      status: attendance[parseInt(id)],
      remarks: ""
    }));

    try {
      const response = await api('/api/class-teacher/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          entries
        })
      });
      if (response.ok) alert("Daily attendance log committed successfully!");
    } catch (err) {
      console.error("Error committing attendance:", err);
    }
  };

  const handleSaveRemark = async (studentId: number) => {
    try {
      const response = await api('/api/class-teacher/remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          term: selectedTerm,
          remarks: remarks[studentId] || ""
        })
      });
      if (response.ok) alert("Narrative review remarks saved.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscalate = async () => {
    if (!escalationStudent) return;
    try {
      const response = await api('/api/class-teacher/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: escalationStudent.id,
          reason: escalationReason,
          details: escalationDetails
        })
      });
      if (response.ok) {
        alert(`Welfare alert successfully triggered for ${escalationStudent.first_name}`);
        setEscalationStudent(null);
        setEscalationDetails("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Class Teacher Workspace</h1>
        <p className="text-slate-600">
          Holistic tracking environment for {classDetails ? `${classDetails.grade_level} ${classDetails.stream_section}` : 'Loading assigned stream...'}
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button variant={activeTab === 'attendance' ? 'default' : 'ghost'} onClick={() => setActiveTab('attendance')} className="gap-2">
          <ClipboardList className="w-4 h-4" /> Daily Register Attendance
        </Button>
        <Button variant={activeTab === 'report-cards' ? 'default' : 'ghost'} onClick={() => setActiveTab('report-cards')} className="gap-2">
          <FileText className="w-4 h-4" /> Compile Composite Report Cards
        </Button>
        <Button variant={activeTab === 'administrative' ? 'default' : 'ghost'} onClick={() => setActiveTab('administrative')} className="gap-2">
          <Landmark className="w-4 h-4" /> Financial Balances & Welfare
        </Button>
      </div>

      {activeTab === 'attendance' && (
        <Card>
          <CardHeader><CardTitle>Daily Roll-Call Register Board</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roster.map((student) => {
              const currentStatus = attendance[student.id] || 'present';
              return (
                <div key={student.id} className="p-3 border rounded-xl flex items-center justify-between bg-background shadow-sm">
                  <span className="font-semibold text-sm text-slate-800">{student.first_name} {student.last_name}</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAttendanceChange(student.id, 'present')} variant={currentStatus === 'present' ? 'default' : 'outline'} className={currentStatus === 'present' ? "bg-green-600 text-white text-xs px-3 py-1" : "text-xs px-3 py-1"}>Present</Button>
                    <Button size="sm" onClick={() => handleAttendanceChange(student.id, 'absent')} variant={currentStatus === 'absent' ? 'destructive' : 'outline'} className={currentStatus === 'absent' ? "bg-red-600 text-white text-xs px-3 py-1" : "text-xs px-3 py-1"}>Absent</Button>
                    <Button size="sm" onClick={() => handleAttendanceChange(student.id, 'late')} variant={currentStatus === 'late' ? 'secondary' : 'outline'} className={currentStatus === 'late' ? "bg-amber-500 text-white text-xs px-3 py-1" : "text-xs px-3 py-1"}>Late</Button>
                  </div>
                </div>
              );
            })}
            <Button onClick={submitAttendance} className="mt-4 w-full bg-slate-900 text-white">Commit Final Attendance Log</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'report-cards' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Composite Term Progress Summary & Narrative Comments</CardTitle>
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(parseInt(e.target.value))} className="p-2 border text-sm rounded-md">
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {roster.map((student) => (
              <div key={student.id} className="p-4 border rounded-xl bg-background space-y-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-slate-800">{student.first_name} {student.last_name}</h4>
                  <Button size="sm" onClick={() => handleSaveRemark(student.id)}>Save Comment</Button>
                </div>
                <textarea 
                  className="w-full text-xs p-2 border rounded-md bg-muted/40 placeholder:text-muted-foreground" 
                  placeholder="Enter custom Class Teacher summative review remarks here..."
                  rows={2}
                  value={remarks[student.id] || ""}
                  onChange={(e) => setRemarks({ ...remarks, [student.id]: e.target.value })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'administrative' && (
        <Card>
          <CardHeader><CardTitle>Fee Overviews & Welfare Escalation Control</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roster.map((student) => (
              <div key={student.id} className="p-3 border rounded-xl flex items-center justify-between bg-background shadow-sm">
                <div>
                  <span className="font-semibold text-sm text-slate-800">{student.first_name} {student.last_name}</span>
                  <p className="text-xs text-muted-foreground">Outstanding Fee Invoice Balance: KES {student.current_balance?.toLocaleString() || '0'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {student.current_balance > 0 && <Badge className="bg-red-100 text-red-800 text-xs">Arrears</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setEscalationStudent(student)} className="text-xs gap-1 text-amber-700 border-amber-600 hover:bg-amber-50">
                    <ShieldAlert className="w-3.5 h-3.5" /> Escalate Concern
                  </Button>
                </div>
              </div>
            ))}

            {escalationStudent && (
              <div className="mt-6 p-4 border border-amber-200 rounded-xl bg-amber-50/50 space-y-3">
                <h3 className="font-semibold text-amber-900 text-sm">Escalate Welfare Alert for: {escalationStudent.first_name} {escalationStudent.last_name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Reason Code</label>
                    <select value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="p-2 w-full text-xs border rounded-md bg-white">
                      <option value="Chronic Absenteeism">Chronic Absenteeism</option>
                      <option value="Behavioral Issue">Behavioral Issue</option>
                      <option value="Fee Balance">Fee Balance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-800 mb-1">Supporting Details</label>
                    <input type="text" value={escalationDetails} onChange={(e) => setEscalationDetails(e.target.value)} className="p-2 w-full text-xs border rounded-md bg-white" placeholder="Contextual observations..."/>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEscalationStudent(null)}>Cancel</Button>
                  <Button size="sm" className="bg-amber-700 text-white" onClick={handleEscalate}>Submit Escalation</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}