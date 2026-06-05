import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FinancialSummaryChart } from '../components/charts/FinancialSummaryChart';
import { StudentPerformanceChart } from '../components/charts/StudentPerformanceChart';
import { SchoolAnalyticsChart } from '../components/charts/SchoolAnalyticsChart';
import { SubscriptionStatusChart } from '../components/charts/SubscriptionStatusChart';
import { useAuth } from '../contexts/AuthContext';

export function Reports() {
  const { user, isLoading } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const canViewFinancial = isSuperAdmin || isAdmin;
  const canViewPerformance = isSuperAdmin || isAdmin || isTeacher;
  const canViewAnyReport = canViewFinancial || canViewPerformance;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
        <div className="grid gap-6 animate-pulse">
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">
          {isSuperAdmin ? 'System-wide analytics and subscription insights' : 'Analytics and insights for your school'}
        </p>
      </div>

      <div className="grid gap-6">
        {isSuperAdmin && (
          <>
            <SchoolAnalyticsChart />
            <SubscriptionStatusChart />
          </>
        )}

        {canViewFinancial && <FinancialSummaryChart />}

        {canViewPerformance && <StudentPerformanceChart />}

        {!canViewAnyReport && (
          <Card>
            <CardHeader>
              <CardTitle>Access Restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You don't have permission to view reports. Financial and performance reports are available to administrators, teachers, and system administrators.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}