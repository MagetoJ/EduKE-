import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { PowerBIEmbedCard } from '../components/PowerBIEmbedCard';
import { useAuth } from '../contexts/AuthContext'; // <-- Imported AuthContext

// 1. Define the Types
interface KPI {
  label: string;
  value: string | number;
  trend: string;
  status: 'positive' | 'negative';
}

interface TableRow {
  subject: string;
  strand?: string;
  formative_mean?: string;
  summative_mean?: string;
  teacher?: string;
  mean?: number | string;
  completion?: string;
}

interface ReportData {
  kpis: KPI[];
  chart_data: Record<string, any>[];
  table_data: TableRow[];
}

interface TabOption {
  id: string;
  label: string;
}

// 2. Define the Role-to-Tab Mapping
const getTabsForRole = (role: string): TabOption[] => {
  const allTabs = {
    academic: { id: 'academic', label: 'Academics' },
    financial: { id: 'financial', label: 'Financials' },
    attendance: { id: 'attendance', label: 'Attendance' },
    cbc: { id: 'cbc', label: 'CBC Compliance' },
    operations: { id: 'operations', label: 'Operations' }
  };

  const roleMap: Record<string, TabOption[]> = {
    super_admin: [allTabs.academic, allTabs.financial, allTabs.attendance, allTabs.cbc, allTabs.operations],
    admin: [allTabs.academic, allTabs.financial, allTabs.attendance, allTabs.cbc, allTabs.operations],
    hod: [allTabs.academic, allTabs.attendance, allTabs.cbc],
    class_teacher: [allTabs.academic, allTabs.attendance, allTabs.cbc],
    nurse: [allTabs.operations],
    librarian: [allTabs.operations],
  };

  return roleMap[role] || roleMap['super_admin'];
};

// 3. Removed props, getting user from context instead
export const Reports = () => {
  const { user } = useAuth(); // <-- Get user directly from context
  const userRole = user?.role || 'student'; // Fallback if user is null

  const availableTabs = getTabsForRole(userRole);
  
  const [activeTab, setActiveTab] = useState<string>(
    availableTabs.length > 0 ? availableTabs[0].id : 'cbc'
  );
  
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!activeTab) return;

    fetch(`/api/reports/${activeTab}/summary`)
      .then(res => res.json())
      .then((fetchedData: ReportData) => setData(fetchedData))
      .catch(err => console.error("Failed to load report data:", err));
  }, [activeTab]);

  if (availableTabs.length === 0) {
    return <div className="p-6">You do not have access to any reporting modules.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">School Reporting</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {availableTabs.map((tab: TabOption) => (
            <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {data?.kpis?.map((kpi: KPI, idx: number) => (
              <div key={idx} className="p-4 border rounded shadow-sm bg-white">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <span className={`text-sm ${kpi.status === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.trend}
                </span>
              </div>
            ))}
          </div>

          {/* Conditional Rendering: Native generic view vs PowerBI */}
          {activeTab === 'financial' ? (
             <PowerBIEmbedCard />
          ) : (
             <div className="border p-4 rounded shadow-sm bg-white">
               <h3 className="font-semibold mb-4">Detailed Breakdown</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b bg-gray-50">
                       <th className="p-3">Subject</th>
                       <th className="p-3">Strand / Details</th>
                       <th className="p-3">Formative</th>
                       <th className="p-3">Summative</th>
                     </tr>
                   </thead>
                   <tbody>
                     {data?.table_data?.map((row: TableRow, i: number) => (
                       <tr key={i} className="border-b hover:bg-gray-50">
                         <td className="p-3">{row.subject}</td>
                         <td className="p-3">{row.strand || row.teacher || '-'}</td>
                         <td className="p-3">{row.formative_mean || row.completion || '-'}</td>
                         <td className="p-3">{row.summative_mean || row.mean || '-'}</td>
                       </tr>
                     ))}
                     {(!data?.table_data || data.table_data.length === 0) && (
                       <tr>
                         <td colSpan={4} className="p-4 text-center text-gray-500">
                           No detailed data available for this term.
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};