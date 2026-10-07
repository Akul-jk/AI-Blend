import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { fetchAppliances } from '../../services/api';
import { useTelemetryStore } from '../../stores/telemetryStore';
import StatusBadge from '../../components/glass/StatusBadge';

const SensorDashboardView: React.FC = () => {
  const appliances = useQuery({ queryKey: ['appliances'], queryFn: async () => (await fetchAppliances()).data });
  const { latestReadings, history, socketConnected } = useTelemetryStore();
  const rows = appliances.data || [];
  return <div className="space-y-6"><header><h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Gauge className="w-5 h-5 text-emerald-400" />Meter Telemetry</h2><p className="text-sm text-slate-500 mt-1">Live measurements from configured appliances and their PZEM meter assignments.</p><div className="mt-3"><StatusBadge status={socketConnected ? 'online' : 'offline'} label={socketConnected ? 'SOCKET CONNECTED' : 'SOCKET DISCONNECTED'} /></div></header>
    {appliances.isLoading ? <p className="text-slate-400">Loading meter assignments…</p> : appliances.isError ? <p className="text-rose-300">Could not load appliance meter assignments.</p> : rows.length === 0 ? <p className="text-slate-400">No appliances are configured.</p> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(appliance => {
      const key = String(appliance.id);
      const reading = latestReadings[key] || appliance.latest_telemetry;
      const samples = history[key] || [];
      const powers = samples.map(item => item.power);
      return <section key={appliance.id} className="glass-panel rounded-xl p-5 border border-white/10"><h3 className="font-semibold text-white">{appliance.name}</h3><p className="text-xs text-slate-500 mt-1">PZEM {appliance.pzem_id || 'unassigned'} · {reading?.source || 'no data'}</p>{reading ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Power</p><p className="text-cyan-300">{reading.power.toFixed(1)} W</p></div><div><p className="text-xs text-slate-500">Voltage</p><p className="text-slate-200">{reading.voltage.toFixed(1)} V</p></div><div><p className="text-xs text-slate-500">Current</p><p className="text-slate-200">{reading.current.toFixed(2)} A</p></div><div><p className="text-xs text-slate-500">Power factor</p><p className="text-slate-200">{reading.power_factor.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Frequency</p><p className="text-slate-200">{reading.frequency.toFixed(2)} Hz</p></div><div><p className="text-xs text-slate-500">Cumulative energy</p><p className="text-slate-200">{reading.energy.toFixed(4)} kWh</p></div><div><p className="text-xs text-slate-500">Recent power range</p><p className="text-slate-200">{powers.length ? `${Math.min(...powers).toFixed(1)}–${Math.max(...powers).toFixed(1)} W` : 'Not available'}</p></div><div><p className="text-xs text-slate-500">Interval energy</p><p className="text-slate-200">{reading.interval_energy_kwh == null ? 'Not available' : `${reading.interval_energy_kwh.toFixed(6)} kWh`}</p></div><div className="col-span-2 text-xs text-slate-500">Last reading: {new Date(reading.timestamp).toLocaleString()}</div></div> : <p className="mt-4 text-sm text-slate-500">No telemetry available.</p>}</section>;
    })}</div>}
  </div>;
};
export default SensorDashboardView;
