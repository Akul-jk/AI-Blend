import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  Database, 
  Upload, 
  Search, 
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

interface DatasetItem {
  id: number;
  name: string;
  size: string;
  records: number;
  uploaded_by: string;
  created_at: string;
}

export const DatasetView: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Preview page rows pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  // Mock telemetry data rows for Explorer spreadsheet
  const explorerRows = [
    { timestamp: '17:15:00', voltage: 229.4, current: 2.36, power: 541, energy: 7.82 },
    { timestamp: '17:15:03', voltage: 228.9, current: 2.45, power: 561, energy: 7.83 },
    { timestamp: '17:15:06', voltage: 229.1, current: 2.21, power: 506, energy: 7.84 },
    { timestamp: '17:15:09', voltage: 229.5, current: 2.38, power: 546, energy: 7.85 },
    { timestamp: '17:15:12', voltage: 229.2, current: 2.65, power: 607, energy: 7.86 },
    { timestamp: '17:15:15', voltage: 228.7, current: 2.32, power: 530, energy: 7.87 },
    { timestamp: '17:15:18', voltage: 229.0, current: 2.15, power: 492, energy: 7.88 },
    { timestamp: '17:15:21', voltage: 229.3, current: 2.41, power: 552, energy: 7.89 },
    { timestamp: '17:15:24', voltage: 229.6, current: 2.50, power: 574, energy: 7.90 }
  ];

  const fetchDatasets = async () => {
    try {
      const response = await api.get('/datasets');
      setDatasets(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load datasets.');
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) return;

    setUploading(true);
    try {
      const mockSize = `${(Math.random() * 5 + 1).toFixed(1)} MB`;
      const mockRecords = Math.round(10000 + Math.random() * 15000);
      
      await api.post('/datasets', {
        name: uploadName,
        size: mockSize,
        records: mockRecords,
        uploaded_by: 'Operator'
      });

      toast.success('Dataset registered successfully!');
      setUploadName('');
      fetchDatasets();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const filteredExplorerRows = useMemo(() => {
    if (!searchQuery) return explorerRows;
    return explorerRows.filter(row => 
      row.timestamp.includes(searchQuery) ||
      row.voltage.toString().includes(searchQuery) ||
      row.current.toString().includes(searchQuery) ||
      row.power.toString().includes(searchQuery)
    );
  }, [searchQuery]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredExplorerRows.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredExplorerRows, currentPage]);

  const totalPages = Math.ceil(filteredExplorerRows.length / rowsPerPage);

  // SVG correlation matrix heatmap configurations
  const matrixVars = ['Volt', 'Curr', 'Power', 'Temp', 'Humid', 'PF'];
  const correlationValues = [
    [1.0, -0.4, 0.2, 0.1, -0.1, 0.3],
    [-0.4, 1.0, 0.8, 0.3, 0.2, -0.2],
    [0.2, 0.8, 1.0, 0.4, 0.1, -0.1],
    [0.1, 0.3, 0.4, 1.0, -0.6, 0.0],
    [-0.1, 0.2, 0.1, -0.6, 1.0, -0.1],
    [0.3, -0.2, -0.1, 0.0, -0.1, 1.0]
  ];

  // Helper color for correlation heatmap cells
  const getHeatmapColor = (val: number) => {
    if (val === 1.0) return 'fill-emerald-500/80';
    if (val > 0.6) return 'fill-emerald-500/50';
    if (val > 0.1) return 'fill-emerald-500/20';
    if (val > -0.2) return 'fill-slate-900';
    return 'fill-red-500/20';
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Dataset Management Console
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Collect, preview, and process telemetry datasets for training</p>
        </div>
      </section>

      {/* Grid: Upload & Dataset List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form Card */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between h-fit">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Register Dataset</span>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dataset Name</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  required
                  placeholder="e.g. active-pzem-grid-july.csv"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                />
              </div>

              <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center flex flex-col items-center justify-center bg-slate-900/10">
                <Upload className="w-8 h-8 text-slate-600 mb-2.5" />
                <span className="text-[10px] text-slate-400">CSV, Excel, or JSON formats supported</span>
                <span className="text-[8px] text-slate-600 font-mono mt-1">Edge Upload Sim Enabled</span>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {uploading ? 'Processing file...' : 'Ingest and Process Dataset'}
              </button>
            </form>
          </div>
        </div>

        {/* Dataset Registry List */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Uploaded Datasets</span>
          
          <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
            {datasets.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-xs font-mono">
                No datasets registered.
              </div>
            ) : (
              datasets.map(dataset => (
                <div key={dataset.id} className="flex items-center justify-between border-b border-slate-900 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">{dataset.name}</h4>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        {dataset.records} records • Size: {dataset.size} • {new Date(dataset.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                    {dataset.uploaded_by}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Grid: Preview & Quality stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Data Explorer preview sheet */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-sm text-slate-200">Interactive Data Explorer</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Real-time spreadsheet row telemetry previews</p>
            </div>
            
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter row values..."
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-[10px] focus:outline-none focus:border-emerald-500/50 w-44"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 uppercase font-mono text-[9px] tracking-wider">
                  <th className="pb-3 font-semibold">Timestamp</th>
                  <th className="pb-3 font-semibold">Voltage (V)</th>
                  <th className="pb-3 font-semibold">Current (A)</th>
                  <th className="pb-3 font-semibold">Power (W)</th>
                  <th className="pb-3 font-semibold">Energy (kWh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-mono text-[10px] text-slate-400">
                {paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/10">
                    <td className="py-2.5 text-slate-500">{row.timestamp}</td>
                    <td className="py-2.5">{row.voltage}</td>
                    <td className="py-2.5">{row.current}</td>
                    <td className="py-2.5 text-emerald-400 font-semibold">{row.power}</td>
                    <td className="py-2.5">{row.energy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-900 text-[10px]">
            <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Dataset stats card */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-5">Dataset Quality Report</span>
            
            <div className="flex justify-between items-center bg-slate-900/20 border border-slate-900 rounded-xl p-4 mb-6">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Quality Score</span>
                <span className="text-xl font-bold text-emerald-400 block mt-1">96.4% Healthy</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-400">
                <ShieldCheck className="w-6 h-6 animate-pulse-slow" />
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {[
                { label: 'Number of Rows', value: '18,540 rows' },
                { label: 'Feature Columns', value: '14 Features' },
                { label: 'Missing Values', value: '3 Cells', color: 'text-amber-400' },
                { label: 'Duplicate Rows', value: '21 Duplicates', color: 'text-amber-400' },
                { label: 'Outlier Count', value: '14 Points' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                  <span className={`text-[10px] font-bold text-slate-200 ${item.color || ''}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Grid: Heatmap Correlation & Importance bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Heatmap correlation matrix */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-200">Correlation Heatmap Matrix</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">Pearson correlation indices between variables</p>
          </div>

          <div className="flex justify-center items-center overflow-x-auto py-2.5">
            <div className="grid grid-cols-7 gap-1 font-mono text-[9px] text-slate-500">
              {/* Top-left spacer */}
              <div></div>
              {matrixVars.map((v, i) => (
                <div key={i} className="text-center font-bold text-[8px] uppercase tracking-wider">{v}</div>
              ))}

              {matrixVars.map((vRow, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  <div className="font-bold text-[8px] uppercase tracking-wider pr-2 flex items-center justify-end">{vRow}</div>
                  {correlationValues[rowIdx].map((val, colIdx) => (
                    <div 
                      key={colIdx} 
                      className={`w-9 h-9 rounded flex items-center justify-center font-bold text-[10px] transition-all border border-slate-900/60 ${getHeatmapColor(val)}`}
                      title={`${vRow} to ${matrixVars[colIdx]}: ${val}`}
                    >
                      <span className={val > 0.5 ? 'text-slate-100' : 'text-slate-400'}>{val.toFixed(1)}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Importance bar chart */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-6">
            <h3 className="font-bold text-sm text-slate-200">Gini Feature Importance</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">XGBoost relative importance factor metrics</p>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Active Power Draw (W)', value: 36, color: 'from-emerald-500 to-teal-500' },
              { label: 'Current Load (A)', value: 25, color: 'from-emerald-500/80 to-teal-500/80' },
              { label: 'Line Voltage (V)', value: 18, color: 'from-emerald-500/60 to-teal-500/60' },
              { label: 'Time-of-day Hour', value: 12, color: 'from-emerald-500/40 to-teal-500/40' },
              { label: 'Ambient Temperature', value: 5, color: 'from-slate-800 to-slate-700' },
              { label: 'Relative Humidity', value: 4, color: 'from-slate-800 to-slate-700' }
            ].map((feature, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="font-medium text-slate-300">{feature.label}</span>
                  <span className="font-bold text-slate-200">{feature.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${feature.color} rounded-full`}
                    style={{ width: `${feature.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
export default DatasetView;
