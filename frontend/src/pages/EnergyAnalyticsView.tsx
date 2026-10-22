import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsTrends, fetchAnalyticsBreakdown, fetchBillingUsage, fetchSettings, calculateBill, fetchRecommendations } from '../services/api';
import SectionHeader from '../components/glass/SectionHeader';
import ChartContainer from '../components/glass/ChartContainer';
import GlassPanel from '../components/glass/GlassPanel';
import MetricCard from '../components/glass/MetricCard';
import LoadingState from '../components/glass/LoadingState';
import { BarChart2, DollarSign, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EnergyAnalyticsView: React.FC = () => {
  const [period, setPeriod] = useState('hourly');
  const [billProfile, setBillProfile] = useState<'kseb_lt1_sourced' | 'configured'>('kseb_lt1_sourced');
  const [fuelRate, setFuelRate] = useState(0);
  const [meterRent, setMeterRent] = useState(0);
  const [greenRate, setGreenRate] = useState(0);
  const [targetReductionPercent, setTargetReductionPercent] = useState(0);

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics', 'trends', period],
    queryFn: () => fetchAnalyticsTrends(period).then(res => res.data),
  });

  const { data: breakdown = [] } = useQuery({
    queryKey: ['analytics', 'breakdown'],
    queryFn: () => fetchAnalyticsBreakdown().then(res => res.data),
  });
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: async () => (await fetchRecommendations()).data, retry: false });
  const billing = useQuery({ queryKey: ['billing-usage', billProfile, fuelRate, meterRent, greenRate], queryFn: async () => {
    const [usageResponse, settingsResponse] = await Promise.all([fetchBillingUsage(), fetchSettings()]);
    const billResponse = await calculateBill(usageResponse.data.consumption, {
      phase_type: settingsResponse.data.phase_type,
      ...(billProfile === 'kseb_lt1_sourced' ? {
        profile: 'kseb_lt1_sourced' as const,
        fuel_surcharge_per_unit: fuelRate,
        meter_rent: meterRent,
        green_charge_per_unit: greenRate,
      } : {}),
    });
    return { usage: usageResponse.data, bill: billResponse.data };
  } });

  const breakdownColors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  const totalEnergy = trends.length ? trends.reduce((acc, curr) => acc + (curr.energy || 0), 0) : null;
  const bill = billing.data?.bill;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Energy Analytics"
        subtitle="Analyze historical consumption and costs"
        icon={<BarChart2 />}
        action={
          <div className="flex bg-slate-900/50 rounded-lg p-1 border border-white/5">
            {['hourly', 'daily', 'monthly'].map(t => (
              <button
                key={t}
                onClick={() => setPeriod(t)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  period === t ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={`${period[0].toUpperCase()}${period.slice(1)} energy`} value={totalEnergy == null ? '—' : totalEnergy.toFixed(1)} unit="kWh" />
        <MetricCard label="This Month Energy" value={billing.data?.usage.consumption == null ? '—' : billing.data.usage.consumption.toFixed(3)} unit="kWh" />
        <MetricCard label="Current Month Bill" value={bill ? `${bill.currency} ${bill.total.toFixed(2)}` : '—'} icon={<DollarSign />} />
        <MetricCard label="Average Power" value={trends.length ? (trends.reduce((a,c) => a + c.avg_power, 0) / trends.length).toFixed(0) : '—'} unit="W" />
        <MetricCard label="Peak Recorded" value={trends.length ? Math.max(...trends.map(t => t.peak_power)).toFixed(0) : '—'} unit="W" />
      </div>

      <GlassPanel title="Consumption-based recommendations" icon={<Lightbulb size={18} />}>
        <div className="space-y-4 p-1">
          {recommendations.isLoading ? <LoadingState text="Reviewing recorded consumption…" /> : recommendations.isError ? <p role="alert" className="text-sm text-amber-200">Recommendations are unavailable because the telemetry history could not be read.</p> : recommendations.data?.synthetic && <p className="rounded-lg border border-amber-400/20 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100">Synthetic simulator telemetry: these rankings describe demo readings, not verified household usage.</p>}
          {recommendations.data?.observed_from && <p className="text-xs text-[var(--text-muted)]">Valid interval readings · {new Date(recommendations.data.observed_from).toLocaleString()} – {new Date(recommendations.data.observed_to || recommendations.data.observed_from).toLocaleString()}. Values are limited to this observed window (up to 24 hours).</p>}
          {recommendations.data && recommendations.data.highest_consumers.length > 0 ? <>
            <div className="space-y-3">{recommendations.data.highest_consumers.map((item, index) => <div key={item.appliance_id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold text-[var(--text-primary)]">{index + 1}. {item.appliance_name}</h3><span className="font-mono text-sm text-[var(--accent)]">{item.energy_kwh.toFixed(4)} kWh</span></div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{item.valid_readings} valid intervals · {item.source === 'simulation' ? 'synthetic simulation' : item.source === 'hardware' ? 'hardware telemetry' : item.source} · average recorded power {item.average_power_w?.toFixed(1) ?? '—'} W</p>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--text-secondary)]">{item.actions.map(action => <li key={action}>{action}</li>)}</ul>
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3">
                <label className="text-xs text-[var(--text-muted)]">Scenario: reduce this appliance's observed use by (%)
                  <input aria-label={`Scenario reduction percentage for ${item.appliance_name}`} type="number" min="0" max="100" step="1" value={targetReductionPercent || ''} placeholder="Set a target" onChange={event => setTargetReductionPercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 block w-32 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text-primary)]" />
                </label>
                {targetReductionPercent > 0 && <p className="text-xs text-[var(--text-secondary)]">Scenario energy reduction: <strong className="text-[var(--text-primary)]">{(item.energy_kwh * targetReductionPercent / 100).toFixed(5)} kWh</strong> = {item.energy_kwh.toFixed(5)} kWh observed × {targetReductionPercent}%. This applies only to the measured window; it is not a forecast or guaranteed saving.</p>}
              </div>
            </div>)}</div>
            <p className="text-xs leading-5 text-[var(--text-muted)]">No operating schedule is suggested because the configured tariff does not establish time-of-use rates. Bill savings are not attributed to one appliance: meter topology and usage hours are not established.</p>
          </> : recommendations.data && <p className="text-sm text-[var(--text-muted)]">No valid interval consumption is available for ranking yet.</p>}
          {recommendations.data && <div className="rounded-lg border border-[var(--line)] p-3 text-xs leading-5 text-[var(--text-muted)]"><strong className="text-[var(--text-secondary)]">Unusual-use check:</strong> {recommendations.data.unusual_usage_status}{recommendations.data.unusual_usage.map(item => <p key={item.appliance_id} className="mt-2 text-amber-200">{item.appliance_name}: {item.observed_kwh_per_hour.toFixed(4)} kWh/hour vs {item.baseline_kwh_per_hour.toFixed(4)} baseline median ({item.ratio.toFixed(1)}×, {item.baseline_days} complete days).</p>)}</div>}
        </div>
      </GlassPanel>

      <ChartContainer title="Consumption Over Time">
        {trendsLoading ? <LoadingState /> : trends.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]">No recorded energy data is available for this period.</div> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--line-strong)" tick={{ fill: 'var(--text-muted)' }} fontSize={12} tickMargin={10} />
              <YAxis stroke="var(--line-strong)" tick={{ fill: 'var(--text-muted)' }} fontSize={12} tickMargin={10} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--tooltip)', border: '1px solid var(--line)', borderRadius: '10px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-soft)' }}
                cursor={{ fill: 'var(--accent-soft)' }}
              />
              <Bar dataKey="energy" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Energy (kWh)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Appliance Comparison">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" stroke="var(--line-strong)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis dataKey="appliance_name" type="category" stroke="var(--line-strong)" tick={{ fill: 'var(--text-secondary)' }} width={100} fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--tooltip)', border: '1px solid var(--line)', borderRadius: '10px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-soft)' }}
                cursor={{ fill: 'var(--accent-soft)' }}
              />
              <Bar dataKey="energy" name="Energy (kWh)" radius={[0, 4, 4, 0]}>
                {breakdown.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={breakdownColors[index % breakdownColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <GlassPanel title="Current Month Billing Estimate" icon={<DollarSign />}>
          <label className="mb-4 flex items-center gap-2 text-xs text-slate-400">Tariff profile
            <select aria-label="Billing tariff profile" value={billProfile} onChange={event => setBillProfile(event.target.value as typeof billProfile)} className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-slate-200">
              <option value="kseb_lt1_sourced">KSERC LT-I sourced schedule</option>
              <option value="configured">Saved tariff settings</option>
            </select>
          </label>
          {billProfile === 'kseb_lt1_sourced' && <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Fuel adjustment ₹/unit', value: fuelRate, set: setFuelRate },
              { label: 'Meter rent ₹/month', value: meterRent, set: setMeterRent },
              { label: 'Green charge ₹/unit', value: greenRate, set: setGreenRate },
            ].map(field => <label key={field.label} className="text-xs text-slate-400">{field.label}<input type="number" min="0" step="0.01" value={field.value} onChange={event => field.set(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-slate-200" /></label>)}
          </div>}
          {bill ? <div className="space-y-3 text-sm text-slate-300">
            {bill.slabs_breakdown?.map((slab, index) => <div key={`${slab.range}-${index}`} className="flex justify-between border-b border-white/5 py-2"><span>{slab.range} units · {slab.units.toFixed(3)} × ₹{slab.rate.toFixed(2)}</span><span>₹{slab.charge.toFixed(2)}</span></div>)}
            {[['Consumption', `${bill.consumption.toFixed(3)} kWh`], ['Energy charge', bill.energy_charge], ['Fixed charge', bill.fixed_charge], ['Electricity duty', bill.electricity_duty], ['Fuel surcharge', bill.fuel_surcharge], ['Meter rent', bill.meter_rent], ['Green tariff', bill.green_tariff], ['Estimated total', bill.total]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b border-white/5 py-2"><span>{label}</span><span>{typeof value === 'number' ? `₹ ${value.toFixed(2)}` : value}</span></div>)}
            {bill.effective_period && <p className="text-xs text-slate-400">Schedule period: {bill.effective_period}. Phase: {bill.phase_type}.</p>}
            {bill.assumptions?.map(item => <p key={item} className="text-xs leading-5 text-amber-200/80">{item}</p>)}
            {bill.source && <a className="text-xs text-cyan-300 underline" href={bill.source} target="_blank" rel="noreferrer">KSERC Gazette tariff source</a>}
          </div> : <p className="p-4 text-slate-500">Billing data is unavailable until telemetry and tariff configuration are available.</p>}
          <p className="text-xs text-slate-500 mt-4">Estimate uses month-to-date valid interval readings. It is not an official electricity bill.</p>
        </GlassPanel>
      </div>
    </div>
  );
};

export default EnergyAnalyticsView;
