import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, LineChart as LineChartIcon } from 'lucide-react';
import { fetchAppliances, fetchApplianceTelemetry, fetchModelInfo, fetchSystemStatus, predictEnergy } from '../services/api';
import type { TelemetryReading } from '../types';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassSelect from '../components/glass/GlassSelect';
import LoadingState from '../components/glass/LoadingState';

const FEATURE_ORDER = ['voltage', 'current', 'power', 'energy', 'frequency', 'power_factor', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'month_sin', 'month_cos', 'is_weekend', 'energy_lag_1', 'energy_lag_2', 'energy_lag_3', 'power_lag_1', 'power_lag_2', 'power_lag_3'];

const PredictionsView: React.FC = () => {
  const [selectedId, setSelectedId] = useState('');
  const appliancesQuery = useQuery({ queryKey: ['appliances'], queryFn: async () => (await fetchAppliances()).data });
  const modelQuery = useQuery({ queryKey: ['forecast-model-info'], queryFn: async () => (await fetchModelInfo()).data, retry: false });
  const systemQuery = useQuery({ queryKey: ['forecast-system-status'], queryFn: async () => (await fetchSystemStatus()).data, retry: false });
  const appliances = appliancesQuery.data || [];
  const activeId = selectedId || String(appliances[0]?.id || '');
  const readingsQuery = useQuery({ queryKey: ['prediction-readings', activeId], enabled: !!activeId, queryFn: async () => (await fetchApplianceTelemetry(activeId, { limit: 100 })).data });
  const readings = [...(readingsQuery.data || [])].reverse();
  const usableReadings = readings.filter(reading => reading.quality === 'valid' && reading.interval_energy_kwh != null);
  const latestMeasured = usableReadings.at(-1);
  const configuredIntervalMs = Number(systemQuery.data?.samplingIntervalMs);
  const intervalSeconds = configuredIntervalMs / 1000;
  const referenceForecastKwh = latestMeasured && Number.isFinite(latestMeasured.power) && latestMeasured.power >= 0 && Number.isFinite(intervalSeconds) && intervalSeconds > 0
    ? latestMeasured.power * intervalSeconds / 3_600_000
    : null;
  const sequence = usableReadings.slice(-60);
  const modelIntervalMs = Number(modelQuery.data?.sampling_interval?.replace(/ms$/, ''));
  const inputCadenceMatches = sequence.length === 60 && sequence.slice(1).every((reading, index) => {
    const gap = new Date(reading.timestamp).getTime() - new Date(sequence[index].timestamp).getTime();
    return Number.isFinite(gap) && gap >= modelIntervalMs * 0.5 && gap <= modelIntervalMs * 1.5;
  });
  const contractMatches = modelQuery.data?.status === 'trained'
    && modelQuery.data.sequence_length === 60
    && modelQuery.data.features?.join('\0') === FEATURE_ORDER.join('\0')
    && Number.isFinite(modelIntervalMs)
    && systemQuery.data?.samplingIntervalMs === modelIntervalMs
    && inputCadenceMatches;
  const predictionQuery = useQuery({ queryKey: ['prediction', activeId, sequence.at(-1)?.id], enabled: !!activeId && sequence.length === 60 && contractMatches, queryFn: async () => (await predictEnergy(activeId, sequence as TelemetryReading[])).data, retry: false });
  if (appliancesQuery.isLoading) return <LoadingState text="Loading appliances…" />;
  const prediction = predictionQuery.data;
  return <div className="space-y-6">
    <SectionHeader title="Energy Predictions" subtitle="Transparent load estimate, with ML forecasts shown only when a compatible model is available" icon={<LineChartIcon />} />
    <GlassPanel title="Forecast configuration"><div className="max-w-xl"><GlassSelect label="Appliance" value={activeId} onChange={e => setSelectedId(e.target.value)} options={appliances.map(a => ({ value: a.id, label: a.name }))} /></div></GlassPanel>
    <GlassPanel title="Reference estimate · current load held constant" icon={<Activity size={18} />}><div className="space-y-3 p-6"><p className="text-4xl font-semibold text-white">{referenceForecastKwh == null ? 'Unavailable' : `${referenceForecastKwh.toExponential(3)} kWh`}</p>{latestMeasured && referenceForecastKwh != null ? <><p className="text-sm text-slate-300">Calculation: {latestMeasured.power.toFixed(2)} W × {intervalSeconds} s ÷ 3,600,000</p><p className="text-xs text-amber-100">This transparent reference assumes the latest measured power continues for one {intervalSeconds}-second interval. It is not an ML prediction.</p><p className="text-xs text-slate-400">Based on the {new Date(latestMeasured.timestamp).toLocaleString()} reading.</p></> : <p className="text-sm text-slate-400">A valid recent power reading and configured sampling interval are needed for this estimate.</p>}</div></GlassPanel>
    {modelQuery.data?.latest_candidate && !modelQuery.data.latest_candidate.deployment_eligible && <GlassPanel title="Latest model candidate"><div className="space-y-2 p-6 text-sm text-amber-100"><p>This candidate was trained from simulated telemetry and remains inactive because its held-out MAE did not beat the persistence baseline.</p><p>Candidate MAE: {modelQuery.data.latest_candidate.metrics?.candidate?.mae_kwh?.toExponential(3) ?? 'unavailable'} kWh; persistence MAE: {modelQuery.data.latest_candidate.metrics?.persistence_baseline?.mae_kwh?.toExponential(3) ?? 'unavailable'} kWh across {modelQuery.data.latest_candidate.test_samples} held-out samples.</p><p>{modelQuery.data.latest_candidate.activation}</p></div></GlassPanel>}
    {modelQuery.data?.dataset_source === 'simulation' && <p className="rounded-xl border border-amber-400/20 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100">Model provenance is synthetic simulation. A compatible contract alone does not establish hardware forecast accuracy.</p>}
    {readingsQuery.isLoading ? <LoadingState text="Loading recorded readings…" /> : !activeId ? <GlassPanel><p className="p-6 text-slate-400">No appliances are configured.</p></GlassPanel> : sequence.length < 60 ? <GlassPanel><p className="p-6 text-slate-400">The ML forecast is unavailable. It requires 60 valid, cadence-matched readings; {sequence.length} are available. The reference estimate above remains available from the latest reading.</p></GlassPanel> : !contractMatches ? <GlassPanel><p className="p-6 text-amber-200">The ML forecast is disabled because the full model contract could not be verified: required sequence is 60 readings, feature order is the canonical 19-field order, each sample must match the configured cadence, and model/runtime cadence must agree. {modelQuery.data?.sampling_interval ? `Model cadence: ${modelQuery.data.sampling_interval}. ` : ''}{systemQuery.data?.samplingIntervalMs ? `Configured cadence: ${systemQuery.data.samplingIntervalMs} ms.` : 'Model or system contract metadata is unavailable.'} {inputCadenceMatches ? '' : `The observed input sequence does not match ${modelQuery.data?.sampling_interval || 'the model'} cadence.`} No resampling or feature values are guessed.</p></GlassPanel> : predictionQuery.isLoading ? <LoadingState text="Requesting model forecast…" /> : predictionQuery.isError ? <GlassPanel><p className="p-6 text-amber-200">The compatible model could not produce an ML forecast. Check the ML service status.</p></GlassPanel> : prediction ? <GlassPanel title="ML next-interval forecast" icon={<Activity size={18} />}><div className="p-6 space-y-3"><p className="text-4xl font-semibold text-white">{Number(prediction.prediction).toFixed(6)} <span className="text-lg text-slate-400">{prediction.unit}</span></p><dl className="grid grid-cols-2 gap-3 text-sm text-slate-300"><div>Target: next interval energy</div><div>Horizon: one sampling interval</div><div>Model: {prediction.model} ({prediction.model_version})</div><div>Source: {prediction.source}</div><div>Appliance: {appliances.find(a => String(a.id) === String(prediction.appliance_id))?.name || prediction.appliance_id}</div><div>Based on: {new Date(prediction.timestamp).toLocaleString()}</div></dl></div></GlassPanel> : null}
  </div>;
};
export default PredictionsView;
