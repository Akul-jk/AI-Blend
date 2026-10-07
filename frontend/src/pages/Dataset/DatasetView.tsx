import React, { useEffect, useState } from 'react';
import { fetchDatasets, deleteDataset } from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Database, FileSpreadsheet, Trash2 } from 'lucide-react';
import type { DatasetInfo } from '../../types';

export const DatasetView: React.FC = () => {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDatasets = async () => {
    try {
      const res = await fetchDatasets();
      setDatasets(res.data);
    } catch (err) {
      toast.error('Failed to load datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteDataset(id);
      toast.success('Dataset deleted successfully.');
      loadDatasets();
    } catch (err) {
      toast.error('Failed to delete dataset.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading datasets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-cyan-500/10 rounded-xl">
            <Database className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Training Datasets</h2>
            <p className="text-sm text-slate-400">Manage historical telemetry datasets for ML model training</p>
          </div>
        </div>

        {datasets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl bg-slate-900/30">
            <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300">No Datasets Found</h3>
            <p className="text-slate-500 mt-2">Generate a dataset from the ML Training page to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {datasets.map(ds => (
              <div key={ds.id} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-200 mb-2">{ds.name}</h3>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p>Source: <span className="text-slate-300 capitalize">{ds.source || 'Simulation'}</span></p>
                    <p>Rows: <span className="text-slate-300">{ds.row_count}</span></p>
                    <p>Size: <span className="text-slate-300">{(ds.size_bytes / 1024 / 1024).toFixed(2)} MB</span></p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetView;
