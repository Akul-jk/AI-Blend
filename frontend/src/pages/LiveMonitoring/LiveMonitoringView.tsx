import React, { useState, useEffect, useMemo } from 'react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { fetchAppliances } from '../../services/api';
import { Activity, Radio } from 'lucide-react';
import type { ApplianceWithDetails } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const LiveMonitoringView: React.FC = () => {
  const { latestReadings, history, socketConnected } = useTelemetryStore();
  const [appliances, setAppliances] = useState<ApplianceWithDetails[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  useEffect(() => {
    fetchAppliances().then(res => {
      setAppliances(res.data);
      if (res.data.length > 0) setSelectedAppId(String(res.data[0].id));
    }).catch(console.error);
  }, []);

  const selectedTelemetry = latestReadings[selectedAppId];
  const selectedHistory = history[selectedAppId] || [];

  const chartData = useMemo(() => {
    return selectedHistory.map(r => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour12: false }),
      power: r.power,
      current: r.current
    }));
  }, [selectedHistory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Radio className={`w-5 h-5 ${socketConnected ? 'text-emerald-400' : 'text-slate-600'}`} />
            Live Telemetry Diagnostic
          </h2>
          <p className="text-sm text-slate-400">Real-time socket stream from the database engine</p>
        </div>

        {appliances.length > 0 ? (
          <select
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
          >
            {appliances.map(app => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        ) : (
          <div className="text-amber-400 text-sm">No appliances configured.</div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Voltage</span>
          <span className="text-xl font-mono text-slate-200">{selectedTelemetry?.voltage?.toFixed(1) || '0.0'} V</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Current</span>
          <span className="text-xl font-mono text-cyan-400">{selectedTelemetry?.current?.toFixed(2) || '0.00'} A</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Power</span>
          <span className="text-xl font-mono text-emerald-400">{Math.round(selectedTelemetry?.power || 0)} W</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Energy</span>
          <span className="text-xl font-mono text-amber-400">{selectedTelemetry?.energy?.toFixed(4) || '0.0000'} kWh</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Frequency</span>
          <span className="text-xl font-mono text-slate-200">{selectedTelemetry?.frequency?.toFixed(1) || '0.0'} Hz</span>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center text-center">
          <span className="text-xs text-slate-500 uppercase mb-1">Power Factor</span>
          <span className="text-xl font-mono text-slate-200">{selectedTelemetry?.power_factor?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
        <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          Real-time Power Curve
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="power" stroke="#10b981" fontSize={11} />
              <YAxis yAxisId="current" orientation="right" stroke="#06b6d4" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area yAxisId="power" type="monotone" dataKey="power" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Power (W)" />
              <Area yAxisId="current" type="monotone" dataKey="current" stroke="#06b6d4" fill="none" name="Current (A)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
