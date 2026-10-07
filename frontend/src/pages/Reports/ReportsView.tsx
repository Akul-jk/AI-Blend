import React, { useState } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Download, FileSpreadsheet } from 'lucide-react';

const ReportsView: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (from && to && from > to) { toast.error('Start date must be before end date.'); return; }
    setBusy(true);
    try {
      const response = await api.get('/reports/export.csv', { params: { from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T23:59:59.999Z` : undefined }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = 'telemetry-export.csv'; link.click(); URL.revokeObjectURL(url);
      toast.success('Telemetry export downloaded.');
    } catch { toast.error('Telemetry export failed.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6"><section><h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-400" />Telemetry Export</h2><p className="text-sm text-slate-400 mt-1">Download recorded telemetry, including cumulative and derived interval energy.</p></section>
    <section className="glass-panel rounded-2xl p-6 max-w-3xl space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">From date (UTC)<input className="mt-2 block w-full rounded bg-slate-900 border border-white/10 p-2 text-white" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm text-slate-300">To date (UTC)<input className="mt-2 block w-full rounded bg-slate-900 border border-white/10 p-2 text-white" type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div><button onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Download size={16} />{busy ? 'Preparing export…' : 'Download CSV'}</button><p className="text-xs text-slate-500">No report history is stored. Each export is generated from database records at download time.</p></section>
  </div>;
};
export default ReportsView;
