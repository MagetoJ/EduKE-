import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useApi, useAuth, User } from '../contexts/AuthContext';
import { 
  School, 
  Users, 
  GraduationCap, 
  Activity, 
  Lock,
  Unlock,
  Trash2,
  ExternalLink,
  History,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface Stats {
  total_schools: number;
  active_schools: number;
  trial_schools: number;
  blocked_schools: number;
  total_users: number;
  total_students: number;
  total_staff: number;
  revenue: number;
  health: string;
}

interface SchoolItem {
  id: number;
  name: string;
  slug: string;
  email: string;
  status: string;
  subscription_plan: string;
  is_manually_blocked: boolean;
  created_at: string;
}

interface AuditLog {
  id: number;
  admin_id: number;
  action: string;
  target_school_id?: number;
  details: unknown;
  ip_address: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const api = useApi();
  const { impersonate, isImpersonating, exitImpersonation } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, schoolsRes, logsRes] = await Promise.all([
        api('/api/platform/stats'),
        api('/api/platform/schools'),
        api('/api/platform/audit-logs')
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (schoolsRes.ok) setSchools(await schoolsRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch (error) {
      console.error("Failed to fetch platform data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlock = async (schoolId: number) => {
    try {
      const res = await api(`/api/platform/schools/${schoolId}/status`, {
        method: 'PATCH'
      });
      if (res.ok) {
        fetchData(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to toggle block status", error);
    }
  };

  const deleteSchool = async (schoolId: number) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this school and all its data?")) return;
    
    try {
      const res = await api(`/api/platform/schools/${schoolId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSchools(schools.filter(s => s.id !== schoolId));
        fetchData(); // Refresh logs too
      }
    } catch (error) {
      console.error("Failed to delete school", error);
    }
  };

  const impersonateSchool = async (schoolId: number) => {
    try {
      const res = await api(`/api/platform/schools/${schoolId}/impersonate`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        
        // Construct the impersonated user object
        const impersonatedUser: User = {
          id: 'impersonated', // We don't have the specific user ID but we know it's an admin
          email: 'admin@' + data.school_name.toLowerCase().replace(/\s+/g, '') + '.edu',
          name: `Admin @ ${data.school_name}`,
          role: 'admin',
          schoolId: String(schoolId),
          schoolName: data.school_name
        };

        impersonate(data.access_token, impersonatedUser);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error("Failed to impersonate school", error);
    }
  };

  if (isLoading) return <div className="p-8">Loading Platform Overview...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Management</h1>
          <p className="text-muted-foreground">Monitor and manage all educational institutions across the EduKE network.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isImpersonating && (
            <div className="bg-orange-100 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Impersonation Mode Active</span>
              <Button variant="ghost" size="sm" onClick={exitImpersonation} className="h-6 px-2 text-xs hover:bg-orange-200">
                Exit
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={fetchData} className="shadow-sm">
            <Activity className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_schools}</div>
            <div className="flex flex-wrap gap-x-2 text-[10px] mt-1">
              <span className="text-green-600 font-bold uppercase tracking-tighter">{stats?.active_schools} Active</span>
              <span className="text-orange-600 font-bold uppercase tracking-tighter">{stats?.trial_schools} Trial</span>
              {stats?.blocked_schools ? (
                <span className="text-red-600 font-bold uppercase tracking-tighter">{stats?.blocked_schools} Blocked</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform Users</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users}</div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-1">Total registered accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Academic Community</CardTitle>
            <GraduationCap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_students} Students</div>
            <div className="flex items-center gap-1.5 text-[10px] mt-1 text-muted-foreground font-bold uppercase tracking-tighter">
              <UserCheck className="h-3 w-3 text-emerald-500" />
              {stats?.total_staff} Active Staff Members
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase text-emerald-600">{stats?.health}</div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mt-1">Status: All services online</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="schools" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="schools" className="flex items-center gap-2">
            <School className="h-4 w-4" />
            School Directory
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schools">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Registered Schools</CardTitle>
                <p className="text-sm text-muted-foreground">Manage school subscriptions, status and access.</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-4">School Name</th>
                      <th className="px-4 py-4">Identifier (Slug)</th>
                      <th className="px-4 py-4">Plan</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {schools.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No schools found.
                        </td>
                      </tr>
                    ) : (
                      schools.map((school) => (
                        <tr key={school.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-foreground">{school.name}</div>
                            <div className="text-xs text-muted-foreground">{school.email}</div>
                          </td>
                          <td className="px-4 py-4">
                            <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{school.slug}</code>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              school.subscription_plan === 'professional' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                              school.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                            }`}>
                              {school.subscription_plan}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${
                              school.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${school.status === 'active' ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`} />
                              {school.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => impersonateSchool(school.id)}
                                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                title="Login as Admin"
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Impersonate
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => toggleBlock(school.id)}
                                className={`h-8 ${school.is_manually_blocked ? "text-green-600 border-green-200 hover:bg-green-50" : "text-orange-600 border-orange-200 hover:bg-orange-50"}`}
                              >
                                {school.is_manually_blocked ? <Unlock className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                                {school.is_manually_blocked ? "Unblock" : "Block"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => deleteSchool(school.id)}
                                title="Delete School"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Administrative Activity Logs</CardTitle>
              <p className="text-sm text-muted-foreground">Platform-wide audit trail of all super-administrative actions.</p>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-4">Action</th>
                      <th className="px-4 py-4">Details</th>
                      <th className="px-4 py-4">Target School ID</th>
                      <th className="px-4 py-4">IP Address</th>
                      <th className="px-4 py-4 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                          No activity logs found.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4">
                            <span className="font-mono text-xs font-bold uppercase px-2 py-0.5 bg-muted rounded text-primary">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs max-w-xs block truncate" title={JSON.stringify(log.details)}>
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {log.target_school_id ? (
                              <code className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                                {log.target_school_id}
                              </code>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs font-mono text-muted-foreground">
                            {log.ip_address}
                          </td>
                          <td className="px-4 py-4 text-right text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
