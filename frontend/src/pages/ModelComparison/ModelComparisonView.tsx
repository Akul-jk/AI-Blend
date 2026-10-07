import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompare } from 'lucide-react';
import { fetchModelInfo } from '../../services/api';

const ModelComparisonView: React.FC = () => {
  const query = useQuery({ queryKey: ['modelInfo'], queryFn: async () => (await fetchModelInfo()).data, retry: false });
  const model = query.data;
  const metrics = model?.metrics;
  return <div className="space-y-6"><section className="glass-panel p-6 rounded-2xl border border-slate-700/50"><div className="flex items-center gap-3 mb-6"><div className="p-3 bg-violet-500/10 rounded-xl"><GitCompare className="w-6 h-6 text-violet-400" /></div><div><h2 className="text-xl font-bold text-slate-100">Model Evaluation</h2><p className="text-sm text-slate-400">Reported evaluation metrics from the current model artifact</p></div></div>
    {query.isLoading ? <p className="text-slate-400">Loading model metadata…</p> : !model || model.status !== 'trained' ? <p className="text-slate-400">No trained model metadata is available.</p> : <><p className="text-sm text-slate-300 mb-5">{model.name} · {model.version} · {model.dataset_source} dataset</p>{metrics ? <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-400"><thead className="text-xs text-slate-500 uppercase bg-slate-900/50"><tr>{['MAE','RMSE','R²','WAPE','Test samples'].map(x => <th className="px-5 py-3" key={x}>{x}</th>)}</tr></thead><tbody><tr>{[metrics.mae, metrics.rmse, metrics.r2, metrics.wape, metrics.test_samples].map((value, i) => <td className="px-5 py-4 font-mono" key={i}>{value == null ? 'Not available' : Number(value).toFixed(i === 4 ? 0 : 6)}</td>)}</tr></tbody></table></div> : <p className="text-slate-500">Metrics are not available.</p>}</>}
  </section></div>;
};
export default ModelComparisonView;
