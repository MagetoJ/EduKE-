import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useApi } from "../../contexts/AuthContext";

interface SchoolAnalyticsRecord {
  month: string;
  totalSchools: number;
  activeSchools: number;
  newSchools: number;
}

export function SchoolAnalyticsChart() {
  const apiFetch = useApi();
  const [schoolData, setSchoolData] = useState<SchoolAnalyticsRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await apiFetch("/api/reports/school-analytics");
        if (!response.ok) {
          return;
        }
        const data: SchoolAnalyticsRecord[] = await response.json();
        if (isMounted) {
          setSchoolData(data);
        }
      } catch (error) {
        console.error("Error fetching school analytics:", error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [apiFetch]);

  const latestEntry = useMemo(() => {
    if (schoolData.length === 0) {
      return null;
    }
    return schoolData[schoolData.length - 1];
  }, [schoolData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Analytics</CardTitle>
        <CardDescription>Growth and activity of schools using the system</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="growth" className="space-y-4">
          <TabsList>
            <TabsTrigger value="growth">School Growth</TabsTrigger>
            <TabsTrigger value="activity">School Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="growth" className="space-y-4">
            <div style={{ width: "100%", height: 300, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={schoolData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalSchools"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    name="Total Schools"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="newSchools"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="New Schools"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div style={{ width: "100%", height: 300, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="activeSchools"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Active Schools"
                  />
                  <Bar
                    dataKey="newSchools"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    name="New This Month"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {latestEntry ? latestEntry.totalSchools : 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Schools</div>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {latestEntry ? latestEntry.activeSchools : 0}
            </div>
            <div className="text-sm text-muted-foreground">Active Schools</div>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {latestEntry ? latestEntry.newSchools : 0}
            </div>
            <div className="text-sm text-muted-foreground">New This Month</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
