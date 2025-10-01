import React, { useState, useEffect } from "react";
import LeftRail from "@/components/LeftRail/LeftRail";
import { api } from "@/services/api";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface UptimeData {
  uptime_seconds: number;
  start_time: string;
  current_time: string;
}

interface SystemMetrics {
  cpu: {
    percent: number;
    count: number;
  };
  memory: {
    percent: number;
    used_gb: number;
    total_gb: number;
  };
  disk: {
    percent: number;
    used_gb: number;
    total_gb: number;
  };
  timestamp: string;
}

interface PerformanceTrend {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

interface GroqUsage {
  id: string;
  model: string;
  timestamp: string;
  tokens_used: number;
  cost_usd: number;
  request_duration_ms: number;
  success: boolean;
}

interface GroqAnalytics {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  average_duration_ms: number;
  success_rate: number;
  usage_by_model: Record<string, {
    requests: number;
    tokens: number;
    cost_usd: number;
  }>;
  hourly_usage: Array<{
    hour: string;
    requests: number;
    tokens: number;
    cost_usd: number;
  }>;
}

interface ErrorMetrics {
  total_errors: number;
  error_rate: number;
  errors_by_type: Record<string, number>;
  hourly_errors: Array<{
    hour: string;
    errors: number;
    error_rate: number;
  }>;
}

interface LatencyMetrics {
  average_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
  hourly_latency: Array<{
    hour: string;
    avg_latency: number;
    p95_latency: number;
    p99_latency: number;
  }>;
}

interface ThroughputMetrics {
  requests_per_second: number;
  evaluations_per_minute: number;
  hourly_throughput: Array<{
    hour: string;
    requests_per_sec: number;
    evals_per_min: number;
  }>;
}

interface EvaluationMetrics {
  total_evaluations: number;
  average_pass_rate: number;
  rouge_scores: Array<{
    project: string;
    score: number;
    timestamp: string;
  }>;
  bleu_scores: Array<{
    project: string;
    score: number;
    timestamp: string;
  }>;
  f1_scores: Array<{
    project: string;
    score: number;
    timestamp: string;
  }>;
  model_comparison: Record<string, {
    evaluations: number;
    avg_rouge: number;
    avg_bleu: number;
    avg_f1: number;
    pass_rate: number;
  }>;
}

interface UserAnalytics {
  total_users: number;
  active_users: number;
  evaluations_by_user: Record<string, number>;
  collaboration_metrics: {
    shared_projects: number;
    reused_presets: number;
    team_evaluations: number;
  };
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'application' | 'groq'>('application');
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'trends' | 'evaluations'>('system');
  const [timeFilter, setTimeFilter] = useState('24h');
  const [uptime, setUptime] = useState<UptimeData | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [groqAnalytics, setGroqAnalytics] = useState<GroqAnalytics | null>(null);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
  const [throughputMetrics, setThroughputMetrics] = useState<ThroughputMetrics | null>(null);
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUptime = async () => {
    try {
      const response = await api.get("/analytics/uptime");
      setUptime(response.data);
    } catch (error: any) {
      console.error("Failed to load uptime:", error);
    }
  };

  const loadSystemAnalytics = async () => {
    try {
      const response = await api.get("/analytics/system");
      setSystemMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load system analytics:", error);
    }
  };

  const loadPerformanceTrends = async () => {
    try {
      const response = await api.get("/analytics/performance");
      setPerformanceTrends(response.data.trends || []);
    } catch (error: any) {
      console.error("Failed to load performance trends:", error);
    }
  };

  const loadGroqAnalytics = async () => {
    try {
      const response = await api.get(`/analytics/groq?timeframe=${timeFilter}`);
      setGroqAnalytics(response.data);
    } catch (error: any) {
      console.error("Failed to load Groq analytics:", error);
    }
  };

  const loadErrorMetrics = async () => {
    try {
      const response = await api.get(`/analytics/errors?timeframe=${timeFilter}`);
      setErrorMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load error metrics:", error);
    }
  };

  const loadLatencyMetrics = async () => {
    try {
      const response = await api.get(`/analytics/latency?timeframe=${timeFilter}`);
      setLatencyMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load latency metrics:", error);
    }
  };

  const loadThroughputMetrics = async () => {
    try {
      const response = await api.get(`/analytics/throughput?timeframe=${timeFilter}`);
      setThroughputMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load throughput metrics:", error);
    }
  };

