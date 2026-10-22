import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Trash2, Clock, AlertCircle, RefreshCw, Search, Bell, Radio } from 'lucide-react';
import { useAlertStore } from '../../stores/alertStore';
import { fetchAlerts, resolveAlert as resolveAlertRequest, deleteAlert as deleteAlertRequest } from '../../services/api';
import { socketService } from '../../services/socket';
import { toast } from '../../components/ui/Toast';
import type { Alert } from '../../types';
import { useAuth } from '../../context/AuthContext';
import PhoneAlertSettings from './PhoneAlertSettings';

type StatusFilter = 'all' | 'active' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export const AlertsView: React.FC = () => {
  const { alerts, setAlerts, resolveAlert, deleteAlert, addAlert } = useAlertStore();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busyIds, setBusyIds] = useState<number[]>([]);

  const loadAlerts = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetchAlerts();
      setAlerts(response.data as Alert[]);
      setLoadError('');
    } catch {
      setLoadError('Could not load alerts. Check the connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setAlerts]);

  useEffect(() => {
    void loadAlerts();
    const onAlert = (alert: Alert) => addAlert(alert);
    const onUpdate = (event: { id: number; status: string }) => {
      if (event.status === 'resolved') resolveAlert(Number(event.id));
    };
    const offAlert = socketService.on('telemetry:alert', onAlert);
    const offUpdate = socketService.on('alert_update', onUpdate);
    return () => { offAlert(); offUpdate(); };
  }, [addAlert, loadAlerts, resolveAlert]);

  const withBusy = async (id: number, action: () => Promise<unknown>, success: string, update: () => void) => {
    setBusyIds(ids => [...ids, id]);
    try { await action(); update(); toast.success(success); }
    catch { toast.error('The alert could not be updated. Please retry.'); }
    finally { setBusyIds(ids => ids.filter(item => item !== id)); }
  };

  const filteredAlerts = useMemo(() => alerts.filter(alert => {
    if (statusFilter === 'active' && alert.resolved) return false;
    if (statusFilter === 'resolved' && !alert.resolved) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [alert.message, alert.type, alert.appliance_name, alert.sensor_id, alert.device_id].some(value => String(value || '').toLowerCase().includes(query));
  }), [alerts, search, severityFilter, statusFilter]);
  const activeCount = alerts.filter(alert => !alert.resolved).length;
  const criticalCount = alerts.filter(alert => !alert.resolved && alert.severity === 'critical').length;
  const syntheticCount = alerts.filter(alert => alert.source === 'simulation').length;

  return <div className="page-enter flex flex-col gap-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]"><AlertTriangle className="h-5 w-5 text-amber-400" />Alert Center</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Review meter conditions, resolve incidents, and keep the event history.</p>
      </div>
      <button type="button" onClick={() => void loadAlerts(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50" aria-label="Refresh alerts">
        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
      </button>
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Alert summary">
      <div className="glass-panel rounded-xl p-4"><p className="text-xs text-[var(--text-muted)]">Active alerts</p><p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{activeCount}</p></div>
      <div className="glass-panel rounded-xl p-4"><p className="text-xs text-[var(--text-muted)]">Critical alerts</p><p className="mt-1 text-2xl font-semibold text-rose-400">{criticalCount}</p></div>
      <div className="glass-panel rounded-xl p-4"><p className="text-xs text-[var(--text-muted)]">Synthetic readings</p><p className="mt-1 text-2xl font-semibold text-cyan-400">{syntheticCount}</p></div>
    </section>

    <PhoneAlertSettings />

    {syntheticCount > 0 && <div className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] px-4 py-3 text-xs text-cyan-100"><Radio size={15} className="mt-0.5 shrink-0" />Some alert events were generated from simulated telemetry. Hardware-origin events are labeled individually.</div>}
    {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-200"><span>{loadError}</span><button type="button" className="underline" onClick={() => void loadAlerts(true)}>Retry</button></div>}

    <section className="glass-panel rounded-2xl p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-1">
          {(['all', 'active', 'resolved'] as const).map(filter => <button key={filter} type="button" onClick={() => setStatusFilter(filter)} aria-pressed={statusFilter === filter} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${statusFilter === filter ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{filter}</button>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2"><Search size={14} className="text-[var(--text-muted)]" /><input aria-label="Search alerts" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search alerts…" className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none sm:w-48" /></label>
          <select aria-label="Filter by severity" value={severityFilter} onChange={event => setSeverityFilter(event.target.value as SeverityFilter)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"><option value="all">All severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option></select>
        </div>
      </div>

      {loading ? <div role="status" className="py-12 text-center text-sm text-[var(--text-muted)]">Loading alert history…</div> : filteredAlerts.length === 0 ? <div className="py-14 text-center"><Bell className="mx-auto mb-3 h-7 w-7 text-[var(--text-muted)]" /><p className="text-sm font-semibold text-[var(--text-primary)]">{alerts.length ? 'No alerts match these filters' : 'No alerts recorded'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Voltage, rated-load, and power-factor alerts appear here when readings cross their stated limits.</p></div> : <div className="relative ml-2 space-y-4 border-l border-[var(--line)] pl-5">
        {filteredAlerts.map(alert => <article key={alert.id} className="relative rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
          <span className={`absolute -left-[29px] top-5 flex h-6 w-6 items-center justify-center rounded-full border ${alert.resolved ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' : alert.severity === 'critical' ? 'border-rose-400/30 bg-rose-400/10 text-rose-400' : 'border-amber-400/30 bg-amber-400/10 text-amber-400'}`}>{alert.resolved ? <CheckCircle size={13} /> : <AlertCircle size={13} />}</span>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${alert.severity === 'critical' ? 'bg-rose-400/10 text-rose-300' : alert.severity === 'warning' ? 'bg-amber-400/10 text-amber-300' : 'bg-sky-400/10 text-sky-300'}`}>{alert.severity}</span><span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">{alert.type.replaceAll('_', ' ')}</span>{alert.resolved && <span className="text-[10px] text-emerald-400">Resolved</span>}</div>
              <p className="text-sm leading-6 text-[var(--text-primary)]">{alert.message}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]"><span className="inline-flex items-center gap-1"><Clock size={12} />{new Date(alert.timestamp).toLocaleString()}</span>{alert.appliance_name && <span>Appliance: {alert.appliance_name}</span>}{alert.sensor_id && <span>Meter: {alert.sensor_id}</span>}<span>{alert.source === 'hardware' ? 'Hardware telemetry' : alert.source === 'simulation' ? 'Synthetic simulation' : alert.source || 'Source not recorded'}</span></div>
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              {!alert.resolved && <button type="button" disabled={busyIds.includes(alert.id)} onClick={() => void withBusy(alert.id, () => resolveAlertRequest(alert.id), 'Alert resolved.', () => resolveAlert(alert.id))} className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-50">Resolve</button>}
              {user?.role === 'admin' && <button type="button" disabled={busyIds.includes(alert.id)} onClick={() => void withBusy(alert.id, () => deleteAlertRequest(alert.id), 'Alert deleted.', () => deleteAlert(alert.id))} className="rounded-lg border border-[var(--line)] p-2 text-[var(--text-muted)] hover:border-rose-400/30 hover:text-rose-300 disabled:opacity-50" title="Delete alert" aria-label={`Delete alert ${alert.id}`}><Trash2 size={15} /></button>}
            </div>
          </div>
        </article>)}
      </div>}
    </section>
  </div>;
};

export default AlertsView;
