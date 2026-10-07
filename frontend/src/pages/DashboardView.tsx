import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAlertStore } from '../stores/alertStore';
import {
  fetchAnalyticsSummary, fetchAnalyticsBreakdown, fetchAlerts, fetchModelInfo
} from '../services/api';
import GlassCard from '../components/glass/GlassCard';
import GlassPanel from '../components/glass/GlassPanel';
import MetricCard from '../components/glass/MetricCard';
import StatusBadge from '../components/glass/StatusBadge';
import ChartContainer from '../components/glass/ChartContainer';
import LoadingState from '../components/glass/LoadingState';
import EmptyState from '../components/glass/EmptyState';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import {
  Zap, Battery, Activity, AlertTriangle,
  Cpu, Brain, CircleDot, DollarSign, Gauge
} from 'lucide-react';
import type { DashboardSummary, ApplianceBreakdown, Alert } from '../types';

const CHART_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const DashboardView: React.FC = () => {
  const { latestReadings, history } = useTelemetryStore();
  const { alerts: storeAlerts } = useAlertStore();
  const liveChartData = Object.values(history).flat().reduce((buckets, reading) => {
    const key = reading.timestamp;
    buckets[key] = (buckets[key] || 0) + reading.power;
    return buckets;
  }, {} as Record<string, number>);
  const chartPoints = Object.entries(liveChartData).sort(([a], [b]) => a.localeCompare(b)).slice(-60).map(([timestamp, power]) => ({ time: new Date(timestamp).toLocaleTimeString(), power }));

  // Fetch dashboard summary
  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await fetchAnalyticsSummary();
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Fetch appliance breakdown
  const { data: breakdown } = useQuery<ApplianceBreakdown[]>({
    queryKey: ['appliance-breakdown'],
    queryFn: async () => {
      const res = await fetchAnalyticsBreakdown();
      return res.data;
    },
    refetchInterval: 15000,
  });

  // Fetch alerts
  const { data: alertsData } = useQuery<Alert[]>({
    queryKey: ['recent-alerts'],
    queryFn: async () => {
      const res = await fetchAlerts();
      return res.data;
    },
    refetchInterval: 15000,
  });

  // Fetch ML model info
  const { data: modelInfo } = useQuery({
    queryKey: ['model-info'],
    queryFn: async () => {
      try {
        const res = await fetchModelInfo();
        return res.data;
      } catch { return null; }
    },
  });

  const totalPower = summary?.total_power || Object.values(latestReadings).reduce((s, r) => s + (r?.power || 0), 0);
  const recentAlerts = (alertsData || storeAlerts || []).slice(0, 5);

  if (summaryLoading) return <LoadingState variant="card" />;

  return (
    <div className="space-y-6 p-1">
      {/* ---- HERO SECTION ---- */}
      <GlassCard level="elevated" className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient">ENERGY INTELLIGENCE</h1>
            <p className="text-slate-400 text-sm mt-1">Real-time energy monitoring &amp; AI analytics</p>
          </div>
          <StatusBadge status={Object.values(latestReadings).some(reading => reading.source === 'hardware') ? 'hardware' : 'simulation'} label={Object.values(latestReadings).some(reading => reading.source === 'hardware') ? 'HARDWARE TELEMETRY' : 'SIMULATED TELEMETRY'} />
        </div>

        {/* Primary KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Zap className="w-5 h-5" />}
            label="Current Power"
            value={Math.round(totalPower)}
            unit="W"
          />
          <MetricCard
            icon={<Battery className="w-5 h-5" />}
            label="Today's Energy"
            value={Number((summary?.total_energy_today || 0).toFixed(2))}
            unit="kWh"
          />
          <MetricCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Est. Cost"
            value={summary?.estimated_cost == null ? '—' : Number(summary.estimated_cost.toFixed(2))}
            unit={summary?.estimated_cost == null ? undefined : '₹'}
          />
          <MetricCard
            icon={<Gauge className="w-5 h-5" />}
            label="Peak Power"
            value={Math.round(summary?.peak_power || 0)}
            unit="W"
          />
        </div>
      </GlassCard>

      {/* ---- LIVE POWER CHART ---- */}
      <ChartContainer title="Live Power Consumption" subtitle="Total household power draw">
        <div style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} unit=" W" />
              <Tooltip
                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => [`${Number(value ?? 0).toFixed(1)} W`, 'Total Power']}
              />
              <Area type="monotone" dataKey="power" stroke="#06b6d4" strokeWidth={2} fill="url(#powerGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartContainer>

      {/* ---- AI FORECAST + APPLIANCE BREAKDOWN ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Forecast */}
        <GlassPanel title="Model Evaluation" icon={<Brain className="w-5 h-5 text-violet-400" />}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CircleDot className="w-3 h-3 text-violet-400" />
              {modelInfo ? `${modelInfo.name || 'LSTM'} ${modelInfo.version || 'v1'} • Simulation-trained` : 'ML service connecting...'}
            </div>
            {modelInfo?.metrics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-bg p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">MAE</div>
                  <div className="text-lg font-semibold text-cyan-400">{modelInfo.metrics.mae?.toFixed(4) || '—'}</div>
                </div>
                <div className="glass-bg p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">RMSE</div>
                  <div className="text-lg font-semibold text-cyan-400">{modelInfo.metrics.rmse?.toFixed(4) || '—'}</div>
                </div>
                <div className="glass-bg p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">R²</div>
                  <div className="text-lg font-semibold text-emerald-400">{modelInfo.metrics.r2?.toFixed(4) || '—'}</div>
                </div>
                <div className="glass-bg p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">MAPE</div>
                  <div className="text-lg font-semibold text-amber-400">{modelInfo.metrics.mape?.toFixed(2) || '—'}%</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">No trained model available. Train a model from the AI/Admin section.</div>
            )}
            <p className="text-xs text-slate-600 italic">
              Metrics are from synthetic simulation data. Train on hardware data for real-world accuracy.
            </p>
          </div>
        </GlassPanel>

        {/* Appliance Breakdown */}
        <GlassPanel title="Energy Breakdown" icon={<Activity className="w-5 h-5 text-cyan-400" />}>
          {breakdown && breakdown.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      cx="50%" cy="50%"
                      innerRadius={30} outerRadius={55}
                      dataKey="energy"
                      nameKey="appliance_name"
                      stroke="none"
                    >
                      {breakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0' }}
                      formatter={(v) => [`${Number(v ?? 0).toFixed(3)} kWh`, 'Energy']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {breakdown.slice(0, 5).map((item, i) => (
                  <div key={item.appliance_id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-slate-300 flex-1 truncate">{item.appliance_name}</span>
                    <span className="text-xs text-slate-500">{Math.round(item.power || 0)}W</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Activity />} title="No appliance data" message="No appliance data is available yet." />
          )}
        </GlassPanel>
      </div>

      {/* ---- SYSTEM HEALTH + ALERTS ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <GlassPanel title="System Health" icon={<Cpu className="w-5 h-5 text-emerald-400" />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Data Source</span>
              <StatusBadge status="simulation" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Active Appliances</span>
              <span className="text-sm text-emerald-400 font-medium">{summary?.active_appliances || 0} / {summary?.total_appliances || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">WebSocket</span>
              <span className={`text-sm font-medium ${useTelemetryStore.getState().socketConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {useTelemetryStore.getState().socketConnected ? '● Connected' : '● Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Active Alerts</span>
              <span className="text-sm text-amber-400 font-medium">{summary?.active_alerts || 0}</span>
            </div>
          </div>
        </GlassPanel>

        {/* Recent Alerts */}
        <GlassPanel title="Recent Alerts" icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}>
          {recentAlerts.length > 0 ? (
            <div className="space-y-2">
              {recentAlerts.map((alert: Alert) => (
                <div key={alert.id} className="flex items-start gap-3 glass-bg p-3 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {alert.severity?.toUpperCase()} • {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<AlertTriangle />} title="No recent alerts" message="No recent alerts are available." />
          )}
        </GlassPanel>
      </div>

      {/* Data Source Disclaimer */}
      <p className="text-xs text-slate-600 text-center italic px-4">
        ◈ SIMULATION MODE — All data shown is generated by the simulation engine.
        Connect physical PZEM/ESP32 hardware for real measurements.
      </p>
    </div>
  );
};

export default DashboardView;
