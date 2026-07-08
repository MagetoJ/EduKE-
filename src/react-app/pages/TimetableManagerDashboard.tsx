import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AlertCircle, Calendar, Users, LayoutGrid } from "lucide-react";

export default function TimetableManagerDashboard() {
  const [view, setView] = useState("grade"); // 'grade' | 'teacher' | 'room'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Timetable Management</h1>
        <div className="space-x-2">
          <Button variant="outline">Print Schedules</Button>
          <Button className="bg-blue-600 hover:bg-blue-700">+ Add Time Slot</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <LayoutGrid className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Scheduled Slots</p>
              <h2 className="text-2xl font-bold">452</h2>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center space-x-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-red-600">Active Conflicts</p>
              <h2 className="text-2xl font-bold text-red-700">3</h2>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Teachers on Leave</p>
              <h2 className="text-2xl font-bold">2</h2>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Calendar className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Unassigned Lessons</p>
              <h2 className="text-2xl font-bold">12</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Master Grid (Takes up 2/3 of the screen) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-full">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-2">
              <CardTitle>Master Schedule</CardTitle>
              <select 
                className="border rounded-md p-1 text-sm"
                value={view}
                onChange={(e) => setView(e.target.value)}
                aria-label="Filter schedule view"
              >
                <option value="grade">Filter by Grade</option>
                <option value="teacher">Filter by Teacher</option>
                <option value="room">Filter by Room</option>
              </select>
            </CardHeader>
            <CardContent className="p-4">
              {/* Insert your Interactive Weekly Calendar Grid Component Here */}
              <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                [ Interactive Calendar Grid Placeholder ]
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Conflicts & Substitutions (Takes up 1/3) */}
        <div className="space-y-6">
          <Card className="border-red-200">
            <CardHeader className="bg-red-50 border-b border-red-100 pb-3">
              <CardTitle className="text-red-700 text-lg flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Requires Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Conflict Item */}
              <div className="p-3 bg-white border border-red-100 rounded-md shadow-sm text-sm">
                <p className="font-semibold text-gray-800">Double Booking: Room 104</p>
                <p className="text-gray-500 mt-1">Mon 09:00 AM</p>
                <p className="text-gray-600 mt-1">Grade 4 Math vs Grade 5 Science</p>
                <Button variant="outline" size="sm" className="mt-2 w-full text-red-600 border-red-200 hover:bg-red-50">Resolve</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Quick Relief (Substitutes)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm text-gray-600">
              <p className="mb-2">Mr. Omondi is on Sick Leave today. He has 4 classes scheduled.</p>
              <Button size="sm" className="w-full">Assign Substitute</Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}