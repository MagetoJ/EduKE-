// src/react-app/pages/NurseDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { clinicService } from '../lib/clinicService';

export default function NurseDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState({ pending_meds: 0, low_stock: 0, total_visits: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial dashboard stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await clinicService.getDashboardStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  // Handle student search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const results = await clinicService.searchStudents(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      console.error("Search failed:", err);
      // Depending on your UI setup, you might trigger a toast notification here
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clinic Dashboard</h1>
        <Button onClick={() => console.log('Log Visit Modal')}>+ Log New Visit</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader><CardTitle>Pending Medications</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">
              {isLoading ? "..." : stats.pending_meds}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Low Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-red-500">
              {isLoading ? "..." : stats.low_stock}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total Visits Today</CardTitle></CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600">
              {isLoading ? "..." : stats.total_visits}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Health Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input 
              placeholder="Search by student name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-md"
            />
            <Button variant="outline" onClick={handleSearch}>Search</Button>
          </div>

          {/* Render Search Results */}
          {searchResults.length > 0 && (
             <div className="mt-4 border rounded-md p-4">
               <h3 className="font-semibold mb-2">Results:</h3>
               <ul className="space-y-2">
                 {searchResults.map((student: any) => (
                   <li key={student.student_id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                     <span>{student.name} - {student.grade}</span>
                     <Button size="sm" variant="secondary">View Profile</Button>
                   </li>
                 ))}
               </ul>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}