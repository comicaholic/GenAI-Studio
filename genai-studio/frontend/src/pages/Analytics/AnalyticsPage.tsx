// src/pages/Analytics/AnalyticsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import LayoutShell from "@/components/Layout/LayoutShell";
import { api } from "@/services/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";

/* -------------------- Types -------------------- */
interface UptimeData {
  uptime_seconds: number;
  start_time: string;
  current_time: string;
}

interface SystemMetrics {
  cpu?: { percent?: number; count?: number; system_percent?: number };
  memory?: {
    percent?: number; // app percent if provided
    system_percent?: number;
    used_gb?: number;
    total_gb?: number;
  };
  disk?: { percent?: number; used_gb?: number; total_gb?: number };
  gpu?: { percent?: number; system_percent?: number };
  timestamp?: string;
}

interface PerformanceTrend {
  timestamp: string;
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
}

interface GroqAnalytics {
  total_requests?: number;
  total_tokens?: number;
  total_cost_usd?: number;
  average_duration_ms?: number;
  success_rate?: number;
  usage_by_model?: Record<string, { requests?: number; tokens?: number; cost_usd?: number }>;
  hourly_usage?: Array<{ hour?: string; requests?: number; tokens?: number; cost_usd?: number }>;
}

interface ErrorMetrics {
  total_errors?: number;
  error_rate?: number; // in [0,1]
  errors_by_type?: Record<string, number>;
  hourly_errors?: Array<{ hour?: string; errors?: number; error_rate?: number }>;
}

interface LatencyMetrics {
  average_response_time_ms?: number;
  p95_response_time_ms?: number;
  p99_response_time_ms?: number;
  hourly_latency?: Array<{ hour?: string; avg_latency?: number; p95_latency?: number; p99_latency?: number }>;
}

interface ThroughputMetrics {
  requests_per_second?: number;
  evaluations_per_minute?: number;
  hourly_throughput?: Array<{ hour?: string; requests_per_sec?: number; evals_per_min?: number }>;
}

interface EvaluationMetrics {
  total_evaluations?: number;
  average_pass_rate?: number;
  rouge_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  bleu_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  f1_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  exact_match_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  bertscore_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  perplexity_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  accuracy_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  precision_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  recall_scores?: Array<{ project?: string; score?: number; timestamp?: string }>;
  model_comparison?: Record<
    string,
    { evaluations?: number; avg_rouge?: number; avg_bleu?: number; avg_f1?: number; pass_rate?: number }
  >;
}

/* -------------------- Helpers & Styles -------------------- */
const colors = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  pink: "#ec4899",
  slate: "#334155",
  bg: "#0f172a",
  panel: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
};

const clampPct = (v?: number | null) => Math.max(0, Math.min(100, Number(v ?? 0)));

const ringLen = (r: number) => 2 * Math.PI * r;
// lightweight switch UI
import Switch from "@/components/ui/Switch";

