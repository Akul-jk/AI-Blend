import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, LineChart as LineChartIcon } from 'lucide-react';
import { fetchAppliances, fetchApplianceTelemetry, predictEnergy } from '../services/api';
import type { TelemetryReading } from '../types';
import SectionHeader from '../components/glass/SectionHeader';
import GlassPanel from '../components/glass/GlassPanel';
import GlassSelect from '../components/glass/GlassSelect';
import LoadingState from '../components/glass/LoadingState';

const PredictionsView: React.FC = () => {
  const [selectedId, setSelectedId] = useState('');
  const appliancesQuery = useQuery({ queryKey: ['appliances'], queryFn: async () => (await fetchAppliances()).data });
  const appliances = appliancesQuery.data || [];
  const activeId = selectedId || String(appliances[0]?.id || '');
  const readingsQuery = useQuery({ queryKey: ['prediction-readings', activeId], enabled: !!activeId, queryFn: async () => (await fetchApplianceTelemetry(activeId, { limit: 100 })).data });
  const readings = [...(readingsQuery.data || [])].reverse();
  const usableReadings = readings.filter(reading => reading.quality === 'valid' && reading.interval_energy_kwh != null);
  const sequence = usableReadings.slice(-60);
  const predictionQuery = useQuery({ queryKey: ['prediction', activeId, sequence.at(-1)?.id], enabled: !!activeId && sequence.length === 60, queryFn: async () => (await predictEnergy(activeId, sequence as TelemetryReading[])).data, retry: false });
  if (appliancesQuery.isLoading) return <LoadingState text="Loading appliances…" />;
  const prediction = predictionQuery.data;
  return <div className="space-y-6">
    <SectionHeader title="Energy Predictions" subtitle="Forecast generated from recorded telemetry and the available ML model" icon={<LineChartIcon />} />
    <GlassPanel title="Forecast configuration"><div className="max-w-xl"><GlassSelect label="Appliance" value={activeId} onChange={e => setSelectedId(e.target.value)} options={appliances.map(a => ({ value: a.id, label: a.name }))} /></div></GlassPanel>
    {readingsQuery.isLoading ? <LoadingState text="Loading recorded readings…" /> : !activeId ? <GlassPanel><p className="p-6 text-slate-400">No appliances are configured.</p></GlassPanel> : sequence.length < 60 ? <GlassPanel><p className="p-6 text-slate-400">A forecast is unavailable. This model requires 60 valid interval readings; {sequence.length} are available.</p></GlassPanel> : predictionQuery.isLoading ? <LoadingState text="Requesting model forecast…" /> : predictionQuery.isError ? <GlassPanel><p className="p-6 text-amber-200">The model could not produce a forecast. Check that it is trained and the ML service is available.</p></GlassPanel> : prediction ? <GlassPanel title="Next interval energy" icon={<Activity size={18} />}><div className="p-6 space-y-3"><p className="text-4xl font-semibold text-white">{Number(prediction.prediction).toFixed(6)} <span className="text-lg text-slate-400">{prediction.unit}</span></p><dl className="grid grid-cols-2 gap-3 text-sm text-slate-300"><div>Target: next interval energy</div><div>Horizon: one sampling interval</div><div>Model: {prediction.model} ({prediction.model_version})</div><div>Source: {prediction.source}</div><div>Appliance: {appliances.find(a => String(a.id) === String(prediction.appliance_id))?.name || prediction.appliance_id}</div><div>Based on: {new Date(prediction.timestamp).toLocaleString()}</div></dl></div></GlassPanel> : null}
  </div>;
};
export default PredictionsView;
