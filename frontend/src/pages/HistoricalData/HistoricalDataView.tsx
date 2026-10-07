import React, { useEffect, useState } from 'react';
import { fetchAppliances, fetchApplianceTelemetry } from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { History, SlidersHorizontal } from 'lucide-react';
import type { ApplianceWithDetails, TelemetryReading } from '../../types';

export const HistoricalDataView: React.FC = () => {
  const [appliances, setAppliances] = useState<ApplianceWithDetails[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [logs, setLogs] = useState<TelemetryReading[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppliances().then(res => {
      setAppliances(res.data);
      if (res.data.length > 0) setSelectedApp(String(res.data[0].id));
    }).catch(() => toast.error('Failed to load appliances'));
  }, []);

  const loadHistory = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const res = await fetchApplianceTelemetry(selectedApp, { limit });
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to fetch historical telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedApp, limit]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            Historical Telemetry
          </h2>
          <p className="text-sm text-slate-400">Review raw SQLite timeline data for specific appliances</p>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Appliance</label>
          <select
            value={selectedApp}
            onChange={e => setSelectedApp(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none"
          >
            {appliances.map(app => (
              <option key={app.id} value={app.id}>{app.name} ({app.pzem_id})</option>
            ))}
          </select>
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Limit</label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
        <button
          onClick={loadHistory}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          Refresh
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 border-b border-slate-700/50 uppercase text-xs font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">PZEM ID</th>
                <th className="px-6 py-4 text-right">Voltage</th>
                <th className="px-6 py-4 text-right">Current</th>
                <th className="px-6 py-4 text-right">Power</th>
                <th className="px-6 py-4 text-right">Energy</th>
                <th className="px-6 py-4 text-right">PF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading rows...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No telemetry recorded yet.</td></tr>
              ) : (
                logs.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs">{row.timestamp}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{row.pzem_id}</td>
                    <td className="px-6 py-3 text-right font-mono text-cyan-400">{row.voltage.toFixed(1)} V</td>
                    <td className="px-6 py-3 text-right font-mono text-violet-400">{row.current.toFixed(2)} A</td>
                    <td className="px-6 py-3 text-right font-mono text-emerald-400">{Math.round(row.power)} W</td>
                    <td className="px-6 py-3 text-right font-mono text-amber-400">{row.energy.toFixed(5)} kWh</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-400">{row.power_factor.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
