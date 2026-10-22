import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAppliance } from '../../services/api';
import { useTelemetryStore } from '../../stores/telemetryStore';
import GlassPanel from '../../components/glass/GlassPanel';
import MetricCard from '../../components/glass/MetricCard';
import StatusBadge from '../../components/glass/StatusBadge';
import ChartContainer from '../../components/glass/ChartContainer';
import LoadingState from '../../components/glass/LoadingState';
import { Activity, Zap, Info, Clock, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ApplianceDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: response, isLoading } = useQuery({
    queryKey: ['appliance', id],
    queryFn: () => fetchAppliance(id as string).then(res => res.data),
    enabled: !!id
  });

  const appliance = response;
  const { latestReadings, history } = useTelemetryStore();
  const liveTelemetry = id ? latestReadings[id] : null;
  const telemetrySource = liveTelemetry?.source || appliance?.latest_telemetry?.source;
  const chartData = id ? (history[id] || []).map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    power: r.power,
    voltage: r.voltage,
    current: r.current
  })) : [];

  if (isLoading) return <LoadingState text="Loading appliance details..." />;
  if (!appliance) return <div className="text-white">Appliance not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white">{appliance.name}</h1>
            <StatusBadge status={appliance.status === 'online' ? 'online' : 'offline'} />
          </div>
          <p className="text-slate-400 text-sm">
            {appliance.manufacturer} {appliance.model} • Location: {appliance.location}
          </p>
          {telemetrySource && <p className="mt-2 text-xs text-amber-200">{telemetrySource === 'simulation' ? 'Synthetic simulator readings' : 'Connected hardware readings'} · source shown with every measurement</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Live Power" value={liveTelemetry?.power || 0} unit="W" icon={<Zap />} trend="stable" />
        <MetricCard label="Today's Energy" value={appliance.energy_today || 0} unit="kWh" icon={<Activity />} />
        <MetricCard label="Voltage" value={liveTelemetry?.voltage || 0} unit="V" icon={<Info />} />
        <MetricCard label="Current" value={liveTelemetry?.current || 0} unit="A" icon={<Clock />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel title="MANUFACTURER RATING" icon={<Info />}>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Rated Power</span>
              <span className="text-xl font-semibold text-white">{appliance.rating?.rated_power || 'N/A'} W</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Rated Voltage</span>
              <span className="text-xl font-semibold text-white">{appliance.rating?.rated_voltage || 'N/A'} V</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Rated Current</span>
              <span className="text-xl font-semibold text-white">{appliance.rating?.rated_current || 'N/A'} A</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Frequency</span>
              <span className="text-xl font-semibold text-white">{appliance.rating?.rated_frequency || 'N/A'} Hz</span>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel title="LIVE MEASUREMENT" icon={<Activity />}>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/20">
              <span className="text-xs text-cyan-400/80 block mb-1">Actual Power</span>
              <span className="text-xl font-semibold text-cyan-400">{liveTelemetry?.power || 0} W</span>
            </div>
            <div className="bg-violet-500/10 p-4 rounded-lg border border-violet-500/20">
              <span className="text-xs text-violet-400/80 block mb-1">Power Factor</span>
              <span className="text-xl font-semibold text-violet-400">{liveTelemetry?.power_factor || 0}</span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Utilization</span>
              <span className="text-xl font-semibold text-emerald-400">
                {appliance.rating?.rated_power ? Math.round(((liveTelemetry?.power || 0) / appliance.rating.rated_power) * 100) : 0}%
              </span>
            </div>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">Frequency</span>
              <span className="text-xl font-semibold text-white">{liveTelemetry?.frequency || 0} Hz</span>
            </div>
          </div>
        </GlassPanel>
      </div>

      <ChartContainer title="Historical Power Consumption (Live)">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAppliancePower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} />
            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickMargin={10} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#8b5cf6' }}
            />
            <Area type="monotone" dataKey="power" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorAppliancePower)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>

      <GlassPanel title="AI Forecast & Anomalies" icon={<AlertTriangle className="text-amber-400" />}>
        <div className="text-sm text-slate-400">No anomalies detected in the last 24 hours. Usage patterns are normal.</div>
      </GlassPanel>
    </div>
  );
};

export default ApplianceDetailView;
