// Legacy visual prototype, not routed by App.tsx; its fallback metrics are mock values.
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import {
  Brain,
  Database,
  Activity,
  Clock,
  CheckCircle2,
  Server,
  Code2
} from 'lucide-react';

interface MLModel {
  id: number;
  name: string;
  type: string;
  status: string;
  accuracy: number | null;
  loss: number | null;
  created_at: string;
}

export const AIOverviewView: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await api.get('/models');
        setModels(response.data);
      } catch (err) {
        console.error('Failed to load ML models:', err);
        toast.error('Rest API connection failed.');
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  const activeModel = models.find(m => m.status === 'completed') || {
    name: 'LSTM v2.4',
    type: 'LSTM (Time Series)',
    accuracy: 0.973,
    loss: 0.082
  };

  const kpis = [
    { label: 'Active Model', value: activeModel.name, subtitle: activeModel.type, icon: <Brain className="w-4 h-4 text-emerald-400" /> },
    { label: 'Prediction Accuracy', value: activeModel.accuracy ? `${(activeModel.accuracy * 100).toFixed(1)}%` : '97.3%', subtitle: 'R² score threshold metric', icon: <Activity className="w-4 h-4 text-violet-400" /> },
    { label: 'Dataset Size', value: '18,540', subtitle: 'Historical energy logs', icon: <Database className="w-4 h-4 text-blue-400" /> },
    { label: 'Feature Columns', value: '14 Columns', subtitle: 'Target variable: Power (kW)', icon: <Code2 className="w-4 h-4 text-amber-400" /> },
    { label: 'Model Status', value: 'Healthy', subtitle: 'Availability 100%', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
    { label: 'Avg Inference Latency', value: '58 ms', subtitle: 'XGBoost engine latency', icon: <Clock className="w-4 h-4 text-cyan-400" /> }
  ];

  return (
    <div className="flex flex-col gap-8">

      {/* Welcome Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            Machine Learning Studio Overview
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Control panel for managing, training, and deploying AI estimators</p>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
              {kpi.icon}
            </div>
            <div className="mt-3">
              <span className="text-lg font-bold tracking-tight text-slate-100 block">{kpi.value}</span>
              <span className="text-[8px] text-slate-500 block mt-0.5 truncate">{kpi.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Deployments & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Model Pipeline List */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-sm text-slate-200">Registered Models Registry</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">List of estimator cycles trained locally</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-400">
              {models.length} Models
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 uppercase font-mono text-[9px] tracking-wider">
                  <th className="pb-3 font-semibold">Model Name</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Accuracy (R²)</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">Querying registry...</td>
                  </tr>
                ) : models.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">No models registered yet. Go to Model Training to begin.</td>
                  </tr>
                ) : (
                  models.map(model => (
                    <tr key={model.id} className="hover:bg-slate-900/10">
                      <td className="py-3.5 font-bold text-slate-200">{model.name}</td>
                      <td className="py-3.5 text-slate-400 font-mono text-[10px]">{model.type}</td>
                      <td className="py-3.5 text-emerald-400 font-bold font-mono">
                        {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                          model.status === 'completed'
                            ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                            : model.status === 'training'
                            ? 'bg-amber-500/5 border-amber-500/10 text-amber-400 animate-pulse'
                            : 'bg-red-500/5 border-red-500/10 text-red-400'
                        }`}>
                          {model.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500 font-mono text-[10px]">
                        {new Date(model.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vertex Host Infrastructure details */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-5">ML Estimator Health</span>

            <div className="space-y-4">
              {[
                { label: 'Active Deployment', value: 'LSTM-Forecaster-v2.4' },
                { label: 'Data Drift Index', value: '0.02 (Stable)', color: 'text-emerald-400' },
                { label: 'Prediction Drift Index', value: '0.04 (Stable)', color: 'text-emerald-400' },
                { label: 'Target Model Memory', value: '184 MB' },
                { label: 'Average Evaluation Loss', value: '0.082 RMSE', color: 'text-violet-400' },
                { label: 'Evaluation Method', value: '5-Fold CV' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                  <span className={`text-[10px] font-bold text-slate-200 ${item.color || ''}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-900/60 flex items-center justify-between text-[9px] text-slate-600 font-mono">
            <div className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              <span>Edge GPU Active</span>
            </div>
            <span>v2.4 deployed</span>
          </div>
        </div>

      </div>

    </div>
  );
};
export default AIOverviewView;
