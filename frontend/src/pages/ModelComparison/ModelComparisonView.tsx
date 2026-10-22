import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, GitCompare, Info, LoaderCircle } from 'lucide-react';
import { fetchModelInfo } from '../../services/api';

const number = (value?: number, digits = 6) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'Not recorded';

const ModelComparisonView: React.FC = () => {
  const query = useQuery({ queryKey: ['modelInfo'], queryFn: async () => (await fetchModelInfo()).data, retry: false });
  const model = query.data;
  const candidate = model?.latest_candidate;
  const candidateMetrics = candidate?.metrics?.candidate;
  const baseline = candidate?.metrics?.persistence_baseline;
  const improvement = candidate?.metrics?.mae_improvement_vs_persistence_percent;

  return <div className="space-y-6">
    <section className="glass-panel rounded-2xl border border-slate-700/50 p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-violet-500/10 p-3"><GitCompare className="h-6 w-6 text-violet-400" /></div>
        <div><h1 className="text-xl font-bold text-slate-100">Model comparison</h1><p className="text-sm text-slate-400">Compare the app-compatible candidate with a persistence forecast on the same held-out readings.</p></div>
      </div>

      {query.isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="animate-spin" size={16} />Loading saved evaluation…</p>
        : query.isError ? <p role="alert" className="text-sm text-rose-300">Model evaluation data is unavailable. Check that the backend and ML service are running.</p>
        : !candidate || !candidateMetrics || !baseline ? <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-5 text-sm text-slate-400">No complete held-out candidate-versus-baseline comparison is available yet. Train an app-compatible candidate from canonical telemetry to create one.</div>
        : <>
          {model?.metadata_source === 'saved_candidate' && <p role="status" className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-sm text-amber-100">Saved evaluation shown; the ML service is currently offline. These results are read-only and do not indicate that a model is active.</p>}
          <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${candidate.deployment_eligible ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100' : 'border-amber-400/20 bg-amber-400/[.06] text-amber-100'}`}>
            {candidate.deployment_eligible ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0" size={18} />}
            <div><p className="font-semibold">{candidate.deployment_eligible ? 'Candidate passed the MAE baseline gate' : 'Persistence is the better MAE model; candidate stays inactive'}</p>
              <p className="mt-1 text-xs leading-5">{candidate.version} · {candidate.dataset_source} data · {candidate.test_samples ?? candidateMetrics.samples} held-out samples · {model?.sequence_length ?? 60} steps at {model?.sampling_interval ?? 'configured cadence'} per step.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Forecast method</th><th className="px-4 py-3">MAE (kWh)</th><th className="px-4 py-3">RMSE (kWh)</th><th className="px-4 py-3">WAPE</th><th className="px-4 py-3">R²</th><th className="px-4 py-3">Samples</th></tr></thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                <tr><th className="px-4 py-4 font-semibold text-white">LSTM candidate</th><td className="px-4 py-4 font-mono">{number(candidateMetrics.mae_kwh)}</td><td className="px-4 py-4 font-mono">{number(candidateMetrics.rmse_kwh)}</td><td className="px-4 py-4 font-mono">{number(candidateMetrics.wape_percent, 2)}%</td><td className="px-4 py-4 font-mono">{number(candidateMetrics.r2, 4)}</td><td className="px-4 py-4 font-mono">{candidateMetrics.samples ?? candidate.test_samples}</td></tr>
                <tr><th className="px-4 py-4 font-semibold text-white">Persistence baseline</th><td className="px-4 py-4 font-mono">{number(baseline.mae_kwh)}</td><td className="px-4 py-4 font-mono">{number(baseline.rmse_kwh)}</td><td className="px-4 py-4 font-mono">{number(baseline.wape_percent, 2)}%</td><td className="px-4 py-4 font-mono">{number(baseline.r2, 4)}</td><td className="px-4 py-4 font-mono">{baseline.samples}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-xl border p-4 sm:col-span-2 ${typeof improvement === 'number' && improvement >= 0 ? 'border-emerald-400/20 bg-emerald-400/[.06]' : 'border-amber-400/20 bg-amber-400/[.06]'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">In plain language</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">The LSTM is the trained pattern-finding model. The persistence baseline simply repeats the latest reading. {typeof improvement === 'number' && improvement < 0 ? `On this held-out simulation test, repeating the latest reading had lower average error; the LSTM's MAE was ${Math.abs(improvement).toFixed(2)}% higher, so it stays inactive.` : 'On this held-out simulation test, the LSTM had lower average error than the simple baseline.'}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-950/30 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Candidate MAE change vs baseline</p><p className={`mt-1 text-lg font-bold ${typeof improvement === 'number' && improvement >= 0 ? 'text-emerald-300' : 'text-amber-200'}`}>{number(improvement, 2)}%</p><p className="mt-1 text-xs text-slate-500">Positive means lower MAE; negative means worse MAE.</p></div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-950/30 p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500"><Info size={14} />How to read this</p><p className="mt-2 text-xs leading-5 text-slate-400">MAE and RMSE are forecast error in kWh; lower is better. WAPE is percentage error; lower is better. R² is not a percentage accuracy score. These results come from simulated telemetry and do not establish real-meter performance.</p></div>
          </div>
        </>}
    </section>
  </div>;
};

export default ModelComparisonView;
