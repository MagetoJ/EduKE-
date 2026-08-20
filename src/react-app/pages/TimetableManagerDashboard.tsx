import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Send, 
  UserCheck, 
  Layers, 
  Clock, 
  Building2,
  Filter,
  Plus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimetableSlot {
  id: number;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  class_name: string;
  stream?: string;
  subject_name: string;
  teacher_id: number;
  teacher_name: string;
  room_number: string;
  has_conflict?: boolean;
  conflict_reason?: string;
}

interface Teacher {
  id: number;
  full_name: string;
  department?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetableManagerDashboard() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  
  // Slot Creation/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<Partial<TimetableSlot> | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Fetch Master Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [timetableRes, teachersRes] = await Promise.all([
        fetch('/api/timetables/master', { headers: { 'Accept': 'application/json' } }),
        fetch('/api/teachers', { headers: { 'Accept': 'application/json' } })
      ]);

      if (!timetableRes.ok || !teachersRes.ok) {
        throw new Error('Failed to load timetable manager data from the server.');
      }

      const timetableData: TimetableSlot[] = await timetableRes.json();
      const teachersData: Teacher[] = await teachersRes.json();

      setSlots(timetableData);
      setTeachers(teachersData);

      // Default filter selection if not set
      if (!selectedFilter && timetableData.length > 0) {
        setSelectedFilter(timetableData[0].class_name || '');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while communicating with the server.');
    } finally {
      setLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived Statistics
  const totalConflicts = slots.filter(s => s.has_conflict).length;
  const uniqueRooms = Array.from(new Set(slots.map(s => s.room_number).filter(Boolean)));
  const uniqueClasses = Array.from(new Set(slots.map(s => s.class_name).filter(Boolean)));

  // Filter options based on active view mode
  const getFilterOptions = () => {
    if (viewMode === 'class') return uniqueClasses;
    if (viewMode === 'teacher') return teachers.map(t => t.full_name);
    if (viewMode === 'room') return uniqueRooms;
    return [];
  };

  // Find slot for specific cell
  const getSlotForCell = (day: string, period: number) => {
    return slots.find(s => {
      const matchesDay = s.day_of_week.toLowerCase() === day.toLowerCase();
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
        room_number: viewMode === 'room' ? selectedFilter : '',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedSlot)
      });

      if (!res.ok) throw new Error('Failed to save slot changes.');

      setIsModalOpen(false);
      setSelectedSlot(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving slot.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishTimetable = async () => {
    if (!confirm('Are you sure you want to publish the master timetable? This will update schedules for all teachers and students.')) return;
    try {
      const res = await fetch('/api/timetables/publish', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to publish timetable.');
      alert('Timetable successfully published!');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Publishing failed.');
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

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-600" />
        <h3 className="text-lg font-semibold text-red-800">Connection Error</h3>
        <p className="text-sm text-red-600 max-w-md">{error}</p>
        <Button onClick={fetchData} variant="outline" className="mt-2 border-red-300 text-red-700 hover:bg-red-100">
          Retry Fetching
        </Button>
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
            Real-time master scheduling, conflict resolution, and cover allocation.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh Data
          </Button>
          <Button onClick={handlePublishTimetable} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            <Send className="w-4 h-4" /> Publish Master Timetable
          </Button>
        </div>
      </div>

      {/* Health Metrics & Status */}
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

      {/* Filter Toolbar */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" /> Interactive Grid Filter
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* View Switcher */}
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

              {/* Specific Item Filter Dropdown */}
              <Select 
                value={selectedFilter} 
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-48 bg-white"
              >
                {getFilterOptions().map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* Timetable Interactive Grid */}
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
                            {slot.has_conflict && (
                              <Badge className="bg-amber-200 text-amber-800 text-[9px] px-1 py-0 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Conflict
                              </Badge>
                            )}
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

      {/* Add/Edit Slot Modal */}
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
                onChange={e => setSelectedSlot(prev => ({ ...prev, class_name: e.target.value }))}
                placeholder="e.g. Form 3 West"
              />
            </div>

            <div>
              <Label className="text-xs">Subject Name</Label>
              <Input 
                value={selectedSlot?.subject_name || ''} 
                onChange={e => setSelectedSlot(prev => ({ ...prev, subject_name: e.target.value }))}
                placeholder="e.g. Mathematics"
              />
            </div>

            <div>
              <Label className="text-xs">Assigned Teacher</Label>
              <Select
                value={selectedSlot?.teacher_name || ''}
                onChange={e => setSelectedSlot(prev => ({ ...prev, teacher_name: e.target.value }))}
                className="w-full bg-white"
              >
                <option value="">Select Teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.full_name}>{t.full_name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="text-xs">Room / Lab</Label>
              <Input 
                value={selectedSlot?.room_number || ''} 
                onChange={e => setSelectedSlot(prev => ({ ...prev, room_number: e.target.value }))}
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