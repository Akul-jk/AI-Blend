import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAppliances } from '../services/api';
import { useTelemetryStore } from '../stores/telemetryStore';
import SectionHeader from '../components/glass/SectionHeader';
import GlassSelect from '../components/glass/GlassSelect';
import ChartContainer from '../components/glass/ChartContainer';
import StatusBadge from '../components/glass/StatusBadge';
import LoadingState from '../components/glass/LoadingState';
import { Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LiveMonitoringView: React.FC = () => {
  const { history, socketConnected } = useTelemetryStore();

  const { data: response, isLoading } = useQuery({
    queryKey: ['appliances'],
    queryFn: () => fetchAppliances().then(res => res.data),
  });

  const appliances = response || [];
  const [selectedId, setSelectedId] = useState<string>('');

  // Use first appliance if none selected
  const activeApplianceId = selectedId || (appliances.length > 0 ? appliances[0].id : null);
  const activeAppliance = appliances.find(a => a.id === activeApplianceId);
  const activeHistory = activeApplianceId ? (history[String(activeApplianceId)] || []) : [];
  const source = activeHistory[activeHistory.length - 1]?.source;

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
          formatter={(value: any) => [`${value} ${unit}`, dataKey.toUpperCase()]}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#color-${dataKey})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Live Monitoring"
        subtitle="Real-time telemetry from connected devices"
        icon={<Activity />}
        action={
          <div className="flex items-center gap-4">
            <StatusBadge status={socketConnected ? 'online' : 'offline'} label={socketConnected ? 'LIVE' : 'DISCONNECTED'} />
            {source ? <StatusBadge status={source === 'simulation' ? 'simulation' : 'hardware'} label={source.toUpperCase()} /> : <StatusBadge status="warning" label="NO RECENT SOURCE" />}
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

      {activeApplianceId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer title="Voltage" subtitle={`${activeAppliance?.name} - Real-time`}>
            {getChart('voltage', '#3b82f6', 'V')}
          </ChartContainer>
          <ChartContainer title="Current" subtitle={`${activeAppliance?.name} - Real-time`}>
            {getChart('current', '#ec4899', 'A')}
          </ChartContainer>
          <ChartContainer title="Power" subtitle={`${activeAppliance?.name} - Real-time`}>
            {getChart('power', '#06b6d4', 'W')}
          </ChartContainer>
          <ChartContainer title="Energy" subtitle={`${activeAppliance?.name} - Cumulative`}>
            {getChart('energy', '#8b5cf6', 'kWh')}
          </ChartContainer>
          <ChartContainer title="Frequency" subtitle={`${activeAppliance?.name} - Real-time`}>
            {getChart('frequency', '#f59e0b', 'Hz')}
          </ChartContainer>
          <ChartContainer title="Power Factor" subtitle={`${activeAppliance?.name} - Real-time`}>
            {getChart('power_factor', '#10b981', '')}
          </ChartContainer>
        </div>
      ) : (
        <div className="text-center text-slate-400 py-12">No appliances available to monitor.</div>
      )}
    </div>
  );
};

export default LiveMonitoringView;
