"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Activity, Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Alert = {
  timestamp?: string;
  transaction_id: string;
  risk_score: number;
  investigation_created?: boolean;
  source?: string;
};

type Investigation = {
  transaction_id: string;
  risk_score: number;
  executive_summary: string;
  decision?: string;
  generated_at?: string;
  tools_executed?: string[];
  wallet_history?: { observed_transactions_24h: number; velocity_z_score: number };
  fund_flow_trace?: { hops_traced: number; connected_wallets: number; high_risk_links: number };
};

type DashboardData = {
  connected: boolean;
  stream_available?: boolean;
  stream: {
    source?: string;
    running?: boolean;
    transactions_scored?: number;
    errors?: number;
    throughput_per_second?: number;
    latency_ms?: { mean?: number; p50?: number; p99?: number; sample_count?: number };
    last_updated?: string;
  } | null;
  alerts: Alert[];
  investigations: Investigation[];
  error?: string;
};

export function LiveFraudMonitor() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const payload = (await response.json()) as DashboardData;
        if (!response.ok) throw new Error(payload.error ?? `Dashboard API returned ${response.status}`);
        if (active) {
          setData(payload);
          setError(null);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load live metrics");
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const stream = data?.stream;
  const investigations = [...(data?.investigations ?? [])].reverse();
  const alerts = [...(data?.alerts ?? [])].reverse();

  return (
    <section className="space-y-4" aria-label="Live fraud monitoring">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Live Scoring & Investigations</h2>
          <p className="text-sm text-muted-foreground">Metrics refresh every 2 seconds from the scoring worker.</p>
        </div>
        <Badge variant={data?.connected ? "default" : "secondary"}>
          {error ? "Backend unavailable" : data?.connected ? (stream?.running ? "Stream running" : stream ? "Stream idle" : "Backend online · no stream snapshot") : "Connecting"}
        </Badge>
      </div>

      {error && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {error}. Confirm FastAPI is running, then start or rerun the streaming worker to populate live metrics.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Activity className="h-4 w-4" />} label="Throughput" value={`${stream?.throughput_per_second?.toFixed(2) ?? "0.00"} tx/s`} detail={`${stream?.transactions_scored ?? 0} scored`} />
        <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Scoring p99" value={`${stream?.latency_ms?.p99?.toFixed(2) ?? "0.00"} ms`} detail={`${stream?.latency_ms?.sample_count ?? 0} latency samples`} />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Recent risk alerts" value={String(data?.alerts.length ?? 0)} detail="Operating threshold or agent trigger > 0.85" />
        <MetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Investigations" value={String(data?.investigations.length ?? 0)} detail={`${stream?.errors ?? 0} scoring errors`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Anomaly Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? <EmptyState>Nothing above the 0.85 threshold has been recorded.</EmptyState> : alerts.slice(0, 8).map((alert, index) => (
              <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0" key={`${alert.transaction_id}-${index}`}>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{alert.transaction_id}</p>
                  <p className="text-xs text-muted-foreground">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Investigation scenario"}</p>
                </div>
                <Badge variant="destructive">{(alert.risk_score * 100).toFixed(2)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Investigator Audit Trail</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {investigations.length === 0 ? <EmptyState>Investigation reports appear here when a score exceeds 0.85.</EmptyState> : investigations.slice(0, 5).map((report) => (
              <article className="space-y-2 rounded-md border p-3" key={report.transaction_id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm">{report.transaction_id}</span>
                  <Badge variant="destructive">{(report.risk_score * 100).toFixed(2)}% · human review</Badge>
                </div>
                <p className="text-sm">{report.executive_summary}</p>
                <div className="flex flex-wrap gap-1">
                  {(report.tools_executed ?? []).map((tool) => <Badge key={tool} variant="outline">{tool}</Badge>)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.wallet_history ? `${report.wallet_history.observed_transactions_24h} wallet tx/24h · velocity z ${report.wallet_history.velocity_z_score}` : "Wallet history unavailable"}
                  {report.fund_flow_trace ? ` · ${report.fund_flow_trace.hops_traced} hops · ${report.fund_flow_trace.high_risk_links} linked risk flags` : " · flow trace unavailable"}
                </p>
              </article>
            ))}
            <p className="text-xs text-muted-foreground">Investigator tool results are simulated and require analyst verification.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
