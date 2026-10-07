import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassButton from '../components/glass/GlassButton';
import { Server, Play, Database } from 'lucide-react';
import { fetchModelInfo, trainModel, generateDataset } from '../services/api';

const ModelTrainingView: React.FC = () => {
  const model = useQuery({ queryKey: ['modelInfo'], queryFn: async () => (await fetchModelInfo()).data, refetchInterval: 10000, retry: false });
  const dataset = useMutation({ mutationFn: async () => (await generateDataset()).data });
  const training = useMutation({ mutationFn: async () => (await trainModel()).data, onSuccess: () => model.refetch() });
  const busy = dataset.isPending || training.isPending;
  return <div className="space-y-6"><SectionHeader title="Model Training" subtitle="Export canonical telemetry and request the configured LSTM training run" icon={<Server />} />
    <div className="grid gap-6 lg:grid-cols-2"><GlassPanel title="Training configuration"><div className="space-y-3 p-4 text-sm text-slate-300"><div>Model: energy_lstm_sim_v1</div><div>Sequence: 60 readings</div><div>Target: next interval energy (kWh)</div><div>Sampling interval: {model.data?.sampling_interval || '5000ms default'}</div><div>Split: chronological 70% / 15% / 15%</div><div>Maximum epochs: 100 · batch size: 32</div><div className="flex flex-wrap gap-3 pt-3"><GlassButton icon={<Database size={17} />} loading={dataset.isPending} disabled={busy} onClick={() => dataset.mutate()}>Export Dataset from Telemetry</GlassButton><GlassButton variant="ai" icon={<Play size={17} />} loading={training.isPending} disabled={busy} onClick={() => training.mutate()}>Start Training</GlassButton></div>{dataset.isSuccess && <p role="status" className="text-emerald-300">{dataset.data?.message || 'Dataset export queued.'}</p>}{dataset.isError && <p role="alert" className="text-rose-300">Dataset export failed. Confirm the backend telemetry database is available.</p>}{training.isSuccess && <p role="status" className="text-emerald-300">{training.data?.message || 'Training request accepted.'} Training runs in the ML service.</p>}{training.isError && <p role="alert" className="text-rose-300">Training request failed. Administrator access and a configured ML service are required.</p>}</div></GlassPanel>
    <GlassPanel title="Model status"><div className="space-y-3 p-4 text-sm text-slate-300">{model.isLoading ? <p>Loading model metadata…</p> : model.isError ? <p>ML service metadata is unavailable.</p> : <><div>Status: {model.data?.status || 'Not available'}</div><div>Version: {model.data?.version || 'Not trained'}</div><div>Source: {model.data?.dataset_source || 'Not available'}</div><div>Trained: {model.data?.training_date ? new Date(model.data.training_date).toLocaleString() : 'Not available'}</div><div>Metrics: {model.data?.metrics ? 'Available in model metadata' : 'Not available'}</div></>}</div></GlassPanel></div>
  </div>;
};
export default ModelTrainingView;
