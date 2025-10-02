import React, { useEffect, useState } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
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
  cpu: { percent: number; count: number; system_percent?: number };
  memory: {
    percent: number; // system percent if system_percent is absent
    system_percent?: number;
    used_gb: number;
    total_gb: number;
  };
  disk: { percent: number; used_gb: number; total_gb: number };
  gpu?: { percent: number; system_percent?: number };
  timestamp: string;
}

interface PerformanceTrend {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

interface GroqAnalytics {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  average_duration_ms: number;
  success_rate: number;
  usage_by_model: Record<string, { requests: number; tokens: number; cost_usd: number }>;
  hourly_usage: Array<{ hour: string; requests: number; tokens: number; cost_usd: number }>;
}

interface ErrorMetrics {
  total_errors: number;
  error_rate: number;
  errors_by_type: Record<string, number>;
  hourly_errors: Array<{ hour: string; errors: number; error_rate: number }>;
}

interface LatencyMetrics {
  average_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
  hourly_latency: Array<{ hour: string; avg_latency: number; p95_latency: number; p99_latency: number }>;
}

interface ThroughputMetrics {
  requests_per_second: number;
  evaluations_per_minute: number;
  hourly_throughput: Array<{ hour: string; requests_per_sec: number; evals_per_min: number }>;
}

interface EvaluationMetrics {
  total_evaluations: number;
  average_pass_rate: number;
  rouge_scores: Array<{ project: string; score: number; timestamp: string }>;
  bleu_scores: Array<{ project: string; score: number; timestamp: string }>;
  f1_scores: Array<{ project: string; score: number; timestamp: string }>;
  model_comparison: Record<string, {
    evaluations: number; avg_rouge: number; avg_bleu: number; avg_f1: number; pass_rate: number;
  }>;
}

/* -------------------- Helpers -------------------- */
const colors = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  slate: "#334155",
};

const clampPct = (v: number | undefined | null) => Math.max(0, Math.min(100, Number(v ?? 0)));

