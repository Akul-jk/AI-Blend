import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  FileSpreadsheet, 
  Download, 
  Plus
} from 'lucide-react';

interface ReportItem {
  id: number;
  type: string;
  generated_by: string;
  generated_at: string;
}

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportType, setReportType] = useState('Daily');
  const [generating, setGenerating] = useState(false);

  const fetchReports = async () => {
    try {
      const response = await api.get('/reports');
      setReports(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports history.');
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await api.post('/reports/generate', { type: reportType });
      toast.success(`${reportType} report generated!`);
      fetchReports();
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (id: number) => {
    toast.info('Downloading spreadsheet...');
    const url = `${api.defaults.baseURL}/reports/download/${id}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Report Export Center
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Generate daily, weekly, or monthly consumption audits</p>
        </div>
      </section>

      {/* Grid: Compiler form & Reports List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Compiler Form */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between h-fit">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Compile Audit Report</span>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Report Interval</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors appearance-none"
                >
                  <option value="Daily" className="bg-slate-950">Daily Load Profile</option>
                  <option value="Weekly" className="bg-slate-950">Weekly Analysis</option>
                  <option value="Monthly" className="bg-slate-950">Monthly Financial Audit</option>
                  <option value="Custom" className="bg-slate-950">Custom Filter Audit</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {generating ? 'Compiling telemetry...' : 'Compile Audit Report'}
              </button>
            </form>
          </div>
        </div>

        {/* Audit reports list */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Export History</span>
          
          <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
            {reports.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-xs font-mono">
                No reports compiled.
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="flex items-center justify-between border-b border-slate-900 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">{report.type} Audit</h4>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        Generated by: {report.generated_by} • {new Date(report.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDownload(report.id)}
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-2.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default ReportsView;
