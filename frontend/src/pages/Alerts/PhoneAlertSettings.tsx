import React, { useEffect, useState } from 'react';
import { BellRing, Phone, Save } from 'lucide-react';
import { fetchPhoneAlertPreferences, savePhoneAlertPreferences, type PhoneAlertPreferences } from '../../services/api';

const empty: PhoneAlertPreferences = { phone_number: '', sms_alerts_enabled: false, sms_configured: false, sms_scope: 'hardware alerts only' };

const PhoneAlertSettings: React.FC = () => {
  const [settings, setSettings] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchPhoneAlertPreferences().then(({ data }) => setSettings({ ...empty, ...data }))
      .catch(() => setStatus('Phone alert settings could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const { data } = await savePhoneAlertPreferences({ phone_number: settings.phone_number.trim(), sms_alerts_enabled: settings.sms_alerts_enabled });
      setSettings({ ...empty, ...data });
      setStatus('Phone alert settings saved.');
    } catch (error: any) {
      setStatus(error?.response?.data?.message || 'Settings could not be saved.');
    } finally { setSaving(false); }
  };

  return <section className="glass-panel space-y-4 rounded-xl p-4" aria-labelledby="phone-alert-title">
    <div className="flex items-start gap-3">
      <span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><BellRing size={18} /></span>
      <div><h3 id="phone-alert-title" className="text-sm font-semibold text-[var(--text-primary)]">Phone alerts</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Opt in to receive hardware meter alerts by SMS. Simulated and replay alerts stay in the app.</p></div>
    </div>
    {loading ? <p role="status" className="text-xs text-[var(--text-muted)]">Loading phone alert settings…</p> : <form onSubmit={save} className="space-y-4">
      <label className="block max-w-md text-xs font-medium text-[var(--text-secondary)]">Indian mobile number (+91)
        <span className="relative mt-1 block"><Phone size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" /><input type="tel" autoComplete="tel" inputMode="tel" placeholder="+919876543210" pattern="\+91[6-9][0-9]{9}" value={settings.phone_number} onChange={event => setSettings(current => ({ ...current, phone_number: event.target.value }))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-400" /></span>
      </label>
      <label className={`flex max-w-3xl items-start gap-2 text-xs leading-5 ${settings.sms_configured ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
        <input type="checkbox" className="mt-1 accent-cyan-400" checked={settings.sms_alerts_enabled} disabled={!settings.sms_configured && !settings.sms_alerts_enabled} onChange={event => setSettings(current => ({ ...current, sms_alerts_enabled: event.target.checked }))} />
        <span>Send details from critical and warning hardware alerts to this number through the configured SMS provider. This sends meter alert information outside the app.</span>
      </label>
      {!settings.sms_configured && <p className="text-xs text-amber-200">India SMS is not configured yet. An administrator must configure Twilio with an approved DLT sender ID, entity ID, and message template before delivery can be enabled.</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save phone settings'}</button>{status && <p role="status" className="text-xs text-[var(--text-muted)]">{status}</p>}</div>
    </form>}
  </section>;
};

export default PhoneAlertSettings;
