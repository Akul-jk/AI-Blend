import React, { useState } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  GitCompare, 
  ChevronDown, 
  ChevronUp, 
  Sparkles
} from 'lucide-react';

interface CompareRow {
  model: string;
  accuracy: number;
  rmse: number;
  mae: number;
  r2: number;
  deployed: boolean;
}

export const ModelComparisonView: React.FC = () => {
  const [models, setModels] = useState<CompareRow[]>([
    { model: 'LSTM v2.4 (Active)', accuracy: 97.3, rmse: 0.12, mae: 0.09, r2: 0.98, deployed: true },
    { model: 'XGBoost Forecaster', accuracy: 95.6, rmse: 0.18, mae: 0.13, r2: 0.96, deployed: false },
    { model: 'Random Forest Regressor', accuracy: 94.9, rmse: 0.21, mae: 0.16, r2: 0.95, deployed: false },
    { model: 'GRU Seq-to-Seq', accuracy: 96.8, rmse: 0.14, mae: 0.11, r2: 0.97, deployed: false }
  ]);

  const [sortField, setSortField] = useState<keyof CompareRow>('accuracy');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof CompareRow) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  const handleDeploy = async (modelName: string) => {
    toast.info(`Deploying ${modelName} to edge inference server...`);
    try {
      await api.post('/models/deploy', { name: modelName });
      
      setModels(prev => prev.map(m => ({
        ...m,
        deployed: m.model === modelName
      })));
      toast.success(`${modelName} is now in production!`);
    } catch (err) {
      console.error(err);
      toast.error('Deployment failed.');
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-amber-400" />
            Estimator Model Comparison Matrix
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Compare accuracy, compute scores, and deploy estimators to edge servers</p>
        </div>
      </section>

      {/* Comparison spreadsheet */}
      <div className="glass-panel rounded-2xl p-6">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-6">Model Scorecard Comparison</span>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-500 uppercase font-mono text-[9px] tracking-wider cursor-pointer select-none">
                <th className="pb-3 font-semibold">Model Name</th>
                <th className="pb-3 font-semibold" onClick={() => handleSort('accuracy')}>
                  <div className="flex items-center gap-1">
                    Accuracy (%)
                    {sortField === 'accuracy' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </div>
                </th>
                <th className="pb-3 font-semibold" onClick={() => handleSort('rmse')}>
                  <div className="flex items-center gap-1">
                    RMSE
                    {sortField === 'rmse' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </div>
                </th>
                <th className="pb-3 font-semibold" onClick={() => handleSort('mae')}>
                  <div className="flex items-center gap-1">
                    MAE
                    {sortField === 'mae' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </div>
                </th>
                <th className="pb-3 font-semibold" onClick={() => handleSort('r2')}>
                  <div className="flex items-center gap-1">
                    R² Score
                    {sortField === 'r2' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </div>
                </th>
                <th className="pb-3 font-semibold text-right">Deployment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 font-mono text-[11px] text-slate-300">
              {sortedModels.map((row, idx) => (
                <tr key={idx} className={`hover:bg-slate-900/10 ${row.deployed ? 'bg-emerald-500/[0.01]' : ''}`}>
                  <td className="py-3.5 font-bold text-slate-100 font-sans flex items-center gap-2">
                    {row.deployed && <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                    {row.model}
                  </td>
                  <td className="py-3.5 text-emerald-400 font-bold">{row.accuracy.toFixed(1)}%</td>
                  <td className="py-3.5">{row.rmse.toFixed(2)}</td>
                  <td className="py-3.5">{row.mae.toFixed(2)}</td>
                  <td className="py-3.5 text-violet-400 font-bold">{row.r2.toFixed(2)}</td>
                  <td className="py-3.5 text-right font-sans">
                    {row.deployed ? (
                      <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        In Production
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeploy(row.model)}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded text-[9px] font-bold transition-all uppercase tracking-wide"
                      >
                        Deploy to Edge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
export default ModelComparisonView;
