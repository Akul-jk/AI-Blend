import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Settings, SlidersHorizontal, Save } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [tariffRate, setTariffRate] = useState('6.50');
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setCurrency(response.data.currency || 'INR');
      setTimezone(response.data.timezone || 'Asia/Kolkata');
      setTariffRate(response.data.tariffRate ? response.data.tariffRate.toString() : '6.50');
    } catch (err) {
      console.warn('Could not query settings, falling back to defaults.');
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', {
        currency,
        timezone,
        tariffRate: parseFloat(tariffRate) || 6.50
      });
      toast.success('System preferences saved successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update system settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            Global Platform Settings
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Configure system currencies, local timezones, and audit tariffs</p>
        </div>
      </section>

      {/* Configurations Card */}
      <div className="glass-panel rounded-2xl p-6 w-full max-w-2xl">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-6 flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          Tuning Parameters
        </span>

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Billing Currency Symbol</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Local Timezone</label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC / GMT</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Tariff Rate (Currency / Unit kWh)</label>
            <input
              type="number"
              step={0.01}
              value={tariffRate}
              onChange={e => setTariffRate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wide h-fit w-fit"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving preferences...' : 'Save Settings'}
          </button>
        </form>
      </div>

    </div>
  );
};
export default SettingsView;
