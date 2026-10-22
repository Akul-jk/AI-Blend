import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowRight, Bell, Bolt, BrainCircuit,
  Check, ChevronRight, CircleHelp, Clock3, Cpu, Gauge, Leaf, Radio, Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchAlerts, fetchAnalyticsBreakdown, fetchAnalyticsSummary, fetchModelInfo } from '../services/api';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAlertStore } from '../stores/alertStore';
import { useAuth } from '../context/AuthContext';
import GlassPanel from '../components/glass/GlassPanel';
import EmptyState from '../components/glass/EmptyState';
import LoadingState from '../components/glass/LoadingState';
import type { Alert, ApplianceBreakdown, DashboardSummary, TelemetryReading } from '../types';

const series = ['#008eaa', '#078b63', '#7252bf', '#d28b27', '#c23e55', '#1f77a3'];
const chartTip = { background: 'var(--tooltip)', border: '1px solid var(--line)', borderRadius: '10px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-soft)' };
const fmt = (value: number | undefined, digits = 0) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

function Stat({ label, value, unit, icon, detail }: { label: string; value: string; unit?: string; icon: React.ReactNode; detail: string }) {
  return <article className="glass-standard kpi-card rounded-[16px] p-4 sm:p-5">
    <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">{label}</span><span className="rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">{icon}</span></div>
    <div className="mt-4 flex items-baseline gap-1.5"><strong className="font-mono text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[28px]">{value}</strong>{unit && <span className="text-xs font-medium text-[var(--text-muted)]">{unit}</span>}</div>
    <p className="mt-2 text-xs text-[var(--text-muted)]">{detail}</p>
  </article>;
}

function LatestReading({ reading }: { reading: TelemetryReading }) {
  const age = Date.now() - new Date(reading.timestamp).getTime();
  const stale = !Number.isFinite(age) || age > 15000;
  return <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-[var(--line)] py-3 first:border-0">
    <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--text-primary)]">{reading.appliance_id ? `Appliance ${reading.appliance_id}` : reading.pzem_id || 'Telemetry source'}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{new Date(reading.timestamp).toLocaleString()}</p></div>
    <strong className="font-mono text-sm text-[var(--text-primary)]">{fmt(reading.power, 1)} <small className="text-[10px] font-normal text-[var(--text-muted)]">W</small></strong>
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${stale ? 'text-[var(--warning)]' : 'text-[var(--green)]'}`}><span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-[var(--warning)]' : 'bg-[var(--green)]'}`} />{stale ? 'Stale' : reading.source}</span>
  </div>;
}

