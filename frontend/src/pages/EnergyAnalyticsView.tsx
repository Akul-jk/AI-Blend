import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsTrends, fetchAnalyticsBreakdown, fetchBillingUsage, fetchSettings, calculateBill } from '../services/api';
import SectionHeader from '../components/glass/SectionHeader';
import ChartContainer from '../components/glass/ChartContainer';
import GlassPanel from '../components/glass/GlassPanel';
import MetricCard from '../components/glass/MetricCard';
import LoadingState from '../components/glass/LoadingState';
import { BarChart2, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EnergyAnalyticsView: React.FC = () => {
  const [period, setPeriod] = useState('hourly');

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics', 'trends', period],
    queryFn: () => fetchAnalyticsTrends(period).then(res => res.data),
  });

  const { data: breakdown = [] } = useQuery({
    queryKey: ['analytics', 'breakdown'],
    queryFn: () => fetchAnalyticsBreakdown().then(res => res.data),
  });
  const billing = useQuery({ queryKey: ['billing-usage'], queryFn: async () => {
    const [usageResponse, settingsResponse] = await Promise.all([fetchBillingUsage(), fetchSettings()]);
    const billResponse = await calculateBill(usageResponse.data.consumption, { phase_type: settingsResponse.data.phase_type });
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

        <GlassPanel title="Current Month Billing" icon={<DollarSign />}>
          {bill ? <div className="space-y-3 text-sm text-slate-300">{[['Consumption', `${bill.consumption.toFixed(3)} kWh`], ['Energy charge', bill.energy_charge], ['Fuel surcharge', bill.fuel_surcharge], ['Fixed charge', bill.fixed_charge], ['Meter rent', bill.meter_rent], ['Electricity duty', bill.electricity_duty], ['Green tariff', bill.green_tariff], ['Total', bill.total]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-b border-white/5 py-2"><span>{label}</span><span>{typeof value === 'number' ? `${bill.currency} ${value.toFixed(2)}` : value}</span></div>)}</div> : <p className="p-4 text-slate-500">Billing data is unavailable until telemetry and tariff configuration are available.</p>}
          <p className="text-xs text-slate-500 mt-4">Calculated using month-to-date valid interval readings and the configured tariff.</p>
        </GlassPanel>
      </div>
    </div>
  );
};

export default EnergyAnalyticsView;
