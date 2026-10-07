import React, { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, fetchSystemStatus, fetchTariff, updateTariff } from '../services/api';
import GlassPanel from '../components/glass/GlassPanel';
import GlassButton from '../components/glass/GlassButton';
import SectionHeader from '../components/glass/SectionHeader';
import { Settings as SettingsIcon, Save } from 'lucide-react';

type Settings = { phase_type: 'single' | 'three' };
type TariffEdit = { id: number; fixed_charge: number; meter_rent: number; fuel_surcharge: number; electricity_duty_percent: number; green_tariff_optional: number; slabs: Array<{ min_units: number; max_units: number | null; rate: number; is_telescopic: boolean }> };
const initial: Settings = { phase_type: 'single' };

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dataSource, setDataSource] = useState('unavailable');
  const [tariff, setTariff] = useState<TariffEdit | null>(null);
  const [tariffBusy, setTariffBusy] = useState(false);
  useEffect(() => { fetchSettings().then(({ data }) => setSettings({ ...initial, ...data })).catch(() => setMessage('Settings could not be loaded.')); }, []);
  useEffect(() => { fetchSystemStatus().then(({ data }) => setDataSource(data.mode)).catch(() => setDataSource('unavailable')); }, []);
  useEffect(() => { fetchTariff().then(({ data }) => setTariff({ ...data.tariff, slabs: data.slabs.map((slab: any) => ({ min_units: slab.min_units, max_units: slab.max_units, rate: slab.rate, is_telescopic: Boolean(slab.is_telescopic) })) })).catch(() => setMessage('Tariff configuration could not be loaded.')); }, []);
  const save = async () => {
    setBusy(true); setMessage('');
    try { await updateSettings(settings); setMessage('Settings saved.'); }
    catch { setMessage('Settings were not saved. Check administrator access and try again.'); }
    finally { setBusy(false); }
  };
  const update = (key: keyof Settings, value: string) => setSettings(current => ({ ...current, [key]: value as Settings[keyof Settings] }));
  const saveTariff = async () => {
    if (!tariff) return;
    setTariffBusy(true); setMessage('');
    try { await updateTariff(tariff.id, tariff); setMessage('Tariff configuration saved.'); }
    catch { setMessage('Tariff configuration was not saved. Check administrator access and try again.'); }
    finally { setTariffBusy(false); }
  };
  return <div className="space-y-6">
    <SectionHeader title="System Settings" subtitle="Persist the billing phase used by the tariff calculator" icon={<SettingsIcon />} action={<GlassButton icon={<Save size={18} />} loading={busy} onClick={save}>Save Changes</GlassButton>} />
    <GlassPanel title="Preferences"><div className="grid gap-5 md:grid-cols-2 p-4">
      <div className="text-sm text-slate-300">Latest telemetry source<div className="mt-3 text-white capitalize">{dataSource}</div></div>
      <label className="text-sm text-slate-300">Billing phase<select className="mt-2 w-full rounded bg-slate-900 border border-white/10 p-2 text-white" value={settings.phase_type} onChange={e => update('phase_type', e.target.value)}><option value="single">Single phase</option><option value="three">Three phase</option></select></label>
      {message && <p role="status" className="md:col-span-2 text-sm text-slate-300">{message}</p>}
    </div></GlassPanel>
    <GlassPanel title="Tariff Configuration">
      {!tariff ? <p className="p-4 text-slate-500">Tariff data is unavailable.</p> : <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([['fixed_charge','Fixed charge'],['meter_rent','Single phase meter rent'],['fuel_surcharge','Fuel surcharge / unit'],['electricity_duty_percent','Electricity duty (%)'],['green_tariff_optional','Optional green tariff / unit']] as const).map(([key,label]) => <label className="text-sm text-slate-300" key={key}>{label}<input className="mt-2 block w-full rounded bg-slate-900 border border-white/10 p-2 text-white" type="number" min="0" step="0.01" value={tariff[key]} onChange={e => setTariff(current => current ? { ...current, [key]: Number(e.target.value) } : current)} /></label>)}</div>
        <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-200">Configured energy slabs</h3><div className="grid grid-cols-4 gap-3 text-xs text-slate-500"><span>From units</span><span>To units</span><span>Rate / unit</span><span>Billing mode</span></div>{tariff.slabs.map((slab,index) => <div className="grid grid-cols-4 gap-3" key={index}><input aria-label="Minimum units" className="rounded bg-slate-900 border border-white/10 p-2 text-white" type="number" min="0" value={slab.min_units} onChange={e => setTariff(current => current ? { ...current, slabs: current.slabs.map((item,i) => i === index ? { ...item, min_units: Number(e.target.value) } : item) } : current)} /><input aria-label="Maximum units" className="rounded bg-slate-900 border border-white/10 p-2 text-white" type="number" min="0" value={slab.max_units ?? ''} onChange={e => setTariff(current => current ? { ...current, slabs: current.slabs.map((item,i) => i === index ? { ...item, max_units: e.target.value === '' ? null : Number(e.target.value) } : item) } : current)} /><input aria-label="Rate per unit" className="rounded bg-slate-900 border border-white/10 p-2 text-white" type="number" min="0" step="0.01" value={slab.rate} onChange={e => setTariff(current => current ? { ...current, slabs: current.slabs.map((item,i) => i === index ? { ...item, rate: Number(e.target.value) } : item) } : current)} /><span className="py-2 text-slate-300">{slab.is_telescopic ? 'Telescopic' : 'Flat by bracket'}</span></div>)}</div>
        <p className="text-xs text-slate-500">Three phase changes meter rent only. Energy slab rates remain those explicitly configured.</p><GlassButton icon={<Save size={18} />} loading={tariffBusy} onClick={saveTariff}>Save Tariff</GlassButton>
      </div>}
    </GlassPanel>
  </div>;
};
export default SettingsView;
