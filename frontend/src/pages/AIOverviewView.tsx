import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchModelInfo } from '../services/api';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import MetricCard from '../components/glass/MetricCard';
import StatusBadge from '../components/glass/StatusBadge';
import LoadingState from '../components/glass/LoadingState';
import { BrainCircuit, Activity, Database, TrendingUp } from 'lucide-react';

const AIOverviewView: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ['modelInfo'],
    queryFn: () => fetchModelInfo().then(res => res.data),
  });

  const modelInfo = response;

  if (isLoading) return <LoadingState text="Loading ML Model Info..." />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Insights & Model Status"
        subtitle="Overview of the machine learning models driving energy predictions"
        icon={<BrainCircuit />}
        action={
           <StatusBadge status="info" label={modelInfo?.dataset_source ? `DECLARED SOURCE · ${String(modelInfo.dataset_source).toUpperCase()}` : 'MODEL SOURCE UNAVAILABLE'} />
        }
      />

      {modelInfo ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassPanel title="Active Model" className="lg:col-span-2">
             <div className="flex justify-between items-start mb-6">
               <div>
                 <h3 className="text-2xl font-bold text-white mb-1">{modelInfo.name}</h3>
                 <p className="text-slate-400">Version: {modelInfo.version} • Status: {modelInfo.status.toUpperCase()}</p>
               </div>
               <StatusBadge status={modelInfo.status === 'trained' ? 'online' : 'warning'} label={modelInfo.status.toUpperCase()} />
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-slate-400 block mb-1">Source Data</span>
                  <span className="text-sm font-semibold text-white capitalize">{modelInfo.dataset_source}</span>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-slate-400 block mb-1">Appliance Scope</span>
                  <span className="text-sm font-semibold text-white">{modelInfo.appliance_scope}</span>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-slate-400 block mb-1">Sequence Length</span>
                  <span className="text-sm font-semibold text-white">{modelInfo.sequence_length}</span>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-slate-400 block mb-1">Sampling</span>
                  <span className="text-sm font-semibold text-white">{modelInfo.sampling_interval}</span>
                </div>
             </div>

             <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-white/10 pb-2">Features Used</h4>
             <div className="flex flex-wrap gap-2">
               {modelInfo.features.map(f => (
                 <span key={f} className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-cyan-400 border border-cyan-500/20">
                   {f}
                 </span>
               ))}
             </div>
          </GlassPanel>

          <div className="space-y-6">
            <GlassPanel title="Training Metrics" icon={<Activity className="text-emerald-400" />}>
              {modelInfo.metrics ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 border-b border-white/5">
                    <span className="text-sm text-slate-400">MAE</span>
                    <span className="font-mono text-white">{modelInfo.metrics.mae.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 border-b border-white/5">
                    <span className="text-sm text-slate-400">RMSE</span>
                    <span className="font-mono text-white">{modelInfo.metrics.rmse.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 border-b border-white/5">
                    <span className="text-sm text-slate-400">R² Score</span>
                    <span className="font-mono text-emerald-400">{modelInfo.metrics.r2.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-slate-400">MAPE</span>
                    <span className="font-mono text-white">{modelInfo.metrics.mape.toFixed(2)}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center py-4">Metrics not available</div>
              )}
            </GlassPanel>

            <MetricCard
              label="Test Samples"
              value={modelInfo.metrics?.test_samples ?? '—'}
              icon={<Database />}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">No AI model currently loaded.</div>
      )}

      <GlassPanel title="AI Insights" icon={<TrendingUp className="text-violet-400" />}><div className="text-sm text-slate-500 text-center py-6">No generated insights are available.</div></GlassPanel>
    </div>
  );
};

export default AIOverviewView;
