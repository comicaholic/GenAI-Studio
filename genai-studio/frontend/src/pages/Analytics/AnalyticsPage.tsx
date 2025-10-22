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
  cpu?: { 
    percent?: number; 
    count?: number; 
    system_percent?: number;
    app_percent?: number;
  };
  memory?: {
    percent?: number; // system percent
    system_percent?: number;
    app_percent?: number;
    used_gb?: number;
    total_gb?: number;
    app_used_mb?: number;
  };
  disk?: { percent?: number; used_gb?: number; total_gb?: number };
  gpu?: { 
    percent?: number; 
    system_percent?: number;
    app_percent?: number;
    name?: string;
    temperature?: number;
    memory_used_gb?: number;
    memory_total_gb?: number;
  };
  timestamp?: string;
  docker_warning?: {
    message: string;
    recommendation: string;
    limitations: string[];
  };
}

interface PerformanceTrend {
  timestamp: string;
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  gpu_percent?: number;
  app_cpu_percent?: number;
  app_memory_percent?: number;
  app_memory_mb?: number;
  app_gpu_percent?: number;
  app_threads?: number;
  app_fds?: number;
}

interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
  disk: number;
  gpu: number;
  appCpu: number;
  appMemory: number;
  appGpu: number;
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
  warning: "#f59e0b",
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

