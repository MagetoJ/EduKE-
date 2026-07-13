import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

type Subject = {
  id: number;
  name: string;
  code: string;
};

export default function Subjects() {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '' });

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/academic/subjects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // Handle both {data: [...]} and raw array responses
      setSubjects(data.data || data || []);
    } catch (error) {
      console.error("Failed to fetch subjects", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/academic/subjects/${editingId}` : '/api/academic/subjects';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setFormData({ name: '', code: '' });
        setEditingId(null);
        fetchSubjects();
      }
    } catch (error) {
      console.error("Failed to save subject", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this subject? It may be linked to timetables and exams.")) return;
    
    try {
      const res = await fetch(`/api/academic/subjects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchSubjects();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  const openNewDialog = () => {
    setEditingId(null);
    setFormData({ name: '', code: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (subject: Subject) => {
    setEditingId(subject.id);
    setFormData({ name: subject.name, code: subject.code || '' });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects Configuration</h1>
          <p className="text-gray-500">Manage the core academic subjects for your school.</p>
        </div>
        <Button onClick={openNewDialog}>+ Add Subject</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="border-b bg-gray-50/50">
                <tr>
                  <th className="h-12 px-4 text-left font-medium text-gray-500">Subject Name</th>
                  <th className="h-12 px-4 text-left font-medium text-gray-500">Subject Code</th>
                  <th className="h-12 px-4 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={3} className="p-4 text-center">Loading subjects...</td></tr>
                ) : subjects.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-gray-500">No subjects found. Create one to get started.</td></tr>
                ) : (
                  subjects.map((subject) => (
                    <tr key={subject.id} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 align-middle font-medium">{subject.name}</td>
                      <td className="p-4 align-middle">{subject.code || '-'}</td>
                      <td className="p-4 align-middle text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(subject)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(subject.id)}>Delete</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Subject Name</Label>
              <Input 
                required 
                placeholder="e.g. Mathematics" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Subject Code (Optional)</Label>
              <Input 
                placeholder="e.g. MAT101" 
                value={formData.code} 
                onChange={e => setFormData({...formData, code: e.target.value})} 
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}