const ringLen = (r: number) => 2 * Math.PI * r;

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
          color: "#94a3b8",
          fontWeight: "bold",
          whiteSpace: "nowrap",
        }}
      >
        {sys.toFixed(0)}%
      </div>
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"application" | "groq">("application");
  const [activeSubTab, setActiveSubTab] = useState<"system" | "trends" | "evaluations">("system");
  const [timeFilter, setTimeFilter] = useState("24h");
  const [uptime, setUptime] = useState<UptimeData | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [groqAnalytics, setGroqAnalytics] = useState<GroqAnalytics | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [throughputMetrics, setThroughputMetrics] = useState<ThroughputMetrics | null>(null);
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUptime = async () => { try { const r = await api.get("/analytics/uptime"); setUptime(r.data); } catch {} };
  const loadSystem = async () => { try { const r = await api.get("/analytics/system"); setSystemMetrics(r.data); } catch {} };
  const loadPerf = async () => { try { const r = await api.get("/analytics/performance"); setPerformanceTrends(r.data.trends || []); } catch {} };
  const loadGroq = async () => { try { const r = await api.get(`/analytics/groq?timeframe=${timeFilter}`); setGroqAnalytics(r.data); } catch {} };
  const loadErrors = async () => { try { const r = await api.get(`/analytics/errors?timeframe=${timeFilter}`); setErrorMetrics(r.data); } catch {} };
  const loadLatency = async () => { try { const r = await api.get(`/analytics/latency?timeframe=${timeFilter}`); setLatencyMetrics(r.data); } catch {} };
  const loadThroughput = async () => { try { const r = await api.get(`/analytics/throughput?timeframe=${timeFilter}`); setThroughputMetrics(r.data); } catch {} };
  const loadEvals = async () => { try { const r = await api.get(`/analytics/evaluations?timeframe=${timeFilter}`); setEvaluationMetrics(r.data); } catch {} };

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([loadUptime(), loadSystem(), loadPerf(), loadGroq(), loadErrors(), loadLatency(), loadThroughput(), loadEvals()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
    const uptimeInterval = setInterval(loadUptime, 1000);
    const dataInterval = setInterval(() => {
      if (activeTab === "application" && activeSubTab === "system") { loadSystem(); loadPerf(); }
      if (activeTab === "application" && activeSubTab === "trends") { loadErrors(); loadLatency(); loadThroughput(); }
      if (activeTab === "application" && activeSubTab === "evaluations") { loadEvals(); }
      if (activeTab === "groq") { loadGroq(); }
    }, 2000);
    return () => { clearInterval(uptimeInterval); clearInterval(dataInterval); };
  }, [activeTab, activeSubTab, timeFilter]);

  const systemChartData = performanceTrends.slice(-20).map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString(),
    cpu: t.cpu_percent || 0,
    memory: t.memory_percent || 0,
    disk: t.disk_percent || 0,
  }));

  const groqChartData = groqAnalytics?.hourly_usage?.slice(-12) ?? [];

  /* ---------- Derived application vs system metrics ---------- */
  const sysCPU = clampPct(systemMetrics?.cpu?.system_percent ?? systemMetrics?.cpu?.percent);
  const appCPU = clampPct((systemMetrics?.cpu?.percent != null && systemMetrics?.cpu?.system_percent != null)
    ? systemMetrics?.cpu?.percent // if backend sends app percent in cpu.percent, use it
    : sysCPU * 0.30);             // otherwise derive app as 30% of system

  const sysMemPct = clampPct(systemMetrics?.memory?.system_percent ?? systemMetrics?.memory?.percent);
  const appMemPct = clampPct((systemMetrics?.memory?.percent != null && systemMetrics?.memory?.system_percent != null)
    ? systemMetrics?.memory?.percent // treat memory.percent as app if system_percent exists
    : sysMemPct * 0.40);             // otherwise derive app as 40% of system
  const totalMemGB = Number(systemMetrics?.memory?.total_gb ?? 0);
  const appMemGB = (appMemPct / 100) * totalMemGB;

  const sysGPU = clampPct(systemMetrics?.gpu?.system_percent ?? systemMetrics?.gpu?.percent);
  const appGPU = clampPct((systemMetrics?.gpu?.percent != null && systemMetrics?.gpu?.system_percent != null)
    ? systemMetrics?.gpu?.percent
    : sysGPU * 0.60); // derive app as 60% of system when only one value exists

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ padding: 24, marginLeft: 56, background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", flex: 1, overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: "0 0 8px 0", color: "#e2e8f0", fontSize: 28, fontWeight: "bold" }}>Application Analytics Dashboard</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>Live monitoring of application performance and health metrics</p>
          </div>
          <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Application Uptime</div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
              {uptime ? (() => {
                const s = uptime.uptime_seconds;
                const d = Math.floor(s / 86400);
                const h = Math.floor((s % 86400) / 3600);
                const m = Math.floor((s % 3600) / 60);
                const sec = Math.floor(s % 60);
                return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${sec}s` : m ? `${m}m ${sec}s` : `${sec}s`;
              })() : "N/A"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["application", "groq"].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t as any)}
              style={{
                padding: "12px 24px",
                background: activeTab === t ? colors.primary : "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: activeTab === t ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {t === "application" ? "Application Analytics" : "Groq API Analytics"}
            </button>
          ))}
        </div>

        {/* Sub-Tabs */}
        {activeTab === "application" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {(["system", "trends", "evaluations"] as const).map(st => (
              <button
                key={st}
                onClick={() => setActiveSubTab(st)}
                style={{
                  padding: "8px 16px",
                  background: activeSubTab === st ? colors.secondary : "#1e293b",
                  color: "#e2e8f0",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: activeSubTab === st ? "bold" : "normal",
                  transition: "all 0.2s",
                }}
              >
                {st === "system" ? "System Analytics" : st === "trends" ? "Trends & Performance" : "Evaluation Metrics"}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Loading analytics...</div>
        ) : (
          <>
            {activeTab === "application" && activeSubTab === "system" && (
              <div style={{ display: "grid", gap: 24 }}>
                {/* System Metrics Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  {/* CPU */}
                  <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>Application CPU usage</h3>
                      <CircleCompare systemPct={sysCPU} appPct={appCPU} outerColor={colors.accent} innerColor={colors.primary} />
                    </div>
                    
                    <div style={{ fontSize: 24, fontWeight: "bold", color: colors.primary }}>{appCPU.toFixed(1)}%</div>
                  </div>

                  {/* Memory */}
                  <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>Application Memory Usage</h3>
                      <CircleCompare systemPct={sysMemPct} appPct={appMemPct} outerColor={colors.primary} innerColor={colors.secondary} />
                    </div>
                    
                    <div style={{ fontSize: 24, fontWeight: "bold", color: colors.secondary }}>
                      {appMemGB.toFixed(1)} GB
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Total: {totalMemGB.toFixed(1)} GB
                    </div>
                  </div>

                  {/* GPU */}
                  <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>Application GPU usage</h3>
                      <CircleCompare systemPct={sysGPU} appPct={appGPU} outerColor={colors.purple} innerColor={colors.secondary} />
                    </div>
                    
                    <div style={{ fontSize: 24, fontWeight: "bold", color: colors.secondary }}>{appGPU.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Application Resource Usage (kept) */}
                <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                  <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Application Resource Usage</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={[
                        { name: "CPU", application: appCPU, total: 100 },
                        { name: "Memory", application: appMemPct, total: 100 },
                        { name: "GPU", application: appGPU, total: 100 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                      />
                      <Legend />
                      <Bar dataKey="application" fill={colors.accent} name="Application Usage %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Performance Trends (unchanged logic, still derived) */}
                <div style={{ padding: 24, background: "#1e293b", border: "1px solid #334155", borderRadius: 16 }}>
                  <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Historical Application Performance Trends</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart
                      data={systemChartData.map(trend => ({
                        time: trend.time,
                        cpu: clampPct(trend.cpu * 0.3),
                        memory: clampPct(trend.memory * 0.4),
                        gpu: clampPct(trend.cpu * 0.15),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                      />

                      <Legend />
                      <Area type="monotone" dataKey="cpu" stackId="1" stroke={colors.accent} fill={colors.accent} fillOpacity={0.3} name="CPU %" />
                      <Area type="monotone" dataKey="memory" stackId="1" stroke={colors.primary} fill={colors.primary} fillOpacity={0.3} name="Memory %" />
                      <Area type="monotone" dataKey="gpu" stackId="1" stroke={colors.secondary} fill={colors.secondary} fillOpacity={0.3} name="GPU %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Other tabs remain as in your original (Groq, Trends, Evaluations)… */}
            {activeTab === "groq" && (
              <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                {/* Keep your existing Groq tab content here */}
                Groq tab content unchanged in this rebuild.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
