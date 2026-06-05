import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { useApi } from "../../contexts/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  Active: "#10B981",
  Trial: "#F59E0B",
  Expired: "#EF4444",
};

const PLAN_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

interface SubscriptionPlan {
  plan: string;
  status: string;
  subscribers: number;
  revenue: number;
}

interface StatusAggregate {
  status: string;
  subscribers: number;
  revenue: number;
  [key: string]: string | number;
}

export function SubscriptionStatusChart() {
  const apiFetch = useApi();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await apiFetch("/api/reports/subscription-status");
        if (!response.ok) {
          return;
        }
        const data: SubscriptionPlan[] = await response.json();
        if (isMounted) {
          setSubscriptionData(data);
        }
      } catch (error) {
        console.error("Error fetching subscription data:", error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [apiFetch]);

  const statusData = useMemo<StatusAggregate[]>(() => {
    const aggregated: Record<string, StatusAggregate> = {};
    subscriptionData.forEach((item) => {
      const existing = aggregated[item.status];
      if (existing) {
        existing.subscribers += item.subscribers;
        existing.revenue += item.revenue;
      } else {
        aggregated[item.status] = {
          status: item.status,
          subscribers: item.subscribers,
          revenue: item.revenue,
        };
      }
    });
    return Object.values(aggregated);
  }, [subscriptionData]);

  const totalRevenue = useMemo(
    () => subscriptionData.reduce((sum, item) => sum + item.revenue, 0),
    [subscriptionData]
  );

  const totalSubscribers = useMemo(
    () => subscriptionData.reduce((sum, item) => sum + item.subscribers, 0),
    [subscriptionData]
  );

  const activeSubscribers = useMemo(
    () =>
      subscriptionData
        .filter((item) => item.status === "Active")
        .reduce((sum, item) => sum + item.subscribers, 0),
    [subscriptionData]
  );

  const trialSubscribers = useMemo(
    () =>
      subscriptionData
        .filter((item) => item.status === "Trial")
        .reduce((sum, item) => sum + item.subscribers, 0),
    [subscriptionData]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription & Payment Status</CardTitle>
        <CardDescription>Revenue and subscriber analytics by plan and status</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plans">By Plan</TabsTrigger>
            <TabsTrigger value="status">By Status</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            <div style={{ width: "100%", height: 300, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subscriptionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis dataKey="plan" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `$${value}` : value,
                      name === "revenue" ? "Revenue" : "Subscribers",
                    ]}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="subscribers"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Subscribers"
                  >
                    {subscriptionData.map((_, index) => (
                      <Cell
                        key={`subscribers-${index}`}
                        fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                      />
                    ))}
                  </Bar>
                  <Bar
                    yAxisId="right"
                    dataKey="revenue"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    name="Revenue ($)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-4 text-sm font-medium">Subscriber Distribution</h4>
                <div style={{ width: "100%", height: 250, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ status, subscribers }) => `${status}: ${subscribers}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="subscribers"
                      >
                        {statusData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={STATUS_COLORS[entry.status] || "#8884d8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="mb-4 text-sm font-medium">Revenue by Status</h4>
                <div style={{ width: "100%", height: 250, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [`$${value}`, "Revenue"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {statusData.map((entry, index) => (
                          <Cell
                            key={`revenue-${index}`}
                            fill={STATUS_COLORS[entry.status] || "#8884d8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalSubscribers}</div>
            <div className="text-sm text-muted-foreground">Total Subscribers</div>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{activeSubscribers}</div>
            <div className="text-sm text-muted-foreground">Active Subscribers</div>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{trialSubscribers}</div>
            <div className="text-sm text-muted-foreground">Trial Users</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {subscriptionData.map((plan, index) => (
            <Card key={plan.plan} className="border-dashed border-muted-foreground/20">
              <CardHeader className="pb-2">
                <Badge
                  style={{
                    backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length],
                    color: "white",
                  }}
                >
                  {plan.plan}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{plan.subscribers} subscribers</div>
                <div className="text-sm text-muted-foreground">${plan.revenue.toLocaleString()} revenue</div>
                <div className="text-sm font-medium text-muted-foreground">Status: {plan.status}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