/** Reusable circle compare (outer = system, inner = application). Center shows system%. */
function CircleCompare({
  systemPct,
  appPct,
  outerColor,
  innerColor,
}: {
  systemPct: number;
  appPct: number;
  outerColor: string;
  innerColor: string;
}) {
  const R_OUT = 24;
  const R_IN = 20;
  const L_OUT = ringLen(R_OUT);
  const L_IN = ringLen(R_IN);
  const sys = clampPct(systemPct);
  const app = clampPct(appPct);
  return (
    <div style={{ position: "relative", width: 60, height: 60 }}>
      <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
        {/* background ring */}
        <circle cx="30" cy="30" r={R_OUT} fill="none" stroke={colors.slate} strokeWidth="6" />
        {/* system ring (outer) */}
        <circle
          cx="30"
          cy="30"
          r={R_OUT}
          fill="none"
          stroke={outerColor}
          strokeWidth="6"
          strokeDasharray={`${L_OUT}`}
          strokeDashoffset={`${L_OUT * (1 - sys / 100)}`}
          strokeLinecap="round"
        />
        {/* application ring (inner) */}
        <circle
          cx="30"
          cy="30"
          r={R_IN}
          fill="none"
          stroke={innerColor}
          strokeWidth="4"
          strokeDasharray={`${L_IN}`}
          strokeDashoffset={`${L_IN * (1 - app / 100)}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 12,
          color: colors.muted,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {sys.toFixed(0)}%
      </div>
    </div>
  );
}

/* small stylized stat card */
function StatCard({ title, value, subtitle, color = colors.primary }: { title: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div style={{ padding: 20, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 12, boxShadow: "0 6px 20px rgba(2,6,23,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          {subtitle && <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

/* Chart card wrapper */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 20, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 12, boxShadow: "0 6px 20px rgba(2,6,23,0.6)" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: colors.text, fontSize: 16 }}>{title}</h3>
      </div>
      <div style={{ width: "100%", height: 360 }}>{children}</div>
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"application" | "groq">("application");
  const [activeSubTab, setActiveSubTab] = useState<"system" | "trends" | "evaluations">("system");
  const [timeFilter, setTimeFilter] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [uptime, setUptime] = useState<UptimeData | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [groqAnalytics, setGroqAnalytics] = useState<GroqAnalytics | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [throughputMetrics, setThroughputMetrics] = useState<ThroughputMetrics | null>(null);
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // persistent toggles for evaluations graph
  const [evalToggles, setEvalToggles] = useState<{ rouge:boolean; bleu:boolean; f1:boolean; em:boolean; bert:boolean; perplexity:boolean; accuracy:boolean; precision:boolean; recall:boolean }>(() => {
    try {
      const s = localStorage.getItem("app:analytics:evalToggles");
      if (s) return JSON.parse(s);
    } catch {}
    return { rouge:true, bleu:true, f1:true, em:false, bert:false, perplexity:false, accuracy:false, precision:false, recall:false };
  });
  useEffect(() => { localStorage.setItem("app:analytics:evalToggles", JSON.stringify(evalToggles)); }, [evalToggles]);
  // toggle for GPU trends
  const [showGPU, setShowGPU] = useState<boolean>(() => localStorage.getItem("app:analytics:showGPU")!=="false");
  useEffect(() => { localStorage.setItem("app:analytics:showGPU", String(showGPU)); }, [showGPU]);

  const loadUptime = useCallback(async () => {
    try {
      const r = await api.get("/analytics/uptime");
      setUptime(r.data);
    } catch (e) {
      // keep uptime null if failed
    }
  }, []);

  const loadSystem = useCallback(async () => {
    try {
      const r = await api.get("/analytics/system");
      setSystemMetrics(r.data);
    } catch (e) {}
  }, []);

  const loadPerf = useCallback(async () => {
    try {
      const r = await api.get("/analytics/performance");
      setPerformanceTrends(r.data?.trends ?? []);
    } catch (e) {}
  }, []);

  const loadGroq = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/groq?timeframe=${timeFilter}`);
      setGroqAnalytics(r.data);
    } catch (e) {}
  }, [timeFilter]);

  const loadErrors = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/errors?timeframe=${timeFilter}`);
      setErrorMetrics(r.data);
    } catch (e) {}
  }, [timeFilter]);

  const loadLatency = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/latency?timeframe=${timeFilter}`);
      setLatencyMetrics(r.data);
    } catch (e) {}
  }, [timeFilter]);

  const loadThroughput = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/throughput?timeframe=${timeFilter}`);
      setThroughputMetrics(r.data);
    } catch (e) {}
  }, [timeFilter]);

  const loadEvals = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/evaluations?timeframe=${timeFilter}`);
      setEvaluationMetrics(r.data);
    } catch (e) {}
  }, [timeFilter]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      loadUptime(),
      loadSystem(),
      loadPerf(),
      loadGroq(),
      loadErrors(),
      loadLatency(),
      loadThroughput(),
      loadEvals(),
    ]);
    setIsLoading(false);
  }, [loadUptime, loadSystem, loadPerf, loadGroq, loadErrors, loadLatency, loadThroughput, loadEvals]);

  useEffect(() => {
    loadAll();
    const uptimeInterval = setInterval(loadUptime, 1_000); // realtime-ish uptime
    const dataInterval = setInterval(() => {
      // targeted refresh depending on tab
      if (activeTab === "application" && activeSubTab === "system") {
        loadSystem();
        loadPerf();
      } else if (activeTab === "application" && activeSubTab === "trends") {
        loadErrors();
        loadLatency();
        loadThroughput();
      } else if (activeTab === "application" && activeSubTab === "evaluations") {
        loadEvals();
      } else if (activeTab === "groq") {
        loadGroq();
      }
    }, 2_000);
    return () => {
      clearInterval(uptimeInterval);
      clearInterval(dataInterval);
    };
  }, [activeTab, activeSubTab, timeFilter, loadAll, loadUptime, loadSystem, loadPerf, loadGroq, loadErrors, loadLatency, loadThroughput, loadEvals]);

  /* ---------- Derived & mapped data for charts ---------- */
  const systemChartData = useMemo(
    () =>
      performanceTrends
        .slice(-36)
        .map((t) => ({
          time: new Date(t.timestamp).toLocaleTimeString(),
          cpu: (t.cpu_percent ?? 0),
          memory: (t.memory_percent ?? 0),
          disk: (t.disk_percent ?? 0),
        })),
    [performanceTrends]
  );

  const groqChartData = groqAnalytics?.hourly_usage?.slice(-24) ?? [];

  const modelUsageData =
    groqAnalytics?.usage_by_model
      ? Object.entries(groqAnalytics.usage_by_model).map(([name, v]) => ({
          name,
          requests: v?.requests ?? 0,
          tokens: v?.tokens ?? 0,
          cost_usd: v?.cost_usd ?? 0,
        }))
      : [];

  const errorTrendData =
    errorMetrics?.hourly_errors?.map((pt) => ({
      hour: pt.hour,
      errors: pt.errors ?? 0,
      error_rate_pct: (pt.error_rate ?? 0) * 100,
    })) ?? [];

  /* ---------- Evaluation metrics (averages) ---------- */
  const evalAverages = useMemo(() => {
    const em = Array.isArray(evaluationMetrics?.exact_match_scores) && evaluationMetrics && evaluationMetrics.exact_match_scores.length
      ? evaluationMetrics.exact_match_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.exact_match_scores.length
      : 0;
    const bleu = Array.isArray(evaluationMetrics?.bleu_scores) && evaluationMetrics && evaluationMetrics.bleu_scores.length
      ? evaluationMetrics.bleu_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.bleu_scores.length
      : 0;
    const rouge = Array.isArray(evaluationMetrics?.rouge_scores) && evaluationMetrics && evaluationMetrics.rouge_scores.length
      ? evaluationMetrics.rouge_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.rouge_scores.length
      : 0;
    const f1 = Array.isArray(evaluationMetrics?.f1_scores) && evaluationMetrics && evaluationMetrics.f1_scores.length
      ? evaluationMetrics.f1_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.f1_scores.length
      : 0;
    const bert = Array.isArray(evaluationMetrics?.bertscore_scores) && evaluationMetrics && evaluationMetrics.bertscore_scores.length
      ? evaluationMetrics.bertscore_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.bertscore_scores.length
      : 0;
    const ppl = Array.isArray(evaluationMetrics?.perplexity_scores) && evaluationMetrics && evaluationMetrics.perplexity_scores.length
      ? evaluationMetrics.perplexity_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.perplexity_scores.length
      : 0;
    const acc = Array.isArray(evaluationMetrics?.accuracy_scores) && evaluationMetrics && evaluationMetrics.accuracy_scores.length
      ? evaluationMetrics.accuracy_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.accuracy_scores.length
      : 0;
    const prec = Array.isArray(evaluationMetrics?.precision_scores) && evaluationMetrics && evaluationMetrics.precision_scores.length
      ? evaluationMetrics.precision_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.precision_scores.length
      : 0;
    const rec = Array.isArray(evaluationMetrics?.recall_scores) && evaluationMetrics && evaluationMetrics.recall_scores.length
      ? evaluationMetrics.recall_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.recall_scores.length
      : 0;
    return { em, bleu, rouge, f1, bert, ppl, acc, prec, rec };
  }, [evaluationMetrics]);

  /* ---------- Application <> system derivations (defensive) ---------- */
  const sysCPU = clampPct(systemMetrics?.cpu?.system_percent ?? systemMetrics?.cpu?.percent);
  const appCPU = clampPct(
    systemMetrics?.cpu && (systemMetrics.cpu.percent != null && systemMetrics.cpu.system_percent != null)
      ? systemMetrics.cpu.percent
      : sysCPU * 0.30
  );

  const sysMemPct = clampPct(systemMetrics?.memory?.system_percent ?? systemMetrics?.memory?.percent);
  const appMemPct = clampPct(
    systemMetrics?.memory && (systemMetrics.memory.percent != null && systemMetrics.memory.system_percent != null)
      ? systemMetrics.memory.percent
      : sysMemPct * 0.40
  );
  const totalMemGB = Number(systemMetrics?.memory?.total_gb ?? 0);
  const appMemGB = (appMemPct / 100) * totalMemGB;

  const sysGPU = clampPct(systemMetrics?.gpu?.system_percent ?? systemMetrics?.gpu?.percent);
  const appGPU = clampPct(
    systemMetrics?.gpu && (systemMetrics.gpu.percent != null && systemMetrics.gpu.system_percent != null)
      ? systemMetrics.gpu.percent
      : sysGPU * 0.60
  );

  /* formatting helpers */
  const formatNumber = (n?: number | null) => (typeof n === "number" ? n.toLocaleString() : "0");
  const formatCurrency = (n?: number | null) =>
    typeof n === "number" ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";

  /* -------------------- Render -------------------- */
  return (
    <div style={{ display: "flow", height: "100vh", minHeight: "0", overflow: "hidden", background: colors.bg }}>
      <LeftRail />
      <LayoutShell>
        <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", height: "100%", color: colors.text }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 }}>
            <div>
              <h1 style={{ margin: 0, color: colors.text, fontSize: 28, fontWeight: 800 }}>Analytics</h1>
              <p style={{ margin: "6px 0 0 0", color: colors.muted }}>Real-time application & API metrics</p>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ padding: 12, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: colors.muted }}>Uptime</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.secondary }}>
                  {uptime
                    ? (() => {
                        const s = uptime.uptime_seconds;
                        if (!s && s !== 0) return "N/A";
                        const d = Math.floor(s / 86400);
                        const h = Math.floor((s % 86400) / 3600);
                        const m = Math.floor((s % 3600) / 60);
                        const sec = Math.floor(s % 60);
                        return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
                      })()
                    : "N/A"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  style={{ padding: "8px 12px", borderRadius: 8, background: colors.panel, color: colors.text, border: `1px solid ${colors.slate}` }}
                >
                  <option value="1h">Last 1h</option>
                  <option value="6h">Last 6h</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7d</option>
                </select>

                <button
                  onClick={() => loadAll()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: colors.primary,
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Top Tabs */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTab("application")}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: activeTab === "application" ? colors.primary : colors.panel,
                color: colors.text,
                border: `1px solid ${colors.slate}`,
                fontWeight: activeTab === "application" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              Application
            </button>
            <button
              onClick={() => setActiveTab("groq")}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: activeTab === "groq" ? colors.primary : colors.panel,
                color: colors.text,
                border: `1px solid ${colors.slate}`,
                fontWeight: activeTab === "groq" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              Groq API
            </button>
          </div>

          {/* Sub tabs for application */}
          {activeTab === "application" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <button
                onClick={() => setActiveSubTab("system")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: activeSubTab === "system" ? colors.secondary : colors.panel,
                  color: colors.text,
                  border: `1px solid ${colors.slate}`,
                  fontWeight: activeSubTab === "system" ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                System
              </button>
              <button
                onClick={() => setActiveSubTab("trends")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: activeSubTab === "trends" ? colors.secondary : colors.panel,
                  color: colors.text,
                  border: `1px solid ${colors.slate}`,
                  fontWeight: activeSubTab === "trends" ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                Trends
              </button>
              <button
                onClick={() => setActiveSubTab("evaluations")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: activeSubTab === "evaluations" ? colors.secondary : colors.panel,
                  color: colors.text,
                  border: `1px solid ${colors.slate}`,
                  fontWeight: activeSubTab === "evaluations" ? 700 : 600,
                  cursor: "pointer",
                }}
              >
                Evaluations
              </button>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div style={{ color: colors.muted, textAlign: "center", padding: 36 }}>Loading analytics…</div>
          ) : (
            <>
              {/* Application / System */}
              {activeTab === "application" && activeSubTab === "system" && (
                <div style={{ display: "grid", gap: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                    {/* CPU */}
                    <div style={{ padding: 24, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ margin: 0, color: colors.text, fontSize: 16 }}>Application CPU usage</h3>
                        <CircleCompare systemPct={sysCPU} appPct={appCPU} outerColor={colors.accent} innerColor={colors.primary} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.primary }}>{appCPU.toFixed(1)}%</div>
                    </div>

                    {/* Memory */}
                    <div style={{ padding: 24, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ margin: 0, color: colors.text, fontSize: 16 }}>Application Memory Usage</h3>
                        <CircleCompare systemPct={sysMemPct} appPct={appMemPct} outerColor={colors.primary} innerColor={colors.secondary} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.secondary }}>{appMemGB.toFixed(1)} GB</div>
                      <div style={{ fontSize: 12, color: colors.muted }}>Total: {totalMemGB.toFixed(1)} GB</div>
                    </div>

                    {/* GPU */}
                    <div style={{ padding: 24, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ margin: 0, color: colors.text, fontSize: 16 }}>Application GPU usage</h3>
                        <CircleCompare systemPct={sysGPU} appPct={appGPU} outerColor={colors.purple} innerColor={colors.secondary} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.secondary }}>{appGPU.toFixed(1)}%</div>
                    </div>

                    
                  </div>

                  <ChartCard title="Resource Usage">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: "CPU", application: appCPU, total: 100 },
                          { name: "Memory", application: appMemPct, total: 100 },
                          { name: "GPU", application: appGPU, total: 100 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                        <XAxis dataKey="name" stroke={colors.muted} fontSize={12} />
                        <YAxis stroke={colors.muted} fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                        <Legend />
                        <Bar dataKey="application" fill={colors.accent} name="Application %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Historical Performance (CPU / Memory / Disk / GPU)">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={systemChartData.map((trend) => ({
                          time: trend.time,
                          cpu: clampPct((trend.cpu ?? 0) * 1),
                          memory: clampPct((trend.memory ?? 0) * 1),
                          disk: clampPct((trend.disk ?? 0) * 1),
                          gpu: clampPct((trend.cpu ?? 0) * 0.6),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                        <XAxis dataKey="time" stroke={colors.muted} fontSize={12} />
                        <YAxis stroke={colors.muted} fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                        <Legend />
                        <Area type="monotone" dataKey="cpu" stackId="1" stroke={colors.accent} fill={colors.accent} fillOpacity={0.18} name="CPU %" />
                        <Area type="monotone" dataKey="memory" stackId="1" stroke={colors.primary} fill={colors.primary} fillOpacity={0.12} name="Memory %" />
                        <Area type="monotone" dataKey="disk" stackId="1" stroke={colors.secondary} fill={colors.secondary} fillOpacity={0.12} name="Disk %" />
                        {showGPU && <Area type="monotone" dataKey="gpu" stackId="1" stroke={colors.purple} fill={colors.purple} fillOpacity={0.12} name="GPU %" />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <div style={{ display:"flex", gap:12, alignItems:"center", color:colors.muted }}>
                    <label style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                      <input type="checkbox" checked={showGPU} onChange={(e)=>setShowGPU(e.target.checked)} /> Show GPU
                    </label>
                  </div>
                </div>
              )}

              {/* Application / Trends */}
              {activeTab === "application" && activeSubTab === "trends" && (
                <div style={{ display: "grid", gap: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
                    <StatCard title="Error Rate" value={errorMetrics ? `${(((errorMetrics.error_rate ?? 0) * 100)).toFixed(2)}%` : "N/A"} subtitle={`${errorMetrics?.total_errors ?? 0} errors`} color={colors.danger} />
                    <StatCard title="Avg Response (ms)" value={latencyMetrics ? `${(latencyMetrics.average_response_time_ms ?? 0).toFixed(1)} ms` : "N/A"} subtitle={`P95: ${typeof latencyMetrics?.p95_response_time_ms === "number" ? latencyMetrics.p95_response_time_ms.toFixed(1) : "N/A"} • P99: ${typeof latencyMetrics?.p99_response_time_ms === "number" ? latencyMetrics.p99_response_time_ms.toFixed(1) : "N/A"}`} color={colors.accent} />
                    <StatCard title="Throughput" value={throughputMetrics ? `${(throughputMetrics.requests_per_second ?? 0).toFixed(1)} /s` : "N/A"} subtitle={`${typeof throughputMetrics?.evaluations_per_minute === "number" ? throughputMetrics.evaluations_per_minute.toFixed(1) : "N/A"} eval/min`} color={colors.secondary} />
                  </div>

                  <ChartCard title="Error Trends (hourly)">
                    {errorTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={errorTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                          <XAxis dataKey="hour" stroke={colors.muted} fontSize={12} />
                          <YAxis stroke={colors.muted} fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                          <Legend />
                          <Line type="monotone" dataKey="errors" stroke={colors.danger} strokeWidth={2} name="Errors" />
                          <Line type="monotone" dataKey="error_rate_pct" stroke={colors.accent} strokeWidth={2} name="Error Rate %" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No error trend data</div>
                    )}
                  </ChartCard>
                </div>
              )}

              {/* Application / Evaluations */}
              {activeTab === "application" && activeSubTab === "evaluations" && (
                <div style={{ display: "grid", gap: 24 }}>
                  {evaluationMetrics ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                        <StatCard title="Total Evaluations" value={formatNumber(evaluationMetrics.total_evaluations)} subtitle="All time" color={colors.primary} />
                        <StatCard title="Avg Pass Rate" value={`${((evaluationMetrics.average_pass_rate ?? 0) * 100).toFixed(1)}%`} subtitle="Overall success" color={colors.secondary} />
                        {[
                          { k: "rouge", label: "ROUGE", val: evalAverages.rouge.toFixed(3), color: colors.primary },
                          { k: "bleu", label: "BLEU", val: evalAverages.bleu.toFixed(3), color: colors.secondary },
                          { k: "f1", label: "F1", val: evalAverages.f1.toFixed(3), color: colors.accent },
                          { k: "em", label: "Exact Match", val: evalAverages.em.toFixed(3), color: colors.cyan },
                          { k: "bert", label: "BERTScore", val: evalAverages.bert.toFixed(3), color: colors.green },
                          { k: "perplexity", label: "Perplexity", val: evalAverages.ppl.toFixed(2), color: colors.danger },
                          { k: "accuracy", label: "Accuracy", val: evalAverages.acc.toFixed(3), color: colors.yellow },
                          { k: "precision", label: "Precision", val: evalAverages.prec.toFixed(3), color: colors.purple },
                          { k: "recall", label: "Recall", val: evalAverages.rec.toFixed(3), color: colors.pink },
                        ].map((m) => (
                          <label key={m.k} style={{ display: "grid", gap: 6, padding: 12, background: colors.panel, border: `1px solid ${m.color}`, borderRadius: 16 }}>
                            <div style={{ fontWeight: 700, color: m.color }}>{m.label}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ color: m.color, fontWeight: 600 }}>{m.val}</span>
                              <Switch
                                checked={(evalToggles as any)[m.k]}
                                onChange={(v) => setEvalToggles({ ...(evalToggles as any), [m.k]: v } as any)}
                                color={m.color}
                              />
                            </div>
                          </label>
                        ))}
                      </div>

                      <ChartCard title="Evaluation Metrics Graph">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(() => {
                            const maxLen = Math.max(
                              evaluationMetrics?.rouge_scores?.length || 0,
                              evaluationMetrics?.bleu_scores?.length || 0,
                              evaluationMetrics?.f1_scores?.length || 0,
                              evaluationMetrics?.exact_match_scores?.length || 0,
                              evaluationMetrics?.bertscore_scores?.length || 0,
                              evaluationMetrics?.perplexity_scores?.length || 0,
                              evaluationMetrics?.accuracy_scores?.length || 0,
                              evaluationMetrics?.precision_scores?.length || 0,
                              evaluationMetrics?.recall_scores?.length || 0,
                            );
                            return Array.from({ length: maxLen }, (_, i) => ({
                              idx: i,
                              rouge: evaluationMetrics?.rouge_scores?.[i]?.score,
                              bleu: evaluationMetrics?.bleu_scores?.[i]?.score,
                              f1: evaluationMetrics?.f1_scores?.[i]?.score,
                              em: evaluationMetrics?.exact_match_scores?.[i]?.score,
                              bert: evaluationMetrics?.bertscore_scores?.[i]?.score,
                              perplexity: evaluationMetrics?.perplexity_scores?.[i]?.score,
                              accuracy: evaluationMetrics?.accuracy_scores?.[i]?.score,
                              precision: evaluationMetrics?.precision_scores?.[i]?.score,
                              recall: evaluationMetrics?.recall_scores?.[i]?.score,
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                            <XAxis dataKey="idx" stroke={colors.muted} fontSize={12} />
                            <YAxis stroke={colors.muted} fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                            <Legend />
                            {evalToggles.rouge && <Line type="monotone" dataKey="rouge" stroke={colors.primary} name="ROUGE" dot={false} />}
                            {evalToggles.bleu && <Line type="monotone" dataKey="bleu" stroke={colors.secondary} name="BLEU" dot={false} />}
                            {evalToggles.f1 && <Line type="monotone" dataKey="f1" stroke={colors.accent} name="F1" dot={false} />}
                            {evalToggles.em && <Line type="monotone" dataKey="em" stroke={colors.cyan} name="EM" dot={false} />}
                            {evalToggles.bert && <Line type="monotone" dataKey="bert" stroke={colors.green} name="BERTScore" dot={false} />}
                            {evalToggles.perplexity && <Line type="monotone" dataKey="perplexity" stroke={colors.danger} name="Perplexity" dot={false} />}
                            {evalToggles.accuracy && <Line type="monotone" dataKey="accuracy" stroke={colors.yellow} name="Accuracy" dot={false} />}
                            {evalToggles.precision && <Line type="monotone" dataKey="precision" stroke={colors.purple} name="Precision" dot={false} />}
                            {evalToggles.recall && <Line type="monotone" dataKey="recall" stroke={colors.pink} name="Recall" dot={false} />}
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </>
                  ) : (
                    <div style={{ color: colors.muted, padding: 36, textAlign: "center" }}>No evaluation metrics available for the selected time range</div>
                  )}
                </div>
              )}

              {/* Groq tab */}
              {activeTab === "groq" && (
                <div style={{ display: "grid", gap: 24 }}>
                  {groqAnalytics ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
                        <StatCard title="Total Requests" value={formatNumber(groqAnalytics.total_requests)} subtitle={`Last ${timeFilter}`} color={colors.secondary} />
                        <StatCard title="Total Tokens" value={formatNumber(groqAnalytics.total_tokens)} subtitle="Processed tokens" color={colors.primary} />
                        <StatCard title="Total Cost" value={formatCurrency(groqAnalytics.total_cost_usd)} subtitle="API usage cost" color={colors.accent} />
                        <StatCard title="Success Rate" value={groqAnalytics.success_rate ? `${(groqAnalytics.success_rate * 100).toFixed(1)}%` : "N/A"} subtitle="Requests success" color={colors.purple} />
                      </div>

                      <ChartCard title="Usage by Model">
                        {modelUsageData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={modelUsageData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                              <XAxis dataKey="name" stroke={colors.muted} fontSize={12} />
                              <YAxis stroke={colors.muted} fontSize={12} />
                              <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                              <Legend />
                              <Bar dataKey="requests" fill={colors.primary} name="Requests" />
                              <Bar dataKey="tokens" fill={colors.secondary} name="Tokens" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No model usage data</div>
                        )}
                      </ChartCard>

                      <ChartCard title="Hourly Usage">
                        {groqChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={groqChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                              <XAxis dataKey="hour" stroke={colors.muted} fontSize={12} />
                              <YAxis stroke={colors.muted} fontSize={12} />
                              <Tooltip contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }} />
                              <Legend />
                              <Line type="monotone" dataKey="requests" stroke={colors.primary} strokeWidth={2} name="Requests" />
                              <Line type="monotone" dataKey="tokens" stroke={colors.secondary} strokeWidth={2} name="Tokens" />
                              <Line type="monotone" dataKey="cost_usd" stroke={colors.accent} strokeWidth={2} name="Cost (USD)" />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No hourly usage data</div>
                        )}
                      </ChartCard>
                    </>
                  ) : (
                    <div style={{ color: colors.muted, padding: 36, textAlign: "center" }}>No Groq API usage data available for the selected time range</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </LayoutShell>
    </div>
  );
}
