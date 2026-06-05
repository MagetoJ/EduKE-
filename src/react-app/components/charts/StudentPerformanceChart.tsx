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

interface PerformanceRecord {
  subject: string;
  average: number;
  students: number;
}

export function StudentPerformanceChart() {
  const apiFetch = useApi();
  const [performanceData, setPerformanceData] = useState<PerformanceRecord[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await apiFetch("/api/reports/performance-summary");
        if (!response.ok) {
          return;
        }
        const data: PerformanceRecord[] = await response.json();
        if (isMounted) {
          setPerformanceData(data);
        }
      } catch (error) {
        console.error("Error fetching performance data:", error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [apiFetch]);

  const filteredData = useMemo(() => {
    if (!selectedSubject) {
      return performanceData;
    }
    return performanceData.filter((item) => item.subject === selectedSubject);
  }, [performanceData, selectedSubject]);

  const handleSubjectToggle = (subject: string | null) => {
    if (!subject) {
      setSelectedSubject(null);
      return;
    }
    setSelectedSubject((current) => (current === subject ? null : subject));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Performance by Subject</CardTitle>
        <CardDescription>
          Average grades and student counts across subjects
          {selectedSubject && ` - Filtered to ${selectedSubject}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={selectedSubject === null ? "default" : "outline"}
            size="sm"
            onClick={() => handleSubjectToggle(null)}
          >
            All Subjects
          </Button>
          {performanceData.map((item) => (
            <Button
              key={item.subject}
              variant={selectedSubject === item.subject ? "default" : "outline"}
              size="sm"
              onClick={() => handleSubjectToggle(item.subject)}
            >
              {item.subject}
            </Button>
          ))}
        </div>

        <div style={{ width: "100%", height: 300, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis dataKey="subject" />
              <YAxis yAxisId="left" orientation="left" domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number, name: string) => [
                  name === "average" ? `${value}%` : value,
                  name === "average" ? "Average Grade" : "Students",
                ]}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="average"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Average Grade (%)"
                onClick={(_, index) => {
                  const entry = filteredData[index];
                  if (entry) {
                    handleSubjectToggle(entry.subject);
                  }
                }}
              >
                {filteredData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
              <Bar
                yAxisId="right"
                dataKey="students"
                fill="hsl(var(--secondary-foreground))"
                radius={[4, 4, 0, 0]}
                name="Number of Students"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {selectedSubject && (
          <div className="mt-4 rounded-lg bg-muted p-4">
            <h4 className="font-semibold">{selectedSubject} Details</h4>
            {performanceData
              .filter((item) => item.subject === selectedSubject)
              .map((item) => (
                <div key={item.subject} className="mt-2">
                  <p>Average Grade: {item.average}%</p>
                  <p>Number of Students: {item.students}</p>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
