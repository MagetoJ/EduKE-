import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Send, 
  UserCheck, 
  Layers, 
  Building2,
  Filter,
  Plus,
  Wand2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimetableSlot {
  id: number;
  day_of_week: string;
  period_number: number;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  room_number: string;
  has_conflict?: boolean;
}

interface Teacher {
  id: number | string;
  full_name?: string;
  name?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetableManagerDashboard() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [_error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<Partial<TimetableSlot> | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('accessToken');
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [timetableRes, teachersRes] = await Promise.all([
        fetch('/api/timetables/master', { headers }),
        fetch('/api/teachers', { headers })
      ]);

      if (!timetableRes.ok || !teachersRes.ok) {
        throw new Error(`Server returned error: ${timetableRes.status} / ${teachersRes.status}`);
      }

      const rawTimetable = await timetableRes.json();
      const rawTeachers = await teachersRes.json();

      const timetableData: TimetableSlot[] = Array.isArray(rawTimetable) ? rawTimetable : rawTimetable.data || [];
      const teachersData: Teacher[] = Array.isArray(rawTeachers) ? rawTeachers : rawTeachers.data || [];

      const normalizedTeachers = teachersData.map((t) => ({
        ...t,
        full_name: t.full_name || t.name || 'Assigned Teacher'
      }));

      setSlots(timetableData);
      setTeachers(normalizedTeachers);

      if (!selectedFilter) {
        if (timetableData.length > 0) {
          setSelectedFilter(timetableData[0].class_name || '');
        } else if (normalizedTeachers.length > 0) {
          setSelectedFilter(normalizedTeachers[0].full_name || '');
        }
      }
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred while communicating with the server.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-Generate Trigger
  const handleAutoGenerate = async () => {
    if (!confirm('Auto-generating will create a conflict-free master timetable based on HOD teacher & class assignments. Continue?')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/timetables/generate-auto', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Auto-generation failed.');

      const result = await res.json();
      alert(result.message || 'Timetable auto-generated successfully!');
      setSlots(result.data || []);
      if (result.data?.length > 0) {
        setSelectedFilter(result.data[0].class_name);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to auto-generate timetable.';
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const uniqueRooms = Array.from(new Set(slots.map(s => s.room_number).filter(Boolean)));
  const uniqueClasses = Array.from(new Set(slots.map(s => s.class_name).filter(Boolean)));
  const totalConflicts = slots.filter(s => s.has_conflict).length;

  const getFilterOptions = () => {
    if (viewMode === 'class') return uniqueClasses;
    if (viewMode === 'teacher') return teachers.map(t => t.full_name || '');
    if (viewMode === 'room') return uniqueRooms;
    return [];
  };

  const getSlotForCell = (day: string, period: number) => {
    return slots.find(s => {
      const matchesDay = s.day_of_week?.toLowerCase() === day.toLowerCase();
      const matchesPeriod = s.period_number === period;
      
      if (viewMode === 'class') return matchesDay && matchesPeriod && s.class_name === selectedFilter;
      if (viewMode === 'teacher') return matchesDay && matchesPeriod && s.teacher_name === selectedFilter;
      if (viewMode === 'room') return matchesDay && matchesPeriod && s.room_number === selectedFilter;
      
      return false;
    });
  };

  const handleOpenAddEditModal = (day: string, period: number, existingSlot?: TimetableSlot) => {
    if (existingSlot) {
      setSelectedSlot(existingSlot);
    } else {
      setSelectedSlot({
        day_of_week: day,
        period_number: period,
        class_name: viewMode === 'class' ? selectedFilter : '',
        teacher_name: viewMode === 'teacher' ? selectedFilter : '',
        room_number: viewMode === 'room' ? selectedFilter : 'Room 101',
        subject_name: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      const method = selectedSlot.id ? 'PUT' : 'POST';
      const url = selectedSlot.id ? `/api/timetables/slots/${selectedSlot.id}` : '/api/timetables/slots';
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(selectedSlot)
      });

      if (!res.ok) throw new Error('Failed to save slot changes.');

      setIsModalOpen(false);
      setSelectedSlot(null);
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving slot.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishTimetable = async () => {
    if (!confirm('Are you sure you want to publish the master timetable?')) return;
    try {
      const res = await fetch('/api/timetables/publish', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Failed to publish timetable.');
      alert('Timetable published successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publishing failed.';
      alert(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 font-medium">Loading live timetable schedule...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Timetable Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Auto-generate and fine-tune master schedules from HOD course & teacher assignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleAutoGenerate} 
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> {generating ? 'Generating...' : 'Auto-Generate Schedule'}
          </Button>
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button onClick={handlePublishTimetable} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            <Send className="w-4 h-4" /> Publish Master Timetable
          </Button>
        </div>
      </div>

      {/* Metrics Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule Status</p>
              <h3 className="text-xl font-bold text-slate-800 mt-1">
                {totalConflicts > 0 ? `${totalConflicts} Conflicts Detected` : 'All Clear'}
              </h3>
            </div>
            {totalConflicts > 0 ? (
              <Badge className="bg-amber-100 text-amber-800 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 p-2 rounded-full">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Teachers</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{teachers.length}</h3>
            </div>
            <UserCheck className="w-8 h-8 text-blue-500 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Configured Classes</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{uniqueClasses.length}</h3>
            </div>
            <Layers className="w-8 h-8 text-indigo-500 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rooms/Labs</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{uniqueRooms.length}</h3>
            </div>
            <Building2 className="w-8 h-8 text-slate-500 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Grid Toolbar & Interactive Schedule */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" /> Master Timetable Grid
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => { setViewMode('class'); setSelectedFilter(uniqueClasses[0] || ''); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'class' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
                >
                  By Class
                </button>
                <button
                  onClick={() => { setViewMode('teacher'); setSelectedFilter(teachers[0]?.full_name || ''); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'teacher' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
                >
                  By Teacher
                </button>
                <button
                  onClick={() => { setViewMode('room'); setSelectedFilter(uniqueRooms[0] || ''); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'room' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
                >
                  By Room
                </button>
              </div>

              {/* Standard HTML Select element to avoid UI component type mismatch */}
              <select 
                value={selectedFilter} 
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedFilter(e.target.value)}
                className="w-48 h-9 px-3 py-1 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getFilterOptions().map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 min-w-[800px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                <th className="p-3 border border-slate-200 w-24 text-center">Day / Period</th>
                {PERIODS.map(p => (
                  <th key={p} className="p-3 border border-slate-200 text-center">
                    Period {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="hover:bg-slate-50/50">
                  <td className="p-3 border border-slate-200 bg-slate-50 font-bold text-slate-700 text-sm text-center">
                    {day}
                  </td>
                  {PERIODS.map(period => {
                    const slot = getSlotForCell(day, period);
                    return (
                      <td
                        key={period}
                        onClick={() => handleOpenAddEditModal(day, period, slot)}
                        className={`p-2 border border-slate-200 text-center align-top h-24 cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 ${
                          slot?.has_conflict 
                            ? 'bg-amber-50 border-amber-300' 
                            : slot 
                              ? 'bg-blue-50/60 border-blue-100' 
                              : 'bg-white hover:bg-slate-100/50'
                        }`}
                      >
                        {slot ? (
                          <div className="flex flex-col h-full justify-between text-left p-1">
                            <div>
                              <div className="font-bold text-xs text-blue-900">{slot.subject_name}</div>
                              {viewMode !== 'class' && (
                                <div className="text-[11px] text-slate-600 font-medium">{slot.class_name}</div>
                              )}
                              {viewMode !== 'teacher' && (
                                <div className="text-[10px] text-slate-500">{slot.teacher_name}</div>
                              )}
                              {viewMode !== 'room' && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3" /> {slot.room_number || 'N/A'}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-300 hover:text-blue-500">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Edit Slot Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedSlot?.id ? 'Edit Timetable Slot' : 'Assign New Period Slot'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Day</Label>
                <Input value={selectedSlot?.day_of_week || ''} disabled className="bg-slate-50" />
              </div>
              <div>
                <Label className="text-xs">Period Number</Label>
                <Input value={selectedSlot?.period_number || ''} disabled className="bg-slate-50" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Class Name</Label>
              <Input 
                value={selectedSlot?.class_name || ''} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedSlot(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. Form 3 West"
              />
            </div>

            <div>
              <Label className="text-xs">Subject Name</Label>
              <Input 
                value={selectedSlot?.subject_name || ''} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedSlot(prev => ({ ...prev, subject_name: e.target.value }))}
                placeholder="e.g. Mathematics"
              />
            </div>

            <div>
              <Label className="text-xs">Assigned Teacher</Label>
              <select
                value={selectedSlot?.teacher_name || ''}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedSlot(prev => ({ ...prev, teacher_name: e.target.value }))}
                className="w-full h-9 px-3 py-1 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.full_name}>{t.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Room / Lab</Label>
              <Input 
                value={selectedSlot?.room_number || ''} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedSlot(prev => ({ ...prev, room_number: e.target.value }))}
                placeholder="e.g. Lab 2 / Room 10B"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSlot} disabled={saving} className="bg-blue-600 text-white">
              {saving ? 'Saving...' : 'Save Slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}