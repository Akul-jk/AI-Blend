import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassButton from '../components/glass/GlassButton';
import { AlertTriangle, Database, Play, Server } from 'lucide-react';
import { fetchModelInfo, trainModel, generateDataset } from '../services/api';

const formatCount = (value?: number) => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString()
  : 'Not recorded';

const ModelTrainingView: React.FC = () => {
  const model = useQuery({ queryKey: ['modelInfo'], queryFn: async () => (await fetchModelInfo()).data, refetchInterval: 10000, retry: false });
  const dataset = useMutation({ mutationFn: async () => (await generateDataset()).data });
  const training = useMutation({ mutationFn: async () => (await trainModel()).data, onSuccess: () => model.refetch() });
  const busy = dataset.isPending || training.isPending;
  const candidate = model.data?.latest_candidate;
  const candidateMae = candidate?.metrics?.candidate?.mae_kwh;
  const baselineMae = candidate?.metrics?.persistence_baseline?.mae_kwh;
  const maeChange = candidate?.metrics?.mae_improvement_vs_persistence_percent;

  return <div className="space-y-6">
    <SectionHeader title="Model Training" subtitle="Export canonical telemetry and train an isolated candidate model" icon={<Server />} />

    <GlassPanel title="How to read this model evaluation" icon={<AlertTriangle size={18} />}>
      <div className="space-y-3 p-5 text-sm leading-6 text-slate-300">
        <p><strong className="text-white">LSTM candidate:</strong> the trained sequence model uses recent readings to estimate the next interval.</p>
        <p><strong className="text-white">Persistence baseline:</strong> a simple benchmark that predicts the next interval will match the latest reading.</p>
        <p><strong className="text-white">MAE:</strong> average prediction error in kWh; lower is better. If the candidate error is higher, it did not improve on the simple benchmark and should remain inactive.</p>
        {candidate && typeof candidateMae === 'number' && typeof baselineMae === 'number' && <div className={`rounded-xl border p-4 ${candidate.deployment_eligible ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100' : 'border-amber-400/20 bg-amber-400/[.06] text-amber-100'}`}>
          <p className="font-semibold">{candidate.deployment_eligible ? 'The candidate passed the MAE gate.' : 'The simple baseline was closer on average, so this candidate stays inactive.'}</p>
          <p className="mt-1 text-xs">Candidate MAE: {candidateMae.toExponential(3)} kWh · baseline MAE: {baselineMae.toExponential(3)} kWh{typeof maeChange === 'number' ? ` · candidate MAE improvement: ${maeChange.toFixed(2)}%` : ''}</p>
          <p className="mt-1 text-xs">This comparison uses held-out {candidate.dataset_source} data ({formatCount(candidate.test_samples)} samples); it is not a real-home accuracy percentage.</p>
        </div>}
      </div>
    </GlassPanel>

    <div className="grid gap-6 lg:grid-cols-2">
      <GlassPanel title="Training configuration">
        <div className="space-y-3 p-4 text-sm text-slate-300">
          <div>Candidate family: energy_lstm_sim_v1</div>
          <div>Sequence: 60 readings</div>
          <div>Target: next interval energy (kWh)</div>
          <div>Sampling interval: {model.data?.sampling_interval || '5000ms default'}</div>
          <div>Split: chronological 70% / 15% / 15%</div>
          <div>Maximum epochs: 100 · batch size: 32</div>
          <p className="text-xs leading-5 text-amber-200/80">Exports are saved as uniquely named files. Training writes a separate candidate and never replaces the active or legacy model. A candidate is not activated automatically.</p>
          <div className="flex flex-wrap gap-3 pt-3">
            <GlassButton icon={<Database size={17} />} loading={dataset.isPending} disabled={busy} onClick={() => dataset.mutate()}>Export Dataset from Telemetry</GlassButton>
            <GlassButton variant="ai" icon={<Play size={17} />} loading={training.isPending} disabled={busy} onClick={() => training.mutate()}>Train Candidate</GlassButton>
          </div>
          {dataset.isSuccess && <p role="status" className="text-emerald-300">{dataset.data?.message || 'Dataset export completed.'} {dataset.data?.dataset && <span>{dataset.data.dataset}</span>}</p>}
          {dataset.isError && <p role="alert" className="text-rose-300">Dataset export failed. Confirm the backend telemetry database is available.</p>}
          {training.isSuccess && <p role="status" className="text-emerald-300">{training.data?.message || 'Candidate training request accepted.'} Training runs in the ML service.</p>}
          {training.isError && <p role="alert" className="text-rose-300">Candidate training request failed. Administrator access and a configured ML service are required.</p>}
        </div>
      </GlassPanel>

      <GlassPanel title="Model and dataset status">
        <div className="space-y-3 p-4 text-sm text-slate-300">
          {model.isLoading ? <p>Loading model metadata…</p> : model.isError ? <div role="alert" className="space-y-2 text-amber-200"><p>Model service is unavailable. Training and live candidate metrics need the ML service.</p><p className="text-xs text-slate-400">The rest of the application can still be demonstrated. Use the saved evaluation in the faculty demo guide if necessary.</p></div> : <>
            {model.data?.metadata_source === 'saved_candidate' && <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-400/[.06] p-3 text-xs leading-5 text-amber-100">Showing a saved candidate evaluation. The ML service is offline, so training and live forecasts are unavailable.</p>}
            <div>Status: {model.data?.status || 'Not available'}</div>
            <div>Active version: {model.data?.version || 'Not trained'}</div>
            <div>Source: {model.data?.dataset_source || 'Not available'}</div>
            <div>Trained: {model.data?.training_date ? new Date(model.data.training_date).toLocaleString() : 'Not available'}</div>
            <div>Active model metrics: {model.data?.metrics ? 'Available in model metadata' : 'No active model metrics'}</div>
            {candidate && <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <div className="font-semibold text-white">Latest candidate: {candidate.version}</div>
              <div>Raw source rows: {formatCount(candidate.training_data_rows)} simulated readings</div>
              <div>Eligible sequences — train: {formatCount(candidate.training_samples)} · validation: {formatCount(candidate.validation_samples)} · held-out test: {formatCount(candidate.test_samples)}</div>
              <p className="text-xs leading-5 text-slate-400">A sequence is a window of 60 readings. Gaps can cause windows to be discarded, so the sequence counts are not the same as the raw reading count.</p>
              <p className="text-amber-200">{candidate.activation}</p>
            </div>}
          </>}
        </div>
      </GlassPanel>
    </div>
  </div>;
};

export default ModelTrainingView;
