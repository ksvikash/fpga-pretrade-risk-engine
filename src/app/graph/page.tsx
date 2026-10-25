"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import Graph, { type NetworkData } from "@/components/graph";
import { LiveFraudMonitor } from "@/components/live-fraud-monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GraphPage() {
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNetwork = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/network?maxNodes=1000", { cache: "no-store" });
      if (!response.ok) throw new Error(`Graph fixture request failed (${response.status})`);
      const payload = await response.json();
      if (!payload.success || !payload.data?.nodes || !payload.data?.edges) {
        throw new Error("The graph endpoint returned an invalid network payload");
      }
      setNetwork(payload.data as NetworkData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load graph data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadNetwork(); }, []);

  const stats = useMemo(() => {
    if (!network) return null;
    const riskyNodes = network.nodes.filter((node) => node.data?.isFraud === true || node.data?.risk_level === "High").length;
    const riskyEdges = network.edges.filter((edge) => edge.isFraud === true || edge.data?.risk_flag === "High").length;
    const nodeTypes = network.nodes.reduce<Record<string, number>>((counts, node) => {
      const type = node.type ?? "unknown";
      counts[type] = (counts[type] ?? 0) + 1;
      return counts;
    }, {});
    return { riskyNodes, riskyEdges, nodeTypes };
  }, [network]);

  return (
    <main className="container mx-auto space-y-6 p-6">
      <LiveFraudMonitor />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transaction Network</h1>
            <p className="text-sm text-muted-foreground">The graph below is a bundled demo fixture. Live scoring and investigation data appears above.</p>
          </div>
          <Button onClick={() => void loadNetwork()} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh fixture
          </Button>
        </div>

        {loading && !network ? (
          <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-[600px] w-full" /></div>
        ) : error ? (
          <Card><CardContent className="flex items-center gap-3 p-6 text-destructive"><AlertCircle className="h-5 w-5" />{error}</CardContent></Card>
        ) : network && stats ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FixtureMetric label="Fixture transactions" value={network.nodes.length} />
              <FixtureMetric label="Fixture edges" value={network.edges.length} />
              <FixtureMetric label="Fixture high-risk nodes" value={stats.riskyNodes} />
              <FixtureMetric label="Fixture high-risk edges" value={stats.riskyEdges} />
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Bundled graph sample</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.nodeTypes).map(([type, count]) => <Badge key={type} variant="outline">{type}: {count}</Badge>)}
                </div>
              </CardHeader>
              <CardContent><Graph data={network} height="680px" layout="dagre" showFraud /></CardContent>
            </Card>
          </>
        ) : null}
      </section>
    </main>
  );
}

function FixtureMetric({ label, value }: { label: string; value: number }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value.toLocaleString()}</div><p className="text-xs text-muted-foreground">Bundled demo data</p></CardContent></Card>;
}
