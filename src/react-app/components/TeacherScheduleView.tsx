import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Calendar, Clock, BookOpen, Building2, Filter, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimetableSlot {
  id: number;
  day_of_week: string;
  period_number: number;
  class_name: string;
  subject_name: string;
  teacher_name: string;
  room_number: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TeacherScheduleView() {
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [classesTaught, setClassesTaught] = useState<string[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMySchedule = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/timetables/my-schedule', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const result = await res.json();
        setMySlots(result.data || []);
        setClassesTaught(result.classes_taught || []);
      }
    } catch (err) {
      console.error('Failed to load teacher schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMySchedule();
  }, [fetchMySchedule]);

  // Filter slots based on class dropdown selection
  const filteredSlots = selectedClassFilter === 'ALL'
    ? mySlots
    : mySlots.filter(s => s.class_name === selectedClassFilter);

  const getSlotForCell = (day: string, period: number) => {
    return filteredSlots.find(
      s => s.day_of_week?.toLowerCase() === day.toLowerCase() && s.period_number === period
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Loading your teaching schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Weekly Lessons</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{mySlots.length} Periods</h3>
            </div>
            <Clock className="w-8 h-8 text-blue-500 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">My Assigned Classes</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{classesTaught.length} Classes</h3>
            </div>
            <BookOpen className="w-8 h-8 text-indigo-500 opacity-80" />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Filter View</p>
              <Badge className="bg-blue-100 text-blue-800 mt-1">
                {selectedClassFilter === 'ALL' ? 'All Classes' : selectedClassFilter}
              </Badge>
            </div>
            <Filter className="w-8 h-8 text-slate-400 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Class Filter Bar */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row justify-between items-center">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> My Teaching Timetable
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Filter Class:</label>
            <select
              value={selectedClassFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedClassFilter(e.target.value)}
              className="h-9 px-3 py-1 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All My Classes ({mySlots.length} slots)</option>
              {classesTaught.map(cls => (
                <option key={cls} value={cls}>Only {cls}</option>
              ))}
            </select>
          </div>
        </CardHeader>

        {/* Filtered Grid */}
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 min-w-[750px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                <th className="p-3 border border-slate-200 w-24 text-center">Day / Period</th>
                {PERIODS.map(p => (
                  <th key={p} className="p-3 border border-slate-200 text-center">Period {p}</th>
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
                        className={`p-2 border border-slate-200 text-center align-top h-24 ${
                          slot ? 'bg-blue-50/80 border-blue-200' : 'bg-white'
                        }`}
                      >
                        {slot ? (
                          <div className="flex flex-col h-full justify-between text-left p-1">
                            <div>
                              <div className="font-bold text-xs text-blue-900">{slot.subject_name}</div>
                              <div className="text-[11px] text-slate-700 font-semibold">{slot.class_name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                <Building2 className="w-3 h-3" /> {slot.room_number || 'Main Classroom'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-300">
                            Free
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
    </div>
  );
}