import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import { useApi } from "../../contexts/AuthContext";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

interface FinancialRecord {
  name: string;
  Collected: number;
  Pending: number;
}

export function FinancialSummaryChart() {
  const apiFetch = useApi();
  const [financialData, setFinancialData] = useState<FinancialRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await apiFetch("/api/reports/financial-summary");
        if (!response.ok) {
          return;
        }
        const data: FinancialRecord[] = await response.json();
        if (isMounted) {
          setFinancialData(data);
        }
      } catch (error) {
        console.error("Error fetching financial data:", error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [apiFetch]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(financialData)) {
      return [];
    }
    if (!selectedMonth) {
      return financialData;
    }
    return financialData.filter((item) => item.name === selectedMonth);
  }, [financialData, selectedMonth]);

  const handleMonthToggle = (month: string | null) => {
    if (!month) {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth((current) => (current === month ? null : month));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Status</CardTitle>
        <CardDescription>
          Collected vs. Pending Fees
          {selectedMonth ? ` - ${selectedMonth}` : " (Last 6 Months)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={selectedMonth === null ? "default" : "outline"}
            size="sm"
            onClick={() => handleMonthToggle(null)}
          >
            All Months
          </Button>
          {Array.isArray(financialData) && financialData.map((item) => (
            <Button
              key={item.name}
              variant={selectedMonth === item.name ? "default" : "outline"}
              size="sm"
              onClick={() => handleMonthToggle(item.name)}
            >
              {item.name}
            </Button>
          ))}
        </div>

        <div style={{ width: "100%", height: 300, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" />
              <YAxis unit="$" />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [`$${value}`, ""]}
              />
              <Legend />
              <Bar
                dataKey="Collected"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Collected ($)"
                onClick={(_, index) => {
                  const entry = filteredData[index];
                  if (entry) {
                    handleMonthToggle(entry.name);
                  }
                }}
              >
                {Array.isArray(filteredData) && filteredData.map((_, index) => (
                  <Cell
                    key={`collected-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="Pending"
                fill="hsl(var(--secondary-foreground))"
                radius={[4, 4, 0, 0]}
                name="Pending ($)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {selectedMonth && (
          <div className="mt-4 rounded-lg bg-muted p-4">
            <h4 className="font-semibold">{selectedMonth} Financial Details</h4>
            {Array.isArray(financialData) && financialData
              .filter((item) => item.name === selectedMonth)
              .map((item) => (
                <div key={item.name} className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Collected</p>
                    <p className="text-lg font-semibold text-green-600">${item.Collected}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-lg font-semibold text-orange-600">${item.Pending}</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
