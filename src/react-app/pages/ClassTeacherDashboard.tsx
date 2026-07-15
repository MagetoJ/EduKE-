import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ClipboardList, FileText, Landmark, ShieldAlert } from 'lucide-react';
import { useApi } from '../contexts/AuthContext';

export default function ClassTeacherDashboard() {
  const api = useApi();
  const [classDetails, setClassDetails] = useState<any>(null);
  const [roster, setRoster] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance'); // attendance | report-cards | administrative

  useEffect(() => {
    // Fetch structural stream managed by this class teacher user
    api('/api/courses/my-managed-stream')
      .then(res => res.json())
      .then(data => {
        setClassDetails(data.stream_info);
        setRoster(data.students || []);
      });
  }, [api]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Class Teacher Workspace</h1>
          <p className="text-slate-600">
            Holistic tracking environment for {classDetails ? `${classDetails.grade_level} ${classDetails.stream_section}` : 'Loading assigned stream...'}
          </p>
        </div>
      </div>

      {/* Management Action Group Filters */}
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

      {/* Subsection Tab 1: Daily Register */}
      {activeTab === 'attendance' && (
        <Card>
          <CardHeader><CardTitle>Daily Roll-Call Register Board</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roster.map((student: any) => (
              <div key={student.id} className="p-3 border rounded-xl flex items-center justify-between bg-background shadow-sm">
                <span className="font-semibold text-sm text-slate-800">{student.first_name} {student.last_name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" className="bg-green-600 text-white text-xs px-3 py-1">Present</Button>
                  <Button size="sm" variant="destructive" className="bg-red-600 text-white text-xs px-3 py-1">Absent</Button>
                  <Button size="sm" variant="outline" className="text-xs px-3 py-1">Late</Button>
                </div>
              </div>
            ))}
            <Button className="mt-4 w-full bg-slate-900 text-white">Commit Final Attendance Log</Button>
          </CardContent>
        </Card>
      )}

      {/* Subsection Tab 2: Holistic Composite Progress Compilation */}
      {activeTab === 'report-cards' && (
        <Card>
          <CardHeader><CardTitle>Composite Term Progress Summary & Narrative Comments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Add overall behavioral recommendations alongside learning area summaries.</p>
            {roster.map((student: any) => (
              <div key={student.id} className="p-4 border rounded-xl bg-background space-y-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-slate-800">{student.first_name} {student.last_name}</h4>
                  <Button size="sm" variant="outline">Preview Full Marks Slate</Button>
                </div>
                <textarea 
                  className="w-full text-xs p-2 border rounded-md bg-muted/40 placeholder:text-muted-foreground" 
                  placeholder="Enter custom Class Teacher summative review remarks here..."
                  rows={2}
                />
              </div>
            ))}
            <Button className="w-full">Publish and Dispatch Report Cards</Button>
          </CardContent>
        </Card>
      )}

      {/* Subsection Tab 3: Financial & Welfare Status Overviews */}
      {activeTab === 'administrative' && (
        <Card>
          <CardHeader><CardTitle>Fee Overviews & Welfare Escalation Control</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roster.map((student: any) => (
              <div key={student.id} className="p-3 border rounded-xl flex items-center justify-between bg-background shadow-sm">
                <div>
                  <span className="font-semibold text-sm text-slate-800">{student.first_name} {student.last_name}</span>
                  <p className="text-xs text-muted-foreground">Outstanding Fee Invoice Balance: KES {student.current_balance?.toLocaleString() || '0'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {student.current_balance > 0 && <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">Arrears</Badge>}
                  <Button size="sm" variant="outline" className="text-xs gap-1 text-amber-700 border-amber-600 hover:bg-amber-50">
                    <ShieldAlert className="w-3.5 h-3.5" /> Escalate Concern
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}