import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchModelInfo, fetchRecommendations } from '../services/api';
import type { UsageRecommendationSummary } from '../types';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import MetricCard from '../components/glass/MetricCard';
import StatusBadge from '../components/glass/StatusBadge';
import LoadingState from '../components/glass/LoadingState';
import { BrainCircuit, Activity, Database, TrendingUp, Lightbulb, AlertTriangle, Radio } from 'lucide-react';

const AIOverviewView: React.FC = () => {
  const { data: response, isLoading } = useQuery({
    queryKey: ['modelInfo'],
    queryFn: () => fetchModelInfo().then(res => res.data),
  });

  const modelInfo = response;
  const insightsQuery = useQuery({
    queryKey: ['energyRecommendations'],
    queryFn: () => fetchRecommendations().then(res => res.data),
    staleTime: 30000,
  });
  const insights = insightsQuery.data as UsageRecommendationSummary | undefined;

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

      <GlassPanel title="Energy insights" icon={<TrendingUp className="text-violet-400" />}>
        <div className="space-y-5 p-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-slate-100">What the recorded usage shows</h3><p className="mt-1 text-xs text-slate-400">Explainable insights calculated from valid meter interval energy over the last 24 hours.</p></div>
            {insights?.synthetic && <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/[.07] px-2.5 py-1 text-[10px] font-semibold text-cyan-100"><Radio size={12} />SIMULATED DATA</span>}
          </div>
          {insightsQuery.isLoading ? <p role="status" className="py-5 text-center text-sm text-slate-400">Loading measured energy insights…</p>
            : insightsQuery.isError ? <p role="alert" className="rounded-lg border border-rose-300/15 bg-rose-300/[.05] p-4 text-sm text-rose-200">Energy insights are unavailable. Check the telemetry connection and retry later.</p>
            : !insights ? <p className="py-5 text-center text-sm text-slate-400">No insight summary is available yet.</p>
            : <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400"><span>Source: <strong className="capitalize text-slate-200">{insights.source}</strong></span><span>Window: {insights.window_hours} hours</span>{insights.observed_from && insights.observed_to && <span>Observed: {new Date(insights.observed_from).toLocaleString()} – {new Date(insights.observed_to).toLocaleString()}</span>}</div>
              {insights.unusual_usage.length > 0 ? <div className="space-y-2">{insights.unusual_usage.map(item => <div key={item.appliance_id} className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs text-amber-100"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span><strong>{item.appliance_name}</strong> is using {item.observed_kwh_per_hour.toFixed(4)} kWh/hour versus its {item.baseline_days}-day baseline of {item.baseline_kwh_per_hour.toFixed(4)} kWh/hour ({item.ratio.toFixed(1)}×).</span></div>)}</div>
                : <p className="rounded-lg border border-white/[.06] bg-white/[.025] p-3 text-xs leading-5 text-slate-400">{insights.unusual_usage_status}</p>}
              <div className="space-y-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Highest measured consumers</h4>
                {insights.highest_consumers.length === 0 ? <p className="rounded-lg bg-white/[.025] p-4 text-center text-xs text-slate-400">No valid interval energy was recorded in this 24-hour window.</p> : insights.highest_consumers.map((item, index) => <article key={item.appliance_id} className="rounded-lg border border-white/[.06] bg-white/[.025] p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold text-slate-100">{index + 1}. {item.appliance_name}</p><p className="font-mono text-xs text-cyan-200">{item.energy_kwh.toFixed(4)} kWh</p></div>
                  <p className="mt-1 text-[10px] text-slate-500">{item.valid_readings} valid readings · {item.source === 'simulation' ? 'Synthetic simulation' : item.source === 'hardware' ? 'Hardware telemetry' : item.source}</p>
                  <ul className="mt-2 space-y-1">{item.actions.map(action => <li key={action} className="flex gap-2 text-xs leading-5 text-slate-300"><Lightbulb size={13} className="mt-1 shrink-0 text-amber-300" />{action}</li>)}</ul>
                </article>)}
              </div>
              <p className="text-[10px] leading-4 text-slate-500">These recommendations use deterministic rules and observed readings; they are not generated by the forecasting model. Savings are not estimated because the available data does not establish what usage can safely be reduced.</p>
            </>}
        </div>
      </GlassPanel>
    </div>
  );
};

export default AIOverviewView;
