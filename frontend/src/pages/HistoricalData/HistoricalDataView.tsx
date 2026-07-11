import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  History, 
  SlidersHorizontal,
  Clock
} from 'lucide-react';

interface HistoryPoint {
  id: number;
  sensorId: string;
  value: number;
  timestamp: string;
}

export const HistoricalDataView: React.FC = () => {
  const [logs, setLogs] = useState<HistoryPoint[]>([]);
  const [sensorId, setSensorId] = useState('sns-001');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/sensors/history?sensorId=${sensorId}&limit=${limit}`);
      setLogs(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load history data logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [sensorId, limit]);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            Historical Telemetry Logs
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Explore database time-series logs for model auditing</p>
        </div>
      </section>

      {/* Query Filters */}
      <div className="glass-panel rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Sensor Target</label>
          <select
            value={sensorId}
            onChange={e => setSensorId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
          >
            <option value="sns-001">sns-001 (Active Power kW)</option>
            <option value="sns-002">sns-002 (Grid Frequency Hz)</option>
            <option value="sns-003">sns-003 (Ambient Temp °C)</option>
            <option value="sns-004">sns-004 (Relative Humidity %)</option>
            <option value="sns-005">sns-005 (Solar Power kW)</option>
            <option value="sns-007">sns-007 (Generator Fuel Level %)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Row Output Limit</label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchHistory}
            className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-slate-100 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            Refresh Query Results
          </button>
        </div>
      </div>

      {/* Spreadsheet grid results */}
      <div className="glass-panel rounded-2xl p-6">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Historical Query Log</span>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-500 uppercase font-mono text-[9px] tracking-wider">
                <th className="pb-3 font-semibold">Row ID</th>
                <th className="pb-3 font-semibold">Sensor Key</th>
                <th className="pb-3 font-semibold">Recorded value</th>
                <th className="pb-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 font-mono text-[10px] text-slate-400">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">Executing database lookup...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">No log points found for the selected query settings.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-900/10">
                    <td className="py-2.5 text-slate-500">#{log.id}</td>
                    <td className="py-2.5 text-slate-300 font-sans font-bold">{log.sensorId}</td>
                    <td className="py-2.5 text-emerald-400 font-bold">{log.value}</td>
                    <td className="py-2.5 text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" />
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
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
export default HistoricalDataView;
