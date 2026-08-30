import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useApi, useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, ArrowRightLeft, FileText, Search, Upload, Download, AlertTriangle } from 'lucide-react';

interface Student {
  id: number;
  admission_number: string;
  upi_number: string;
  first_name: string;
  last_name: string;
  gender: string;
  dob: string;
  current_class: string;
  status: string;
  status_reason?: string;
}

export const RegistrarDashboard = () => {
  const { user } = useAuth();
  const apiFetch = useApi();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States for Workflows
  const [admissionForm, setAdmissionForm] = useState({
    first_name: '', last_name: '', gender: 'Male', dob: '', upi_number: '', previous_school: '', current_class: '',
    guardian_name: '', guardian_phone: '', guardian_relation: 'Parent'
  });
  const [promotionForm, setPromotionForm] = useState({ from_class: '', to_class: '' });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/registrar/students');
      const data = await res.json();
      setStudents(data.data || data || []);
    } catch (err) {
      console.error("Failed to load registrar data", err);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/registrar/admit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admissionForm)
      });
      if (res.ok) {
        alert("Student successfully admitted & Guardian linked.");
        loadData();
      }
    } catch (err) { alert("Failed to admit student."); }
  };

  const handleBulkPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/registrar/classes/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promotionForm)
      });
      if (res.ok) {
        alert(`Successfully promoted students from ${promotionForm.from_class} to ${promotionForm.to_class}`);
        loadData();
      }
    } catch (err) { alert("Promotion failed."); }
  };

  const handleGenerateCertificate = async (id: number, type: string) => {
    alert(`Generating ${type} Certificate for Student ID: ${id}...`);
    // Calls API: POST /api/registrar/students/{id}/certificate/{type}
  };

  const filteredStudents = students.filter(s => 
    `${s.first_name} ${s.last_name} ${s.admission_number} ${s.upi_number}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user || !['admin', 'super_admin', 'registrar'].includes(user.role)) {
    return <div className="p-6">Access Denied.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Registrar Office</h1>
          <p className="text-gray-600">Custodian of student records, CBC compliance, and progression.</p>
        </div>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList className="bg-white border p-1 rounded-md">
          <TabsTrigger value="directory" className="flex gap-2"><Users className="w-4 h-4" /> Student Records</TabsTrigger>
          <TabsTrigger value="admissions" className="flex gap-2"><UserPlus className="w-4 h-4" /> Admissions</TabsTrigger>
          <TabsTrigger value="progression" className="flex gap-2"><ArrowRightLeft className="w-4 h-4" /> Progression & Status</TabsTrigger>
          <TabsTrigger value="certificates" className="flex gap-2"><FileText className="w-4 h-4" /> Certificates</TabsTrigger>
        </TabsList>

        {/* 1. DIRECTORY TAB */}
        <TabsContent value="directory" className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 border rounded shadow-sm">
            <div className="flex items-center gap-2 w-full max-w-md border px-3 py-2 rounded">
              <Search className="w-4 h-4 text-gray-400" />
              <input 
                className="outline-none w-full text-sm" 
                placeholder="Search by name, Adm No, or NEMIS UPI..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2"><Upload className="w-4 h-4"/> Sync NEMIS</Button>
              <Button variant="outline" className="gap-2"><Download className="w-4 h-4"/> Export Roster</Button>
            </div>
          </div>

          <div className="bg-white border rounded shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-3">Adm No.</th>
                  <th className="p-3">NEMIS UPI</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Gender / DOB</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold text-blue-600">{student.admission_number}</td>
                    <td className="p-3 text-gray-500">{student.upi_number || 'Pending'}</td>
                    <td className="p-3 font-medium">{student.first_name} {student.last_name}</td>
                    <td className="p-3">{student.gender} <br/><span className="text-xs text-gray-400">{student.dob}</span></td>
                    <td className="p-3">{student.current_class}</td>
                    <td className="p-3">
                      <Badge variant={student.status === 'Active' ? 'default' : 'destructive'}>{student.status}</Badge>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" className="text-blue-600">Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 2. HOLISTIC ADMISSIONS TAB */}
        <TabsContent value="admissions">
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>Enroll New Student</CardTitle>
              <CardDescription>Creates student biodata, links guardian contacts, and generates Admission Number.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdmissionSubmit} className="space-y-6">
                
                {/* Biodata Section */}
                <div className="p-4 border rounded bg-gray-50 space-y-4">
                  <h3 className="font-semibold text-gray-700">1. Student Biodata & Academic Placement</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>First Name</Label><Input required value={admissionForm.first_name} onChange={e => setAdmissionForm({...admissionForm, first_name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Last Name</Label><Input required value={admissionForm.last_name} onChange={e => setAdmissionForm({...admissionForm, last_name: e.target.value})} /></div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <select className="w-full border rounded p-2 text-sm bg-white" value={admissionForm.gender} onChange={e => setAdmissionForm({...admissionForm, gender: e.target.value})}>
                        <option>Male</option><option>Female</option>
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" required value={admissionForm.dob} onChange={e => setAdmissionForm({...admissionForm, dob: e.target.value})} /></div>
                    <div className="space-y-2"><Label>NEMIS UPI (If transferring)</Label><Input value={admissionForm.upi_number} onChange={e => setAdmissionForm({...admissionForm, upi_number: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Target Class/Stream</Label><Input required value={admissionForm.current_class} placeholder="e.g. Grade 7 East" onChange={e => setAdmissionForm({...admissionForm, current_class: e.target.value})} /></div>
                  </div>
                </div>

                {/* Guardian Section */}
                <div className="p-4 border rounded bg-gray-50 space-y-4">
                  <h3 className="font-semibold text-gray-700">2. Primary Guardian / Next of Kin</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Full Name</Label><Input required value={admissionForm.guardian_name} onChange={e => setAdmissionForm({...admissionForm, guardian_name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Phone Number</Label><Input required value={admissionForm.guardian_phone} onChange={e => setAdmissionForm({...admissionForm, guardian_phone: e.target.value})} /></div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <select className="w-full border rounded p-2 text-sm bg-white" value={admissionForm.guardian_relation} onChange={e => setAdmissionForm({...admissionForm, guardian_relation: e.target.value})}>
                        <option>Parent</option><option>Guardian</option><option>Sibling</option><option>Sponsor</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6" disabled={isLoading}>Complete Admission</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. PROGRESSION & STATUS TAB */}
        <TabsContent value="progression" className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Promotion</CardTitle>
              <CardDescription>Advance an entire stream to the next grade at end-of-year.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBulkPromotion} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Class (From)</Label>
                  <Input required placeholder="e.g., Grade 7 East" value={promotionForm.from_class} onChange={e => setPromotionForm({...promotionForm, from_class: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Target Class (To)</Label>
                  <Input required placeholder="e.g., Grade 8 East" value={promotionForm.to_class} onChange={e => setPromotionForm({...promotionForm, to_class: e.target.value})} />
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Execute Bulk Promotion</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-orange-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Update Student Status</CardTitle>
              <CardDescription className="text-orange-700">Process transfers out, graduations, or suspensions.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2"><Label>Admission Number</Label><Input placeholder="Search student..." /></div>
              <div className="space-y-2">
                <Label>New Status</Label>
                <select className="w-full border rounded p-2 text-sm bg-white">
                  <option>Transferred</option><option>Graduated</option><option>Suspended</option><option>Withdrawn</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Reason / Destination School</Label><Input placeholder="e.g., Relocated to Kisumu" /></div>
              <Button className="w-full" variant="destructive">Update Status</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. CERTIFICATES TAB */}
        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle>Official Documents</CardTitle>
              <CardDescription>Generate stamped leaving certificates and provisional transcripts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 w-full max-w-md border px-3 py-2 rounded">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input className="outline-none w-full text-sm" placeholder="Lookup student to generate document..." />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <Button onClick={() => handleGenerateCertificate(1, 'Leaving')} variant="outline" className="h-24 flex flex-col gap-2"><FileText className="w-6 h-6 text-blue-600"/> Generate Leaving Certificate</Button>
                  <Button onClick={() => handleGenerateCertificate(1, 'Transfer')} variant="outline" className="h-24 flex flex-col gap-2"><ArrowRightLeft className="w-6 h-6 text-green-600"/> Generate Transfer Letter</Button>
                  <Button onClick={() => handleGenerateCertificate(1, 'Transcript')} variant="outline" className="h-24 flex flex-col gap-2"><FileText className="w-6 h-6 text-orange-600"/> Print Termly Transcript</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default RegistrarDashboard;