import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

import { Button } from '../components/ui/button';


interface SpecialNeedsDashboardProps {
  studentId: string;
}

export default function SpecialNeedsDashboard({ studentId }: SpecialNeedsDashboardProps) {
  const apiFetch = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    ksl_proficiency_level: 'beginner',
    hearing_loss_degree_left: 'moderate',
    hearing_loss_degree_right: 'moderate',
    assistive_device_used: 'none',
    preferred_communication_mode: 'KSL'
  });

  useEffect(() => {
    async function loadDeafProfile() {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/special-education/profile/deaf/${studentId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setProfile(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse special profile info.');
      } finally {
        setLoading(false);
      }
    }
    loadDeafProfile();
  }, [studentId, apiFetch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await apiFetch(`/api/special-education/profile/deaf`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, ...profile })
      });
      if (response.ok) {
        alert('Special education metrics updated successfully!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  if (loading) return <div className="p-6 text-center">Loading Accommodation Metrics...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deaf Education & Visual Learning Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Kenyan Sign Language (KSL) Proficiency</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md"
                  value={profile.ksl_proficiency_level}
                  onChange={e => setProfile({...profile, ksl_proficiency_level: e.target.value})}
                >
                  <option value="beginner">Beginner (Basic Signs)</option>
                  <option value="intermediate">Intermediate (Conversational)</option>
                  <option value="advanced">Advanced (Fluent Communication)</option>
                  <option value="native">Native Level</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Preferred Learning Mode</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md"
                  value={profile.preferred_communication_mode}
                  onChange={e => setProfile({...profile, preferred_communication_mode: e.target.value})}
                >
                  <option value="KSL">Pure Kenyan Sign Language (Visual)</option>
                  <option value="Total Communication">Total Communication (Signs + Speech + Visual Aids)</option>
                  <option value="Oral">Oralism / Lip Reading Focused</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Left Ear Hearing Level</label>
                <input 
                  type="text" 
                  className="w-full mt-1 p-2 border rounded-md" 
                  placeholder="e.g. 55dB Moderate"
                  value={profile.hearing_loss_degree_left}
                  onChange={e => setProfile({...profile, hearing_loss_degree_left: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Right Ear Hearing Level</label>
                <input 
                  type="text" 
                  className="w-full mt-1 p-2 border rounded-md" 
                  placeholder="e.g. 70dB Severe" 
                  value={profile.hearing_loss_degree_right}
                  onChange={e => setProfile({...profile, hearing_loss_degree_right: e.target.value})}
                />
              </div>
            </div>

            <Button type="submit" className="mt-4">Save Accommodations Profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}