const clampPct = (v?: number | null) => {
  const value = Number(v ?? 0);
  const clamped = Math.max(0, Math.min(100, value));
  // Use parseFloat to avoid floating point precision issues
  return parseFloat(clamped.toFixed(1));
};

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
function StatCard({ title, value, subtitle, color = "#3b82f6" }: { title: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div style={{ 
      padding: 24, 
      background: "#0f172a", 
      border: "1px solid #334155", 
      borderRadius: 16, 
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      transition: "all 0.2s ease"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
          {subtitle && <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

/* Loading spinner component */
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: size,
      height: size,
      animation: 'spin 1s linear infinite'
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="2" opacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

/* Skeleton loading component */
function SkeletonCard({ width = "100%", height = 200 }: { width?: string; height?: string | number }) {
  return (
    <div style={{
      width,
      height,
      background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: 12,
      border: "1px solid #334155"
    }} />
  );
}

/* Chart card wrapper */
function ChartCard({ title, children, isLoading = false }: { title: string; children: React.ReactNode; isLoading?: boolean }) {
  return (
    <div style={{ 
      padding: 24, 
      background: "#0f172a", 
      border: "1px solid #334155", 
      borderRadius: 16, 
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" 
    }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 18, fontWeight: 600 }}>{title}</h3>
        {isLoading && <LoadingSpinner size={20} />}
      </div>
      <div style={{ width: "100%", height: 360 }}>
        {isLoading ? <SkeletonCard height="100%" /> : children}
      </div>
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"application" | "groq">("application");
  const [activeSubTab, setActiveSubTab] = useState<"system" | "trends" | "evaluations">("system");
  const [timeFilter, setTimeFilter] = useState<"1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "all">("30d");
  const [dataInterval, setDataInterval] = useState<"1min" | "5min" | "15min" | "1h">("5min");
  const [uptime, setUptime] = useState<UptimeData | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [groqAnalytics, setGroqAnalytics] = useState<GroqAnalytics | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [throughputMetrics, setThroughputMetrics] = useState<ThroughputMetrics | null>(null);
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null);
  // loading states (granular) for better UX and performance
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [loadingGroq, setLoadingGroq] = useState(false);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [loadingLatency, setLoadingLatency] = useState(false);
  const [loadingThroughput, setLoadingThroughput] = useState(false);
  const [loadingEvals, setLoadingEvals] = useState(false);
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
      setLoadingSystem(true);
      const r = await api.get("/analytics/system");
      console.log('System API Response:', r.data);
      setSystemMetrics(r.data);
    } catch (e) {
      console.error('Error loading system data:', e);
    } finally { setLoadingSystem(false); }
  }, []);

  const loadPerf = useCallback(async () => {
    try {
      setLoadingPerf(true);
      // Convert dataInterval to minutes for backend
      const intervalMinutes = dataInterval === "1min" ? 1 : 
                             dataInterval === "5min" ? 5 : 
                             dataInterval === "15min" ? 15 : 
                             dataInterval === "1h" ? 60 : 5;
      
      const r = await api.get(`/analytics/performance?timeframe=${timeFilter}&interval_minutes=${intervalMinutes}`);
      
      console.log('Performance API Response:', r.data);
      
      // Ensure we have valid data structure
      const trends = r.data?.trends ?? [];
      
      // Validate and clean the data
      const validTrends = trends.filter((trend: any) => {
        const hasTimestamp = trend.timestamp && typeof trend.timestamp === 'string';
        const hasValidData = typeof trend.cpu_percent === 'number' || 
                           typeof trend.memory_percent === 'number' ||
                           typeof trend.gpu_percent === 'number';
        return hasTimestamp && hasValidData;
      });
      
      console.log('Valid trends count:', validTrends.length);
      setPerformanceTrends(validTrends);
    } catch (e) {
      console.error('Error loading performance data:', e);
      // Set empty array if API fails
      setPerformanceTrends([]);
    } finally { setLoadingPerf(false); }
  }, [timeFilter, dataInterval]);

  const loadGroq = useCallback(async () => {
    try {
      setLoadingGroq(true);
      const r = await api.get(`/analytics/groq?timeframe=${timeFilter}`);
      console.log('Groq API Response:', r.data);
      console.log('Total requests:', r.data?.total_requests);
      console.log('Total tokens:', r.data?.total_tokens);
      console.log('Hourly usage count:', r.data?.hourly_usage?.length);
      setGroqAnalytics(r.data);
    } catch (e) {
      console.error('Error loading Groq data:', e);
    } finally { setLoadingGroq(false); }
  }, [timeFilter]);

  const loadErrors = useCallback(async () => {
    try {
      setLoadingErrors(true);
      const r = await api.get(`/analytics/errors?timeframe=${timeFilter}`);
      console.log('Errors API Response:', r.data);
      console.log('Total errors:', r.data?.total_errors);
      console.log('Error rate:', r.data?.error_rate);
      setErrorMetrics(r.data);
    } catch (e) {
      console.error('Error loading error metrics:', e);
    } finally { setLoadingErrors(false); }
  }, [timeFilter]);

  const loadLatency = useCallback(async () => {
    try {
      setLoadingLatency(true);
      const r = await api.get(`/analytics/latency?timeframe=${timeFilter}`);
      console.log('Latency API Response:', r.data);
      console.log('Average latency:', r.data?.average_response_time_ms);
      console.log('P95 latency:', r.data?.p95_response_time_ms);
      setLatencyMetrics(r.data);
    } catch (e) {
      console.error('Error loading latency metrics:', e);
    } finally { setLoadingLatency(false); }
  }, [timeFilter]);

  const loadThroughput = useCallback(async () => {
    try {
      setLoadingThroughput(true);
      const r = await api.get(`/analytics/throughput?timeframe=${timeFilter}`);
      console.log('Throughput API Response:', r.data);
      console.log('Requests per second:', r.data?.requests_per_second);
      console.log('Evaluations per minute:', r.data?.evaluations_per_minute);
      setThroughputMetrics(r.data);
    } catch (e) {
      console.error('Error loading throughput metrics:', e);
    } finally { setLoadingThroughput(false); }
  }, [timeFilter]);

  const loadEvals = useCallback(async () => {
    try {
      setLoadingEvals(true);
      const r = await api.get(`/analytics/evaluations?timeframe=${timeFilter}`);
      console.log('Evaluations API Response:', r.data);
      console.log('Total evaluations:', r.data?.total_evaluations);
      console.log('Rouge scores count:', r.data?.rouge_scores?.length);
      console.log('Bleu scores count:', r.data?.bleu_scores?.length);
      setEvaluationMetrics(r.data);
    } catch (e) {
      console.error('Error loading evaluation data:', e);
      setEvaluationMetrics(null);
    } finally { setLoadingEvals(false); }
  }, [timeFilter]);

  // optimized loader: only fetch what is visible
  const loadVisible = useCallback(async () => {
    setIsInitialLoading(true);
    const tasks: Promise<any>[] = [loadUptime()];
    if (activeTab === "application") {
      if (activeSubTab === "system") {
        tasks.push(loadSystem(), loadPerf());
      } else if (activeSubTab === "trends") {
        tasks.push(loadErrors(), loadLatency(), loadThroughput());
      } else if (activeSubTab === "evaluations") {
        tasks.push(loadEvals());
      }
    } else if (activeTab === "groq") {
      tasks.push(loadGroq());
    }
    await Promise.all(tasks);
    setIsInitialLoading(false);
  }, [activeTab, activeSubTab, loadUptime, loadSystem, loadPerf, loadErrors, loadLatency, loadThroughput, loadEvals, loadGroq]);

  useEffect(() => {
    loadVisible();
    const uptimeInterval = setInterval(loadUptime, 2_000);
    const dataInterval = setInterval(() => {
      // targeted refresh depending on tab - reduced frequency to prevent jitter
      if (activeTab === "application" && activeSubTab === "system") {
        loadSystem();
        // Always reload performance data when timeframe changes
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
    }, 5_000);
    return () => {
      clearInterval(uptimeInterval);
      clearInterval(dataInterval);
    };
  }, [activeTab, activeSubTab, timeFilter, loadVisible, loadUptime, loadSystem, loadPerf, loadGroq, loadErrors, loadLatency, loadThroughput, loadEvals]);

  // Separate effect to reload performance data when timeframe changes
  useEffect(() => {
    if (activeTab === "application" && activeSubTab === "system") {
      loadPerf();
    }
  }, [timeFilter, dataInterval, loadPerf, activeTab, activeSubTab]);

  /* ---------- Derived & mapped data for charts ---------- */
  const systemChartData = useMemo(
    (): ChartDataPoint[] => {
      if (!performanceTrends || performanceTrends.length === 0) {
        // placeholder to render axes with no data
        return [{ time: "-", cpu: 0, memory: 0, disk: 0, gpu: 0, appCpu: 0, appMemory: 0, appGpu: 0 }];
      }
      
      const chartData: ChartDataPoint[] = [];
      
      performanceTrends.forEach((t) => {
        const date = new Date(t.timestamp);
        let timeLabel: string;
        
        // Since backend now groups data into configurable intervals, we can display cleaner labels
        if (timeFilter === "1h") {
          timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (timeFilter === "6h") {
          timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (timeFilter === "24h") {
          // Show every data point
          timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else { // 7d
          timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        
        chartData.push({
          time: timeLabel,
          cpu: clampPct(t.cpu_percent ?? 0),
          memory: clampPct(t.memory_percent ?? 0),
          disk: clampPct(t.disk_percent ?? 0),
          gpu: clampPct(t.gpu_percent ?? 0),
          appCpu: clampPct(t.app_cpu_percent ?? 0),
          appMemory: clampPct(t.app_memory_percent ?? 0),
          appGpu: clampPct(t.app_gpu_percent ?? 0),
        });
      });
      
      return chartData;
    },
    [performanceTrends, timeFilter]
  );

  const groqChartData = groqAnalytics?.hourly_usage?.slice(-24)?.map(item => ({
    ...item,
    cost_usd: parseFloat((item.cost_usd ?? 0).toFixed(4)),
  })) ?? [];

  const modelUsageData =
    groqAnalytics?.usage_by_model
      ? Object.entries(groqAnalytics.usage_by_model).map(([name, v]) => ({
          name,
          requests: v?.requests ?? 0,
          tokens: v?.tokens ?? 0,
          cost_usd: parseFloat((v?.cost_usd ?? 0).toFixed(4)),
        }))
      : [];

  const errorTrendData =
    errorMetrics?.hourly_errors?.map((pt) => ({
      hour: pt.hour,
      errors: pt.errors ?? 0,
      error_rate_pct: parseFloat(((pt.error_rate ?? 0) * 100).toFixed(1)),
    })) ?? [];

  /* ---------- Evaluation metrics (averages) ---------- */
  const evalAverages = useMemo(() => {
    if (!evaluationMetrics) {
      return { em: 0, bleu: 0, rouge: 0, f1: 0, bert: 0, ppl: 0, acc: 0, prec: 0, rec: 0 };
    }
    
    // Handle the new backend structure with individual score arrays
    const em = Array.isArray(evaluationMetrics?.exact_match_scores) && evaluationMetrics.exact_match_scores.length
      ? evaluationMetrics.exact_match_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.exact_match_scores.length
      : 0;
    const bleu = Array.isArray(evaluationMetrics?.bleu_scores) && evaluationMetrics.bleu_scores.length
      ? evaluationMetrics.bleu_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.bleu_scores.length
      : 0;
    const rouge = Array.isArray(evaluationMetrics?.rouge_scores) && evaluationMetrics.rouge_scores.length
      ? evaluationMetrics.rouge_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.rouge_scores.length
      : 0;
    const f1 = Array.isArray(evaluationMetrics?.f1_scores) && evaluationMetrics.f1_scores.length
      ? evaluationMetrics.f1_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.f1_scores.length
      : 0;
    const bert = Array.isArray(evaluationMetrics?.bertscore_scores) && evaluationMetrics.bertscore_scores.length
      ? evaluationMetrics.bertscore_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.bertscore_scores.length
      : 0;
    const ppl = Array.isArray(evaluationMetrics?.perplexity_scores) && evaluationMetrics.perplexity_scores.length
      ? evaluationMetrics.perplexity_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.perplexity_scores.length
      : 0;
    const acc = Array.isArray(evaluationMetrics?.accuracy_scores) && evaluationMetrics.accuracy_scores.length
      ? evaluationMetrics.accuracy_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.accuracy_scores.length
      : 0;
    const prec = Array.isArray(evaluationMetrics?.precision_scores) && evaluationMetrics.precision_scores.length
      ? evaluationMetrics.precision_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.precision_scores.length
      : 0;
    const rec = Array.isArray(evaluationMetrics?.recall_scores) && evaluationMetrics.recall_scores.length
      ? evaluationMetrics.recall_scores.reduce((s: number, r: { score?: number }) => s + (r.score ?? 0), 0) / evaluationMetrics.recall_scores.length
      : 0;
    
    return { 
      em: parseFloat(em.toFixed(3)), 
      bleu: parseFloat(bleu.toFixed(3)), 
      rouge: parseFloat(rouge.toFixed(3)), 
      f1: parseFloat(f1.toFixed(3)), 
      bert: parseFloat(bert.toFixed(3)), 
      ppl: parseFloat(ppl.toFixed(2)), 
      acc: parseFloat(acc.toFixed(3)), 
      prec: parseFloat(prec.toFixed(3)), 
      rec: parseFloat(rec.toFixed(3)) 
    };
  }, [evaluationMetrics]);

  /* ---------- Application <> system derivations (using real metrics) ---------- */
  const sysCPU = clampPct(systemMetrics?.cpu?.system_percent ?? systemMetrics?.cpu?.percent ?? 0);
  const appCPU = clampPct(systemMetrics?.cpu?.app_percent ?? 0);

  const sysMemPct = clampPct(systemMetrics?.memory?.system_percent ?? systemMetrics?.memory?.percent ?? 0);
  const appMemPct = clampPct(systemMetrics?.memory?.app_percent ?? 0);
  const totalMemGB = Number(systemMetrics?.memory?.total_gb ?? 0);
  const appMemMB = Number(systemMetrics?.memory?.app_used_mb ?? 0);
  const appMemGB = appMemMB / 1024; // Convert MB to GB

  const sysGPU = clampPct(systemMetrics?.gpu?.system_percent ?? systemMetrics?.gpu?.percent ?? 0);
  const appGPU = clampPct(systemMetrics?.gpu?.app_percent ?? 0);

  /* formatting helpers */
  const formatNumber = (n?: number | null) => (typeof n === "number" ? n.toLocaleString() : "0");
  const formatCurrency = (n?: number | null) =>
    typeof n === "number" ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "$0.00";

  /* -------------------- Render -------------------- */
  return (
    <LayoutShell title="Analytics">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ 
        width: "100%", 
        maxWidth: 1400, 
        margin: "0 auto", 
        color: "#e2e8f0",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 24
      }}>
          {/* Modern Header */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            gap: 24,
            padding: "24px",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 16,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", 
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
                </svg>
              </div>
              <div>
                <h1 style={{ margin: 0, color: "#e2e8f0", fontSize: 28, fontWeight: 700 }}>Analytics</h1>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 14 }}>Real-time application & API metrics</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {/* Uptime Card */}
              <div style={{ 
                padding: "16px 20px", 
                background: "#1e293b", 
                border: "1px solid #334155", 
                borderRadius: 12, 
                textAlign: "center",
                minWidth: 120
              }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, fontWeight: 500 }}>Uptime</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
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

              {/* Controls */}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  style={{ 
                    padding: "10px 16px", 
                    borderRadius: 10, 
                    background: "#1e293b", 
                    color: "#e2e8f0", 
                    border: "1px solid #334155",
                    fontSize: 14,
                    fontWeight: 500,
                    outline: "none",
                    transition: "all 0.2s ease"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#334155";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="1h">Last 1h</option>
                  <option value="6h">Last 6h</option>
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7d</option>
                  <option value="30d">Last 30d</option>
                  <option value="90d">Last 90d</option>
                  <option value="all">All time</option>
                </select>

                <button
                  onClick={() => loadVisible()}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(59, 130, 246, 0.3)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div style={{ 
            display: "flex", 
            background: "#0f172a", 
            borderRadius: 12, 
            padding: 6,
            border: "1px solid #334155",
            gap: 4
          }}>
            <button
              onClick={() => setActiveTab("application")}
              style={{
                flex: 1,
                padding: "12px 20px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "application" 
                  ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                  : "transparent",
                color: activeTab === "application" ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "application") {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.color = "#e2e8f0";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "application") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
              </svg>
              Application
            </button>
            <button
              onClick={() => setActiveTab("groq")}
              style={{
                flex: 1,
                padding: "12px 20px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "groq" 
                  ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" 
                  : "transparent",
                color: activeTab === "groq" ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "groq") {
                  e.currentTarget.style.background = "#1e293b";
                  e.currentTarget.style.color = "#e2e8f0";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "groq") {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
              </svg>
              Groq API
            </button>
          </div>

          {/* Sub tabs for application */}
          {activeTab === "application" && (
            <div style={{ 
              display: "flex", 
              background: "#0f172a", 
              borderRadius: 10, 
              padding: 4,
              border: "1px solid #334155",
              gap: 4,
              width: "fit-content"
            }}>
              <button
                onClick={() => setActiveSubTab("system")}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeSubTab === "system" 
                    ? "linear-gradient(135deg, #10b981, #059669)" 
                    : "transparent",
                  color: activeSubTab === "system" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (activeSubTab !== "system") {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.color = "#e2e8f0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSubTab !== "system") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
              >
                System
              </button>
              <button
                onClick={() => setActiveSubTab("trends")}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeSubTab === "trends" 
                    ? "linear-gradient(135deg, #10b981, #059669)" 
                    : "transparent",
                  color: activeSubTab === "trends" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (activeSubTab !== "trends") {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.color = "#e2e8f0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSubTab !== "trends") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
              >
                Trends
              </button>
              <button
                onClick={() => setActiveSubTab("evaluations")}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: activeSubTab === "evaluations" 
                    ? "linear-gradient(135deg, #10b981, #059669)" 
                    : "transparent",
                  color: activeSubTab === "evaluations" ? "#ffffff" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (activeSubTab !== "evaluations") {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.color = "#e2e8f0";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSubTab !== "evaluations") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#94a3b8";
                  }
                }}
              >
                Evaluations
              </button>
            </div>
          )}

          {/* Content */}
          {isInitialLoading ? (
            <div style={{ color: colors.muted, textAlign: "center", padding: 36 }}>Loading analytics…</div>
          ) : (
            <>
              {/* Application / System */}
              {activeTab === "application" && activeSubTab === "system" && (
                <div style={{ display: "grid", gap: 24 }}>
                  {/* Docker Warning Banner */}
                  {systemMetrics?.docker_warning && (
                    <div style={{ 
                      padding: 16, 
                      background: colors.warning + '20', 
                      border: `1px solid ${colors.warning}`, 
                      borderRadius: 12, 
                      marginBottom: 20,
                      color: colors.text
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 18, marginRight: 8 }}>⚠️</span>
                        <strong style={{ color: colors.warning }}>Docker Limitations Detected</strong>
                      </div>
                      <div style={{ marginBottom: 8, fontSize: 14 }}>
                        {systemMetrics.docker_warning.message}
                      </div>
                      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        💡 {systemMetrics.docker_warning.recommendation}
                      </div>
                      <div style={{ fontSize: 12, color: colors.muted }}>
                        <strong>Current limitations:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {systemMetrics.docker_warning.limitations.map((limitation, index) => (
                            <li key={index}>{limitation}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

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
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.secondary }}>{Math.round(appMemMB)} MB</div>
                      <div style={{ fontSize: 12, color: colors.muted }}>Total System: {totalMemGB.toFixed(1)} GB</div>
                    </div>

                    {/* GPU */}
                    <div style={{ padding: 24, background: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ margin: 0, color: colors.text, fontSize: 16 }}>GPU Usage</h3>
                        <CircleCompare systemPct={sysGPU} appPct={appGPU} outerColor={colors.purple} innerColor={colors.secondary} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: colors.secondary }}>{appGPU.toFixed(1)}%</div>
                      {systemMetrics?.gpu?.name && (
                        <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                          {systemMetrics.gpu.name}
                        </div>
                      )}
                      {systemMetrics?.gpu?.temperature && (
                        <div style={{ fontSize: 12, color: colors.muted }}>
                          Temp: {systemMetrics.gpu.temperature}°C
                        </div>
                      )}
                      {systemMetrics?.gpu?.memory_used_gb && systemMetrics?.gpu?.memory_total_gb && (
                        <div style={{ fontSize: 12, color: colors.muted }}>
                          Memory: {systemMetrics.gpu.memory_used_gb.toFixed(1)}/{systemMetrics.gpu.memory_total_gb.toFixed(1)} GB
                        </div>
                      )}
                    </div>

                    
                  </div>

                  <ChartCard title="Resource Usage" isLoading={loadingSystem}>
                    {!loadingSystem && (
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
                          <Tooltip 
                            contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }}
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                          />
                          <Legend />
                          <Bar dataKey="application" fill={colors.accent} name="Application %" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  {/* Chart Controls */}
                  <div style={{ 
                    display: "flex", 
                    gap: 16, 
                    alignItems: "center", 
                    padding: "16px 20px",
                    background: colors.panel,
                    border: `1px solid ${colors.slate}`,
                    borderRadius: 12,
                    marginBottom: 8
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <label style={{ color: colors.muted, fontSize: 14, fontWeight: 500 }}>Time Range:</label>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as any)}
                        style={{ 
                          padding: "8px 12px", 
                          borderRadius: 8, 
                          background: "#0f172a", 
                          color: "#e2e8f0", 
                          border: "1px solid #334155",
                          fontSize: 14,
                          fontWeight: 500,
                          outline: "none",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <option value="1h">Last 1h</option>
                        <option value="6h">Last 6h</option>
                        <option value="24h">Last 24h</option>
                        <option value="7d">Last 7d</option>
                        <option value="30d">Last 30d</option>
                        <option value="90d">Last 90d</option>
                        <option value="all">All time</option>
                      </select>
                    </div>
                    
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <label style={{ color: colors.muted, fontSize: 14, fontWeight: 500 }}>Data Interval:</label>
                      <select
                        value={dataInterval}
                        onChange={(e) => setDataInterval(e.target.value as any)}
                        style={{ 
                          padding: "8px 12px", 
                          borderRadius: 8, 
                          background: "#0f172a", 
                          color: "#e2e8f0", 
                          border: "1px solid #334155",
                          fontSize: 14,
                          fontWeight: 500,
                          outline: "none",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <option value="1min">1 minute</option>
                        <option value="5min">5 minutes</option>
                        <option value="15min">15 minutes</option>
                        <option value="1h">1 hour</option>
                      </select>
                    </div>
                  </div>

                  <ChartCard title={`Historical Performance (Overlapping Metrics) - Last ${timeFilter} (${dataInterval} intervals)`} isLoading={loadingPerf}>
                    {!loadingPerf && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={systemChartData}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                          <XAxis 
                            dataKey="time" 
                            stroke={colors.muted} 
                            fontSize={11}
                            interval="preserveStartEnd"
                            tick={{ fill: colors.muted }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            stroke={colors.muted} 
                            fontSize={12} 
                            domain={[0, 100]}
                            tick={{ fill: colors.muted }}
                            label={{ value: 'Usage %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: colors.muted } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: colors.panel, 
                              border: `1px solid ${colors.slate}`, 
                              borderRadius: 8, 
                              color: colors.text,
                              fontSize: 12
                            }}
                            formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                            labelStyle={{ color: colors.text, fontSize: 12 }}
                          />
                          <Legend />
                          {/* System metrics - overlapping areas, not stacked */}
                          <Area type="monotone" dataKey="cpu" stroke={colors.accent} fill={colors.accent} fillOpacity={0.15} name="System CPU %" />
                          <Area type="monotone" dataKey="memory" stroke={colors.primary} fill={colors.primary} fillOpacity={0.10} name="System Memory %" />
                          <Area type="monotone" dataKey="disk" stroke={colors.secondary} fill={colors.secondary} fillOpacity={0.10} name="System Disk %" />
                          {showGPU && <Area type="monotone" dataKey="gpu" stroke={colors.purple} fill={colors.purple} fillOpacity={0.10} name="System GPU %" />}
                          
                          {/* Application metrics - overlapping areas with dashed lines */}
                          <Area type="monotone" dataKey="appCpu" stroke={colors.accent} fill={colors.accent} fillOpacity={0.25} name="App CPU %" strokeDasharray="5 5" />
                          <Area type="monotone" dataKey="appMemory" stroke={colors.primary} fill={colors.primary} fillOpacity={0.20} name="App Memory %" strokeDasharray="5 5" />
                          {showGPU && <Area type="monotone" dataKey="appGpu" stroke={colors.purple} fill={colors.purple} fillOpacity={0.20} name="App GPU %" strokeDasharray="5 5" />}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
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

                  <ChartCard title="Error Trends (hourly)" isLoading={loadingErrors || loadingLatency}>
                    {!(loadingErrors || loadingLatency) && (
                      errorTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={errorTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                            <XAxis dataKey="hour" stroke={colors.muted} fontSize={12} />
                            <YAxis stroke={colors.muted} fontSize={12} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }}
                              formatter={(value: any, name: string) => {
                                if (name === "Error Rate %") {
                                  return [`${Number(value).toFixed(1)}%`, name];
                                }
                                return [value, name];
                              }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="errors" stroke={colors.danger} strokeWidth={2} name="Errors" />
                            <Line type="monotone" dataKey="error_rate_pct" stroke={colors.accent} strokeWidth={2} name="Error Rate %" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No error trend data</div>
                      )
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
                        <StatCard title="Total Evaluations" value={formatNumber(evaluationMetrics.total_evaluations || 0)} subtitle="All time" color={colors.primary} />
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

                      <ChartCard title="Evaluation Metrics Graph" isLoading={loadingEvals}>
                        {!loadingEvals && (
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
                              <Tooltip 
                                contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }}
                                formatter={(value: any, name: string) => {
                                  if (name === "Perplexity") {
                                    return [`${Number(value).toFixed(2)}`, name];
                                  }
                                  return [`${Number(value).toFixed(3)}`, name];
                                }}
                              />
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
                        )}
                      </ChartCard>
                    </>
                  ) : (
                    <ChartCard title="Evaluation Metrics Graph" isLoading={loadingEvals}>
                      {!loadingEvals && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[{ idx: 0 }]}> 
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                            <XAxis dataKey="idx" stroke={colors.muted} fontSize={12} />
                            <YAxis stroke={colors.muted} fontSize={12} />
                            <Legend />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </ChartCard>
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

                      <ChartCard title="Usage by Model" isLoading={loadingGroq}>
                        {!loadingGroq && (
                          modelUsageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={modelUsageData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                                <XAxis dataKey="name" stroke={colors.muted} fontSize={12} />
                                <YAxis stroke={colors.muted} fontSize={12} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }}
                                  formatter={(value: any, name: string) => {
                                    if (name === "Cost (USD)") {
                                      return [`$${Number(value).toFixed(4)}`, name];
                                    }
                                    return [value, name];
                                  }}
                                />
                                <Legend />
                                <Bar dataKey="requests" fill={colors.primary} name="Requests" />
                                <Bar dataKey="tokens" fill={colors.secondary} name="Tokens" />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No model usage data</div>
                          )
                        )}
                      </ChartCard>

                      <ChartCard title="Hourly Usage" isLoading={loadingGroq}>
                        {!loadingGroq && (
                          groqChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={groqChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                                <XAxis dataKey="hour" stroke={colors.muted} fontSize={12} />
                                <YAxis stroke={colors.muted} fontSize={12} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: colors.panel, border: `1px solid ${colors.slate}`, borderRadius: 8, color: colors.text }}
                                  formatter={(value: any, name: string) => {
                                    if (name === "Cost (USD)") {
                                      return [`$${Number(value).toFixed(4)}`, name];
                                    }
                                    return [value, name];
                                  }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="requests" stroke={colors.primary} strokeWidth={2} name="Requests" />
                                <Line type="monotone" dataKey="tokens" stroke={colors.secondary} strokeWidth={2} name="Tokens" />
                                <Line type="monotone" dataKey="cost_usd" stroke={colors.accent} strokeWidth={2} name="Cost (USD)" />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ color: colors.muted, padding: 28, textAlign: "center" }}>No hourly usage data</div>
                          )
                        )}
                      </ChartCard>
                    </>
                  ) : (
                    <ChartCard title="Groq Usage" isLoading={loadingGroq}>
                      {!loadingGroq && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[{ hour: "-", requests: 0 }]}> 
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.slate} />
                            <XAxis dataKey="hour" stroke={colors.muted} fontSize={12} />
                            <YAxis stroke={colors.muted} fontSize={12} />
                            <Legend />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </ChartCard>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </LayoutShell>
  );
}
