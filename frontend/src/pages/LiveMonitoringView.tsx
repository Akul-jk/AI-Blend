import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAppliances } from '../services/api';
import { useTelemetryStore } from '../stores/telemetryStore';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassSelect from '../components/glass/GlassSelect';
import ChartContainer from '../components/glass/ChartContainer';
import StatusBadge from '../components/glass/StatusBadge';
import LoadingState from '../components/glass/LoadingState';
import { Activity, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReplayControls from '../components/ReplayControls';
import { useReplayStore } from '../stores/replayStore';

const LiveMonitoringView: React.FC = () => {
  const { history: liveHistory, socketConnected } = useTelemetryStore();
  const replayHistory = useReplayStore(state => state.history);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['appliances'],
    queryFn: () => fetchAppliances().then(res => res.data),
  });

  const appliances = response || [];
  const [selectedId, setSelectedId] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'live' | 'replay'>('live');

  // Use first appliance if none selected
  const activeApplianceId = selectedId || (appliances.length > 0 ? appliances[0].id : null);
  // IDs returned by SQLite can be numbers, while select controls emit strings.
  // Compare their normalized values so choosing an appliance keeps its name in
  // chart subtitles instead of rendering "undefined".
  const activeAppliance = appliances.find(a => String(a.id) === String(activeApplianceId));
  const selectedHistory = displayMode === 'replay' ? replayHistory : liveHistory;
  const activeHistory = activeApplianceId ? (selectedHistory[String(activeApplianceId)] || []) : [];
  const source = activeHistory[activeHistory.length - 1]?.source;
  const lastReading = activeHistory[activeHistory.length - 1];
  const chartDescription = displayMode === 'replay' ? 'replayed dataset timestamps' : 'latest telemetry';
  const readingTime = lastReading?.source === 'replay' ? lastReading.received_at : lastReading?.timestamp;
  const isStale = !!lastReading && Date.now() - new Date(readingTime || '').getTime() > 15000;

  const chartData = activeHistory.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    voltage: r.voltage,
    current: r.current,
    power: r.power,
    energy: r.energy,
    frequency: r.frequency,
    power_factor: r.power_factor
  }));

  if (isLoading) return <LoadingState text="Loading telemetry..." />;

  const getChart = (dataKey: string, color: string, unit: string) => (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} />
        <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} width={40} />
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color }}
          formatter={(value) => [`${String(value)} ${unit}`, dataKey.toUpperCase()]}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#color-${dataKey})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Live Monitoring"
        subtitle="Recent measurements from the selected appliance"
        icon={<Activity />}
        action={
          <div className="flex items-center gap-4">
            <StatusBadge status={!socketConnected ? 'offline' : isStale ? 'warning' : 'online'} label={!socketConnected ? 'DISCONNECTED' : isStale ? 'STALE' : 'CONNECTED'} />
            {source ? <StatusBadge status={source === 'simulation' ? 'simulation' : source === 'hardware' ? 'hardware' : 'info'} label={source === 'replay' ? 'SYNTHETIC REPLAY' : source.toUpperCase()} /> : <StatusBadge status="warning" label="NO RECENT SOURCE" />}
          </div>
        }
      />

      <div className="w-full max-w-xs mb-6">
        <GlassSelect
          options={appliances.map(a => ({ value: a.id, label: a.name }))}
          value={activeApplianceId || ''}
          onChange={(e) => setSelectedId(e.target.value)}
          label="Select Appliance"
        />
      </div>

      <ReplayControls />
      <div role="group" aria-label="Telemetry view" className="flex gap-2">
        {(['live', 'replay'] as const).map(mode => <button key={mode} type="button" aria-pressed={displayMode === mode} onClick={() => setDisplayMode(mode)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${displayMode === mode ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'border border-[var(--line)] text-[var(--text-muted)]'}`}>{mode === 'live' ? 'Live simulator / hardware' : 'Dataset replay'}</button>)}
      </div>

      {isError && <div role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-400/[.07] p-4 text-sm text-rose-300">Appliance data could not be loaded.</div>}
      {activeApplianceId ? (
        chartData.length === 0 ? <GlassPanel title="Waiting for readings" icon={<Radio size={18} />}><p className="py-10 text-center text-sm text-[var(--text-muted)]">No telemetry is recorded for {activeAppliance?.name || 'this appliance'} yet. Charts will appear when readings arrive.</p></GlassPanel> :
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer title="Voltage" subtitle={`${activeAppliance?.name} · ${chartDescription}`}>
            {getChart('voltage', '#3b82f6', 'V')}
          </ChartContainer>
          <ChartContainer title="Current" subtitle={`${activeAppliance?.name} · ${chartDescription}`}>
            {getChart('current', '#ec4899', 'A')}
          </ChartContainer>
          <ChartContainer title="Power" subtitle={`${activeAppliance?.name} · ${chartDescription}`}>
            {getChart('power', '#06b6d4', 'W')}
          </ChartContainer>
          <ChartContainer title="Energy" subtitle={`${activeAppliance?.name} · cumulative register`}>
            {getChart('energy', '#8b5cf6', 'kWh')}
          </ChartContainer>
          <ChartContainer title="Frequency" subtitle={`${activeAppliance?.name} · ${chartDescription}`}>
            {getChart('frequency', '#f59e0b', 'Hz')}
          </ChartContainer>
          <ChartContainer title="Power Factor" subtitle={`${activeAppliance?.name} · ${chartDescription}`}>
            {getChart('power_factor', '#10b981', '')}
          </ChartContainer>
        </div>
      ) : (
        <GlassPanel title="No appliances available" icon={<Radio size={18} />}><p className="py-10 text-center text-sm text-[var(--text-muted)]">Add an appliance and configure a telemetry source to begin monitoring.</p></GlassPanel>
      )}
    </div>
  );
};

export default LiveMonitoringView;