const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const { latestReadings, history, socketConnected } = useTelemetryStore();
  const storeAlerts = useAlertStore(state => state.alerts);
  const summaryQuery = useQuery({ queryKey: ['dashboard-summary'], queryFn: async () => (await fetchAnalyticsSummary()).data, refetchInterval: 10000, retry: 1 });
  const breakdownQuery = useQuery({ queryKey: ['appliance-breakdown'], queryFn: async () => (await fetchAnalyticsBreakdown()).data, refetchInterval: 15000, retry: 1 });
  const alertsQuery = useQuery({ queryKey: ['recent-alerts'], queryFn: async () => (await fetchAlerts()).data, refetchInterval: 15000, retry: 1 });
  const modelQuery = useQuery({ queryKey: ['model-info'], queryFn: async () => (await fetchModelInfo()).data, retry: false });

  const summary = summaryQuery.data as DashboardSummary | undefined;
  const breakdown = (breakdownQuery.data || []) as ApplianceBreakdown[];
  const alerts = ((alertsQuery.data || storeAlerts || []) as Alert[]).slice(0, 4);
  const readings = Object.values(latestReadings).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const telemetryPower = readings.length ? readings.reduce((sum, item) => sum + (Number.isFinite(item.power) ? item.power : 0), 0) : undefined;
  const currentPower = summary?.total_power ?? telemetryPower;
  const newest = readings[0];
  const newestAge = newest ? Date.now() - new Date(newest.timestamp).getTime() : undefined;
  const stale = newestAge != null && (!Number.isFinite(newestAge) || newestAge > 15000);
  const source = summary?.data_source || newest?.source;

  const points = useMemo(() => Object.entries(Object.values(history).flat().reduce<Record<string, number>>((acc, reading) => {
    acc[reading.timestamp] = (acc[reading.timestamp] || 0) + reading.power; return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(-60).map(([timestamp, power]) => ({ time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), power })), [history]);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const summaryUnavailable = summaryQuery.isError && readings.length === 0;

  return <div className="page-enter space-y-6">
    <section className="energy-hero rounded-[24px] px-5 py-6 text-white shadow-[var(--shadow)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-100"><span className="h-1.5 w-1.5 rounded-full bg-[#36D399] shadow-[0_0_10px_#36D399]" />Energy intelligence</div>
          <p className="text-sm font-medium text-cyan-100/80">{greeting}{user?.username ? `, ${user.username}` : ''}</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-[-.035em] text-white sm:text-[40px]">Understand every<br className="hidden sm:block" /> watt in your world.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-200/80">A clear view of current energy use, recent telemetry, and the systems shaping it.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs text-white"><span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-[#36D399]' : 'bg-amber-300'}`} />{socketConnected ? 'Live connection' : 'Connection unavailable'}</span>
            {source && <span className="rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs text-white">{source === 'hardware' ? 'Hardware telemetry' : 'Synthetic simulator data'}</span>}
            {newest && <span className="text-xs text-slate-200/70">Updated {new Date(newest.timestamp).toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="hidden min-h-[190px] items-end justify-end gap-3 lg:flex" aria-hidden="true">
          <div className="mb-2 rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-xl backdrop-blur-md"><span className="text-[10px] uppercase tracking-[.16em] text-cyan-100/65">Current draw</span><div className="mt-1 font-mono text-3xl font-semibold text-white">{fmt(currentPower, 0)}<small className="ml-1 text-sm font-normal text-cyan-100/70">W</small></div><span className="mt-3 block text-[10px] text-cyan-100/60">{stale ? 'Latest measurement is stale' : readings.length ? 'Latest recorded telemetry' : 'Waiting for a reading'}</span></div>
          <div className="mb-12 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[.08] text-[#B8F56A]"><Zap size={31} /></div>
        </div>
      </div>
    </section>

    {summaryUnavailable && <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-400/[.07] px-4 py-3 text-sm text-[var(--warning)]">Dashboard summary is unavailable. Showing only values supported by recent telemetry.</div>}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Current power" value={summaryQuery.isLoading && currentPower == null ? 'Loading' : fmt(currentPower, 1)} unit="W" icon={<Zap size={17} />} detail={stale ? 'Latest reading is stale' : readings.length ? 'From latest available telemetry' : 'No current reading available'} />
      <Stat label="Energy today" value={fmt(summary?.total_energy_today, 3)} unit="kWh" icon={<Activity size={17} />} detail={summary ? 'Today · calculated from recorded telemetry' : 'Daily total unavailable'} />
      <Stat label="Estimated cost" value={summary?.estimated_cost == null ? '—' : `₹${fmt(summary.estimated_cost, 2)}`} icon={<Gauge size={17} />} detail={summary ? 'Calculated using configured tariff' : 'Cost estimate unavailable'} />
      <Stat label="Active appliances" value={summary?.active_appliances == null ? '—' : `${summary.active_appliances}${summary.total_appliances == null ? '' : ` / ${summary.total_appliances}`}`} icon={<Cpu size={17} />} detail={summary ? 'Status from appliance records' : 'Appliance summary unavailable'} />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
      <GlassPanel title="Power over time" icon={<Activity size={18} />} action={<Link className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline" to="/monitoring">Live monitoring <ArrowRight size={14} /></Link>} className="min-w-0 p-4 sm:p-5">
        <p className="-mt-2 mb-3 text-xs text-[var(--text-muted)]">Recent readings · watts</p>
        {points.length ? <div className="h-[280px] min-w-0 sm:h-[330px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
          <defs><linearGradient id="dashboardPowerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={32} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={chartTip} formatter={value => [`${fmt(Number(value), 1)} W`, 'Power']} /><Area type="monotone" dataKey="power" stroke="var(--accent)" strokeWidth={2.5} fill="url(#dashboardPowerFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
        </AreaChart></ResponsiveContainer></div> : <div className="flex h-[280px] items-center justify-center"><EmptyState icon={<Activity />} title="No chart history yet" message="Recent power readings will appear here when telemetry is available." /></div>}
      </GlassPanel>

      <GlassPanel title="Appliance contribution" icon={<Bolt size={18} />} action={<Link to="/appliances" aria-label="View appliances" className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"><ChevronRight size={16} /></Link>} className="min-w-0 p-4 sm:p-5">
        {breakdownQuery.isLoading ? <LoadingState text="Loading appliance summary…" /> : breakdown.length ? <>
          <div className="h-[180px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={breakdown} dataKey="energy" nameKey="appliance_name" innerRadius={53} outerRadius={76} paddingAngle={3} stroke="none">{breakdown.map((item, index) => <Cell key={item.appliance_id} fill={series[index % series.length]} />)}</Pie><Tooltip contentStyle={chartTip} formatter={(value) => [`${fmt(Number(value), 3)} kWh`, 'Energy']} /></PieChart></ResponsiveContainer></div>
          <div className="space-y-2">{breakdown.slice(0, 5).map((item, index) => <div key={item.appliance_id} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: series[index % series.length] }} /><span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{item.appliance_name}</span><span className="font-mono text-[var(--text-primary)]">{fmt(item.energy, 3)} kWh</span></div>)}</div>
        </> : <div className="flex h-[260px] items-center justify-center"><EmptyState icon={<Bolt />} title="No breakdown available" message="Appliance energy data has not been reported for this period." /></div>}
      </GlassPanel>
    </section>

    <section className="grid gap-5 lg:grid-cols-3">
      <GlassPanel title="Latest readings" icon={<Radio size={18} />} action={<Link to="/history" className="text-xs font-semibold text-[var(--accent)] hover:underline">History</Link>} className="lg:col-span-2 p-4 sm:p-5">
        {readings.length ? readings.slice(0, 5).map(item => <LatestReading key={`${item.appliance_id}-${item.timestamp}`} reading={item} />) : <EmptyState icon={<Radio />} title="Waiting for telemetry" message="There are no readings in the live session yet." />}
      </GlassPanel>
      <div className="space-y-5">
        <GlassPanel title="Forecast model" icon={<BrainCircuit size={18} />} action={<Link to="/ai" aria-label="Open AI insights" className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--accent)]"><ChevronRight size={16} /></Link>} className="p-4 sm:p-5">
          {modelQuery.isLoading ? <p className="text-sm text-[var(--text-muted)]">Checking model status…</p> : modelQuery.data ? <><p className="text-base font-semibold text-[var(--text-primary)]">{modelQuery.data.name || 'Energy forecaster'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Version {modelQuery.data.version || 'Not recorded'} · {modelQuery.data.status || 'Status unavailable'}</p>{modelQuery.data.metrics ? <p className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-secondary)]">Stored evaluation metrics are available in Model Management.</p> : <p className="mt-4 rounded-xl bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-muted)]">No stored evaluation metrics are available. A loaded model is not evidence of forecast accuracy.</p>}</> : <p className="text-sm text-[var(--text-muted)]">Model information is unavailable.</p>}
        </GlassPanel>
        <GlassPanel title="Recent alerts" icon={<Bell size={18} />} action={<Link to="/alerts" className="text-xs font-semibold text-[var(--accent)] hover:underline">All alerts</Link>} className="p-4 sm:p-5">
          {alertsQuery.isError && !storeAlerts.length ? <p role="status" className="text-sm text-[var(--text-muted)]">Alert service is unavailable.</p> : alerts.length ? alerts.slice(0, 3).map(alert => <div key={alert.id} className="flex gap-3 border-t border-[var(--line)] py-3 first:border-0"><span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${alert.severity === 'critical' ? 'bg-rose-400/10 text-rose-500' : 'bg-amber-400/10 text-amber-600'}`}><Bell size={13} /></span><div className="min-w-0"><p className="line-clamp-2 text-xs leading-5 text-[var(--text-primary)]">{alert.message}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><Clock3 size={11} />{new Date(alert.timestamp).toLocaleString()}</p></div></div>) : <div className="py-2"><EmptyState icon={<Check />} title="No current alerts" message="No alerts are recorded right now." /></div>}
        </GlassPanel>
      </div>
    </section>
    <p className="flex items-center justify-center gap-2 pb-2 text-center text-[11px] text-[var(--text-muted)]"><Leaf size={13} />Telemetry source: {source === 'hardware' ? 'connected hardware' : source === 'simulation' ? 'synthetic simulator' : 'not established'}{stale && newest && <span className="text-[var(--warning)]"> · latest reading is stale</span>}<CircleHelp size={13} aria-label="Current readings can be delayed if the telemetry connection is unavailable." /></p>
  </div>;
};

export default DashboardView;