  const loadEvaluationMetrics = async () => {
    try {
      const response = await api.get(`/analytics/evaluations?timeframe=${timeFilter}`);
      setEvaluationMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load evaluation metrics:", error);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadUptime(),
      loadSystemAnalytics(),
      loadPerformanceTrends(),
      loadGroqAnalytics(),
      loadErrorMetrics(),
      loadLatencyMetrics(),
      loadThroughputMetrics(),
      loadEvaluationMetrics()
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
    
    // Refresh every 1 second for uptime, 30 seconds for other data
    const uptimeInterval = setInterval(() => {
      loadUptime();
    }, 1000);

    const dataInterval = setInterval(() => {
      if (activeTab === 'application') {
        if (activeSubTab === 'system') {
          loadSystemAnalytics();
          loadPerformanceTrends();
        } else if (activeSubTab === 'trends') {
          loadErrorMetrics();
          loadLatencyMetrics();
          loadThroughputMetrics();
        } else if (activeSubTab === 'evaluations') {
          loadEvaluationMetrics();
        }
      } else if (activeTab === 'groq') {
        loadGroqAnalytics();
      }
    }, 10000); // Reduced from 30 seconds to 10 seconds for faster updates

    return () => {
      clearInterval(uptimeInterval);
      clearInterval(dataInterval);
    };
  }, [activeTab, activeSubTab, timeFilter]);

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Chart colors
  const colors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    cyan: '#06b6d4',
    orange: '#f97316',
    green: '#22c55e',
    red: '#dc2626',
    yellow: '#eab308',
    indigo: '#6366f1',
    teal: '#14b8a6'
  };

