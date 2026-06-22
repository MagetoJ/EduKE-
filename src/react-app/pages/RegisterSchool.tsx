import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function RegisterSchool() {
  const [schoolName, setSchoolName] = useState('');
  const [isSpecialNeeds, setIsSpecialNeeds] = useState(false);
  const [disabilityCategory, setDisabilityCategory] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (isSpecialNeeds && !disabilityCategory) {
      setError('Please select the primary disability focus category.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          schoolName, 
          is_special_needs: isSpecialNeeds, 
          disability_category: isSpecialNeeds ? disabilityCategory : 'none',
          adminName, 
          email, 
          password 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register school');
      }

      setSuccess(data.message || 'Registration successful. Please verify your email before logging in.');
      setSchoolName('');
      setIsSpecialNeeds(false);
      setDisabilityCategory('');
      setAdminName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Register Your Institution</CardTitle>
          <CardDescription>
            Create your institutional account to get started. You will be configured as the platform administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name</Label>
              <Input
                id="schoolName"
                placeholder="e.g., Machakos School for the Deaf"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
            </div>

            {/* Accessibility Classification Switch Container */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border rounded-xl gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-slate-900 cursor-pointer" htmlFor="specialNeedsToggle">
                  Special Needs / Disability Support
                </Label>
                <p className="text-xs text-slate-500">
                  Enable this toggle if this is a specialized learning institution for disabled students.
                </p>
              </div>
              <input
                id="specialNeedsToggle"
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                checked={isSpecialNeeds}
                onChange={(e) => {
                  setIsSpecialNeeds(e.target.checked);
                  if (!e.target.checked) setDisabilityCategory('');
                }}
              />
            </div>

            {/* Contextual Focus Track Dropdown Option List */}
            {isSpecialNeeds && (
              <div className="space-y-2 border-l-2 border-emerald-50 pl-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label htmlFor="disabilityCategory">Primary Disability Category Focus</Label>
                <Select value={disabilityCategory} onValueChange={setDisabilityCategory}>
                  <SelectTrigger id="disabilityCategory" className="bg-white">
                    <SelectValue placeholder="Select primary impairment specialization track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hearing_impaired">Hearing Impairments (KSL / Deaf / Hard of Hearing Support)</SelectItem>
                    <SelectItem value="visual_impaired">Visual Impairments (Braille / Blind / Low Vision Engine Active)</SelectItem>
                    <SelectItem value="physical_mobility">Physical / Mobility Accommodations (Switch Control Tracking)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="adminName">Your Full Name</Label>
              <Input
                id="adminName"
                placeholder="e.g., Mwalimu Jane Doe"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Your Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@yourschool.ac.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Create a Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500 bg-red-50/50 p-2 border border-red-100 rounded-md">{error}</p>
            )}
            {success && (
              <p className="text-sm font-medium text-green-600 bg-green-50/50 p-2 border border-green-100 rounded-md">{success}</p>
            )}

            <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={isLoading}>
              {isLoading ? 'Creating Institutional Node...' : 'Register School'}
            </Button>

            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link to="/login" className="underline text-blue-600 hover:text-blue-800">
                Log In
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}