import { MetricsCards } from "@/components/analytics/metrics-cards";
import { UsageChart } from "@/components/analytics/usage-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon, Database, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { File, DataSource } from "@shared/schema";

export default function Dashboard() {
  const filesQuery = useQuery<File[]>({ 
    queryKey: ["/api/files"]
  });

  const sourcesQuery = useQuery<DataSource[]>({
    queryKey: ["/api/data-sources"]
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="space-y-8">
        <MetricsCards />

        <div className="grid gap-4 md:grid-cols-4">
          <UsageChart />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Files</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {filesQuery.data?.slice(0, 4).map((file) => (
              <Card key={file.id}>
                <CardHeader>
                  <CardTitle>{file.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{file.aiSummary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}