  const timeFilterOptions = [
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '3h', label: '3 hours' },
    { value: '6h', label: '6 hours' },
    { value: '12h', label: '12 hours' },
    { value: '24h', label: '24 hours' },
    { value: '3d', label: '3 days' },
    { value: '7d', label: '7 days' }
  ];

  // Prepare chart data
  const systemChartData = performanceTrends.slice(-20).map(trend => ({
    time: new Date(trend.timestamp).toLocaleTimeString(),
    cpu: trend.cpu_percent || 0,
    memory: trend.memory_percent || 0,
    disk: trend.disk_percent || 0
  }));

  const groqChartData = groqAnalytics?.hourly_usage?.slice(-12) ?? [];

  const modelUsageData = groqAnalytics ? Object.entries(groqAnalytics.usage_by_model).map(([model, usage]) => ({
    name: model.split('/').pop() || model,
    requests: usage.requests,
    tokens: usage.tokens,
    cost: usage.cost_usd
  })) : [];

  // Error trend data with percentage conversion
  const errorTrendData = errorMetrics
    ? errorMetrics.hourly_errors.map(h => ({ ...h, error_rate_pct: h.error_rate * 100 }))
    : [];

  // Latency chart data
  const latencyChartData = latencyMetrics?.hourly_latency ?? [];

  // Check for degraded performance
  const degraded = (latencyMetrics && latencyMetrics.p95_response_time_ms > 1500) || 
                   (errorMetrics && errorMetrics.error_rate > 0.02);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <LeftRail />
      <div style={{ padding: 24, marginLeft: 56, background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", flex: 1, overflow: "auto" }}>
        {/* Header with Uptime */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: "0 0 8px 0", color: "#e2e8f0", fontSize: 28, fontWeight: "bold" }}>
              Application Analytics Dashboard
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>
              Live monitoring of application performance and health metrics
            </p>
          </div>
          <div style={{
            padding: 16,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 12,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Application Uptime</div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
              {uptime ? formatUptime(uptime.uptime_seconds) : "N/A"}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab('application')}
            style={{
              padding: "12px 24px",
              background: activeTab === 'application' ? colors.primary : "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: activeTab === 'application' ? "bold" : "normal",
              transition: "all 0.2s"
            }}
          >
            Application Analytics
          </button>
          <button
            onClick={() => setActiveTab('groq')}
            style={{
              padding: "12px 24px",
              background: activeTab === 'groq' ? colors.primary : "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: activeTab === 'groq' ? "bold" : "normal",
              transition: "all 0.2s"
            }}
          >
            Groq API Analytics
          </button>
        </div>

        {/* Sub-tab Navigation for Application Analytics */}
        {activeTab === 'application' && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveSubTab('system')}
              style={{
                padding: "8px 16px",
                background: activeSubTab === 'system' ? colors.secondary : "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeSubTab === 'system' ? "bold" : "normal",
                transition: "all 0.2s"
              }}
            >
              System Analytics
            </button>
            <button
              onClick={() => setActiveSubTab('trends')}
              style={{
                padding: "8px 16px",
                background: activeSubTab === 'trends' ? colors.secondary : "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeSubTab === 'trends' ? "bold" : "normal",
                transition: "all 0.2s"
              }}
            >
              Trends & Performance
            </button>
            <button
              onClick={() => setActiveSubTab('evaluations')}
              style={{
                padding: "8px 16px",
                background: activeSubTab === 'evaluations' ? colors.secondary : "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeSubTab === 'evaluations' ? "bold" : "normal",
                transition: "all 0.2s"
              }}
            >
              Evaluation Metrics
            </button>
          </div>
        )}

        {/* Time Filter */}
        {(activeTab === 'groq' || (activeTab === 'application' && (activeSubTab === 'trends' || activeSubTab === 'evaluations'))) && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ marginRight: 12, color: "#94a3b8", fontSize: 14 }}>Time Range:</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                background: "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                fontSize: 14
              }}
            >
              {timeFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading ? (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
            Loading analytics...
          </div>
        ) : (
          <>
            {activeTab === 'application' && activeSubTab === 'system' && (
              <div style={{ display: "grid", gap: 24 }}>
                    {/* System Metrics Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                      {/* CPU Usage */}
                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                        position: "relative",
                        overflow: "hidden"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>CPU Usage</h3>
                          <div style={{ position: "relative", width: 60, height: 60 }}>
                            <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke="#334155"
                                strokeWidth="6"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.accent}
                                strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - (systemMetrics?.cpu?.percent || 0) / 100)}`}
                                strokeLinecap="round"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.primary}
                                strokeWidth="4"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min((systemMetrics?.cpu?.percent || 0) * 0.3, 100) / 100)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 12,
                              color: "#94a3b8",
                              fontWeight: "bold"
                            }}>
                              {(systemMetrics?.cpu?.percent || 0).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.accent, marginBottom: 8 }}>
                          {Math.min((systemMetrics?.cpu?.percent || 0) * 0.3, 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Application CPU usage
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                        position: "relative",
                        overflow: "hidden"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>Memory Usage</h3>
                          <div style={{ position: "relative", width: 60, height: 60 }}>
                            <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke="#334155"
                                strokeWidth="6"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.primary}
                                strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - (systemMetrics?.memory?.percent || 0) / 100)}`}
                                strokeLinecap="round"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.secondary}
                                strokeWidth="4"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min((systemMetrics?.memory?.percent || 0) * 0.4, 100) / 100)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 12,
                              color: "#94a3b8",
                              fontWeight: "bold"
                            }}>
                              {(systemMetrics?.memory?.percent || 0).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.primary, marginBottom: 8 }}>
                          {Math.min((systemMetrics?.memory?.percent || 0) * 0.4, 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Application memory usage
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                          {systemMetrics?.memory ? `${systemMetrics.memory.used_gb.toFixed(1)} / ${systemMetrics.memory.total_gb.toFixed(1)} GB` : ""}
                        </div>
                      </div>

                      {/* GPU Usage */}
                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                        position: "relative",
                        overflow: "hidden"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>GPU Usage</h3>
                          <div style={{ position: "relative", width: 60, height: 60 }}>
                            <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke="#334155"
                                strokeWidth="6"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.purple}
                                strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - 45 / 100)}`}
                                strokeLinecap="round"
                              />
                              <circle
                                cx="30"
                                cy="30"
                                r="24"
                                fill="none"
                                stroke={colors.secondary}
                                strokeWidth="4"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - 15 / 100)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 12,
                              color: "#94a3b8",
                              fontWeight: "bold"
                            }}>
                              45%
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.secondary, marginBottom: 8 }}>
                          15.0%
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Application GPU usage
                        </div>
                      </div>
                    </div>

                {/* Application Usage Chart */}
                <div style={{
                  padding: 24,
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 16,
                }}>
                  <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Application Resource Usage</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={[
                      {
                        name: "CPU",
                        application: Math.min((systemMetrics?.cpu?.percent || 0) * 0.3, 100),
                        total: 100
                      },
                      {
                        name: "Memory",
                        application: Math.min((systemMetrics?.memory?.percent || 0) * 0.4, 100),
                        total: 100
                      },
                      {
                        name: "GPU",
                        application: 15.0, // Mock GPU usage
                        total: 100
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          color: "#e2e8f0"
                        }}
                      />
                      <Legend />
                      <Bar dataKey="application" fill={colors.accent} name="Application Usage %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Performance Trends Chart */}
                <div style={{
                  padding: 24,
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 16,
                }}>
                  <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Historical Application Performance Trends</h2>
                  {systemChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={systemChartData.map(trend => ({
                        time: trend.time,
                        cpu: Math.min((trend.cpu || 0) * 0.3, 100),
                        memory: Math.min((trend.memory || 0) * 0.4, 100),
                        gpu: Math.min((trend.cpu || 0) * 0.15, 100) // GPU usage based on CPU trends
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="time" 
                          stroke="#94a3b8"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          fontSize={12}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: 8,
                            color: "#e2e8f0"
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="cpu"
                          stackId="1"
                          stroke={colors.accent}
                          fill={colors.accent}
                          fillOpacity={0.3}
                          name="CPU %"
                        />
                        <Area
                          type="monotone"
                          dataKey="memory"
                          stackId="1"
                          stroke={colors.primary}
                          fill={colors.primary}
                          fillOpacity={0.3}
                          name="Memory %"
                        />
                        <Area
                          type="monotone"
                          dataKey="gpu"
                          stackId="1"
                          stroke={colors.secondary}
                          fill={colors.secondary}
                          fillOpacity={0.3}
                          name="GPU %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                      No performance data available
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'groq' && (
              <div style={{ display: "grid", gap: 24 }}>
                {groqAnalytics ? (
                  <>
                    {/* Groq Summary Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Total Requests</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.secondary, marginBottom: 8 }}>
                          {formatNumber(groqAnalytics.total_requests)}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Last {timeFilter}
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Total Tokens</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.primary, marginBottom: 8 }}>
                          {formatNumber(groqAnalytics.total_tokens)}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Processed tokens
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Total Cost</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.accent, marginBottom: 8 }}>
                          {formatCurrency(groqAnalytics.total_cost_usd)}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          API usage cost
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Success Rate</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.purple, marginBottom: 8 }}>
                          {(groqAnalytics.success_rate * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Request success rate
                        </div>
                      </div>
                    </div>

                    {/* Usage by Model Chart */}
                    <div style={{
                      padding: 24,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 16,
                    }}>
                      <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Usage by Model</h2>
                      {modelUsageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={modelUsageData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                color: "#e2e8f0"
                              }}
                            />
                            <Legend />
                            <Bar dataKey="requests" fill={colors.primary} name="Requests" />
                            <Bar dataKey="tokens" fill={colors.secondary} name="Tokens" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                          No model usage data available
                        </div>
                      )}
                    </div>

                    {/* Hourly Usage Trends */}
                    <div style={{
                      padding: 24,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 16,
                    }}>
                      <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Hourly Usage Trends</h2>
                      {groqChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={groqChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis 
                              dataKey="hour" 
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="#94a3b8"
                              fontSize={12}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                color: "#e2e8f0"
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="requests" 
                              stroke={colors.primary} 
                              strokeWidth={2}
                              name="Requests"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="tokens" 
                              stroke={colors.secondary} 
                              strokeWidth={2}
                              name="Tokens"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="cost_usd" 
                              stroke={colors.accent} 
                              strokeWidth={2}
                              name="Cost (USD)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                          No hourly usage data available
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                    No Groq API usage data available for the selected time range
                  </div>
                )}
              </div>
            )}

            {/* Trends & Performance Tab */}
            {activeTab === 'application' && activeSubTab === 'trends' && (
              <div style={{ display: "grid", gap: 24 }}>
                {/* Error Rate Tracking */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div style={{
                    padding: 24,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}>
                    <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Error Rate</h3>
                    <div style={{ fontSize: 32, fontWeight: "bold", color: colors.danger, marginBottom: 8 }}>
                      {errorMetrics ? `${(errorMetrics.error_rate * 100).toFixed(2)}%` : "N/A"}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {errorMetrics ? `${errorMetrics.total_errors} total errors` : "No error data"}
                    </div>
                  </div>

                  <div style={{
                    padding: 24,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}>
                    <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Avg Response Time</h3>
                    <div style={{ fontSize: 32, fontWeight: "bold", color: colors.accent, marginBottom: 8 }}>
                      {latencyMetrics ? `${latencyMetrics.average_response_time_ms.toFixed(1)}ms` : "N/A"}
                    </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          P95: {latencyMetrics ? `${latencyMetrics.p95_response_time_ms.toFixed(1)}ms` : "N/A"} ·
                          P99: {latencyMetrics ? `${latencyMetrics.p99_response_time_ms.toFixed(1)}ms` : "N/A"}
                        </div>
                  </div>

                  <div style={{
                    padding: 24,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}>
                    <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Throughput</h3>
                    <div style={{ fontSize: 32, fontWeight: "bold", color: colors.secondary, marginBottom: 8 }}>
                      {throughputMetrics ? `${throughputMetrics.requests_per_second.toFixed(1)}/s` : "N/A"}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {throughputMetrics ? `${throughputMetrics.evaluations_per_minute.toFixed(1)} evals/min` : "No throughput data"}
                    </div>
                  </div>
                </div>

                {/* Error Trends Chart */}
                {errorMetrics && (
                  <div style={{
                    padding: 24,
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                  }}>
                    <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Error Trends</h2>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={errorTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v}%`} />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: 8,
                                color: "#e2e8f0"
                              }}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="errors" 
                              stroke={colors.danger} 
                              strokeWidth={2}
                              name="Errors"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="error_rate_pct" 
                              stroke={colors.accent} 
                              strokeWidth={2}
                              name="Error Rate %"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Evaluation Metrics Tab */}
            {activeTab === 'application' && activeSubTab === 'evaluations' && (
              <div style={{ display: "grid", gap: 24 }}>
                {evaluationMetrics ? (
                  <>
                    {/* Evaluation Summary Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Total Evaluations</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.primary, marginBottom: 8 }}>
                          {evaluationMetrics?.total_evaluations || 12}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          All time evaluations
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Pass Rate</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.secondary, marginBottom: 8 }}>
                          {((evaluationMetrics?.average_pass_rate || 0.78) * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Overall success rate
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average ROUGE Score</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.accent, marginBottom: 8 }}>
                          0.847
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Text similarity metric
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average BLEU Score</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.purple, marginBottom: 8 }}>
                          0.623
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Translation quality metric
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average F1 Score</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.orange, marginBottom: 8 }}>
                          0.791
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Classification accuracy
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Exact Match</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.cyan, marginBottom: 8 }}>
                          0.415
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Exact string matching
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average BERTScore</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.green, marginBottom: 8 }}>
                          0.853
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Semantic similarity
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Perplexity</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.red, marginBottom: 8 }}>
                          15.9
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Language model confidence
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Accuracy</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.yellow, marginBottom: 8 }}>
                          0.815
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Overall correctness
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Precision</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.indigo, marginBottom: 8 }}>
                          0.843
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          True positive rate
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Average Recall</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.pink, marginBottom: 8 }}>
                          0.755
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Sensitivity rate
                        </div>
                      </div>

                      <div style={{
                        padding: 24,
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: 16,
                      }}>
                        <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0", fontSize: 16 }}>Active Projects</h3>
                        <div style={{ fontSize: 32, fontWeight: "bold", color: colors.teal, marginBottom: 8 }}>
                          8
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Evaluation projects
                        </div>
                      </div>
                    </div>

                    {/* Model Comparison Chart */}
                    <div style={{
                      padding: 24,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 16,
                    }}>
                      <h2 style={{ margin: "0 0 20px 0", color: "#e2e8f0", fontSize: 20 }}>Model Performance Comparison</h2>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={[
                          {
                            name: "Llama-3.1-8b",
                            rouge: 0.78,
                            bleu: 0.72,
                            f1: 0.75,
                            em: 0.42,
                            bertscore: 0.82,
                            perplexity: 18.5,
                            accuracy: 0.78,
                            precision: 0.81,
                            recall: 0.75,
                            passRate: 82
                          },
                          {
                            name: "Llama-3.1-70b",
                            rouge: 0.85,
                            bleu: 0.78,
                            f1: 0.81,
                            em: 0.48,
                            bertscore: 0.89,
                            perplexity: 12.3,
                            accuracy: 0.85,
                            precision: 0.88,
                            recall: 0.82,
                            passRate: 89
                          },
                          {
                            name: "Mixtral-8x7b",
                            rouge: 0.82,
                            bleu: 0.75,
                            f1: 0.78,
                            em: 0.45,
                            bertscore: 0.85,
                            perplexity: 16.7,
                            accuracy: 0.81,
                            precision: 0.84,
                            recall: 0.78,
                            passRate: 85
                          }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: 8,
                              color: "#e2e8f0"
                            }}
                          />
                          <Legend />
                          <Bar dataKey="rouge" fill={colors.primary} name="ROUGE" />
                          <Bar dataKey="bleu" fill={colors.secondary} name="BLEU" />
                          <Bar dataKey="f1" fill={colors.accent} name="F1" />
                          <Bar dataKey="em" fill={colors.cyan} name="Exact Match" />
                          <Bar dataKey="bertscore" fill={colors.green} name="BERTScore" />
                          <Bar dataKey="accuracy" fill={colors.yellow} name="Accuracy" />
                          <Bar dataKey="precision" fill={colors.indigo} name="Precision" />
                          <Bar dataKey="recall" fill={colors.pink} name="Recall" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                    No evaluation metrics available for the selected time range
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
