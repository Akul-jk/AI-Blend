import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAppliances, fetchTelemetryHistory } from '../services/api';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassSelect from '../components/glass/GlassSelect';
import { Database } from 'lucide-react';

const HistoricalDataView: React.FC = () => {
  const [applianceId, setApplianceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const appliances = useQuery({ queryKey: ['appliances'], queryFn: async () => (await fetchAppliances()).data });
  const history = useQuery({
    queryKey: ['telemetry-history', applianceId, from, to],
    queryFn: async () => (await fetchTelemetryHistory({ appliance_id: applianceId || undefined, from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T23:59:59.999Z` : undefined, limit: 500 })).data,
  });
  const rows = history.data || [];
  return <div className="space-y-6">
    <SectionHeader title="Historical Data" subtitle="Recorded meter readings and derived interval energy" icon={<Database />} />
    <GlassPanel className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <GlassSelect label="Appliance" value={applianceId} onChange={e => setApplianceId(e.target.value)} options={[{ value: '', label: 'All appliances' }, ...(appliances.data || []).map(a => ({ value: a.id, label: a.name }))]} />
      <label className="text-sm text-slate-300">From (UTC)<input className="mt-1 block w-full rounded bg-slate-900 border border-white/10 p-2 text-white" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-sm text-slate-300">To (UTC)<input className="mt-1 block w-full rounded bg-slate-900 border border-white/10 p-2 text-white" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
    </GlassPanel>
    <GlassPanel>
      {history.isLoading ? <p className="p-6 text-slate-400">Loading telemetry…</p> : history.isError ? <p className="p-6 text-rose-300">Could not load telemetry.</p> : rows.length === 0 ? <p className="p-6 text-slate-400">No recorded readings match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300"><thead className="text-xs text-slate-400 uppercase bg-white/5"><tr>{['Timestamp','Appliance','Voltage','Current','Power','PF','Frequency','Meter energy','Interval energy','Quality'].map(x => <th className="px-3 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || `${row.timestamp}-${i}`} className="border-b border-white/5"><td className="px-3 py-3">{new Date(row.timestamp).toLocaleString()}</td><td className="px-3 py-3">{(appliances.data || []).find(a => String(a.id) === String(row.appliance_id))?.name || `Meter ${row.pzem_id || 'unknown'}`}</td><td className="px-3 py-3">{row.voltage.toFixed(1)} V</td><td className="px-3 py-3">{row.current.toFixed(2)} A</td><td className="px-3 py-3">{row.power.toFixed(1)} W</td><td className="px-3 py-3">{row.power_factor.toFixed(2)}</td><td className="px-3 py-3">{row.frequency.toFixed(2)} Hz</td><td className="px-3 py-3">{row.energy.toFixed(4)} kWh</td><td className="px-3 py-3">{row.interval_energy_kwh == null ? '—' : `${row.interval_energy_kwh.toFixed(6)} kWh`}</td><td className="px-3 py-3">{row.quality || 'legacy'}</td></tr>)}</tbody></table></div>}
      <p className="px-4 py-3 text-xs text-slate-500">Showing up to 500 newest records. Meter energy is cumulative; interval energy is usage since the prior valid meter reading.</p>
    </GlassPanel>
  </div>;
};
export default HistoricalDataView;
