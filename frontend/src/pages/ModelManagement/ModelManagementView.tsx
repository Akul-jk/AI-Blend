import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, Check, CheckCircle2, ChevronRight, Clock3, CloudUpload,
  Cpu, Database, FileCheck2, History, LoaderCircle, LockKeyhole, RotateCcw,
  ShieldCheck, Trash2, TriangleAlert, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  activateManagedModel, deleteManagedModel, fetchManagedModel, fetchManagedModels,
  fetchModelHistory, rollbackManagedModel,
  stageModelPackage, validateModelPackage,
} from '../../services/api';
import type { ManagedModel, ModelValidationReport } from '../../services/api';
import { cn } from '../../components/glass/GlassCard';
import { apiErrorMessage, apiErrorStatus } from '../../utils/apiError';

const panel = 'rounded-[18px] border border-[var(--line)] bg-[var(--surface-glass)] shadow-[var(--shadow-soft)]';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const EMPTY_MODELS: ManagedModel[] = [];
const errorMessage = (error: unknown) => apiErrorMessage(error, 'The request could not be completed.');

const statusStyles: Record<string, string> = {
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  validated: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  staged: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  inactive: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

function ModelStatus({ status }: { status: string }) {
  const label = status === 'validated' ? 'Staged' : status;
  const Icon = status === 'active' ? CheckCircle2 : status === 'rejected' ? TriangleAlert : status === 'validated' ? FileCheck2 : Clock3;
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', statusStyles[status] || statusStyles.inactive)}><Icon size={13} />{label}</span>;
}

function Metric({ label, value, suffix = '' }: { label: string; value: unknown; suffix?: string }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  return <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-1 font-mono text-sm text-slate-200">{numeric ? `${Number(value).toFixed(label === 'Samples' ? 0 : 4)}${suffix}` : 'Not recorded'}</p></div>;
}

const ModelManagementView: React.FC = () => {
  const { user } = useAuth();
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [validation, setValidation] = useState<ModelValidationReport | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [operationError, setOperationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ kind: 'activate' | 'rollback' | 'delete'; version?: string } | null>(null);

  const modelsQuery = useQuery({ queryKey: ['managedModels'], queryFn: async () => (await fetchManagedModels()).data, retry: false });
  const historyQuery = useQuery({ queryKey: ['modelHistory'], queryFn: async () => (await fetchModelHistory()).data, retry: false });
  const detailQuery = useQuery({
    queryKey: ['managedModel', selectedVersion],
    queryFn: async () => (await fetchManagedModel(selectedVersion!)).data,
    enabled: !!selectedVersion && !selectedVersion.startsWith('rejected-'), retry: false,
  });
  const models = modelsQuery.data?.models || EMPTY_MODELS;
  const active = models.find(model => model.version === modelsQuery.data?.active_version || model.active);
  const rejected = models.filter(model => model.status === 'rejected');
  const selected = detailQuery.data;

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['managedModels'] });
    void client.invalidateQueries({ queryKey: ['modelHistory'] });
    void client.invalidateQueries({ queryKey: ['managedModel'] });
  };
  const validate = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a ZIP package first.');
      setUploadProgress(0); setOperationError('');
      return validateModelPackage(file, setUploadProgress).then(response => response.data);
    },
    onSuccess: report => { setValidation(report); setSuccessMessage(report.status === 'validated' ? 'Package validation passed. Review the contract report, then stage this version.' : 'Package was rejected. Its reason is recorded in registry history.'); refresh(); },
    onError: error => { setOperationError(errorMessage(error)); setValidation(null); },
  });
  const stage = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a ZIP package first.');
      setUploadProgress(0); setOperationError('');
      return stageModelPackage(file, setUploadProgress).then(response => response.data);
    },
    onSuccess: result => {
      setValidation(result); setSuccessMessage(result.status === 'validated' ? 'Model version staged and ready for review.' : 'Package was rejected and recorded; the active model was not changed.'); refresh();
      if (result.status === 'validated' && result.version) setSelectedVersion(result.version);
    },
    onError: error => { setOperationError(errorMessage(error)); refresh(); },
  });
  const activate = useMutation({
    mutationFn: (version: string) => activateManagedModel(version),
    onSuccess: () => { setOperationError(''); setSuccessMessage('Model activation completed.'); setConfirmAction(null); refresh(); },
    onError: error => { setOperationError(errorMessage(error)); setConfirmAction(null); refresh(); },
  });
  const rollback = useMutation({
    mutationFn: (version?: string) => rollbackManagedModel(version),
    onSuccess: () => { setOperationError(''); setSuccessMessage('Rollback completed.'); setConfirmAction(null); refresh(); },
    onError: error => { setOperationError(errorMessage(error)); setConfirmAction(null); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (version: string) => deleteManagedModel(version),
    onSuccess: () => { setSuccessMessage('Inactive model version deleted.'); setConfirmAction(null); setSelectedVersion(null); refresh(); },
    onError: error => { setOperationError(errorMessage(error)); setConfirmAction(null); },
  });

  const comparisons = useMemo(() => models.filter(item => item.metrics && Object.values(item.metrics).some(v => typeof v === 'number')), [models]);
  const busy = validate.isPending || stage.isPending || activate.isPending || rollback.isPending || remove.isPending;
  const unauthorized = apiErrorStatus(modelsQuery.error) === 403;

  if (user?.role !== 'admin') {
    return <div className={`${panel} mx-auto max-w-2xl p-8 text-center`}><LockKeyhole className="mx-auto mb-4 text-amber-300" size={32} /><h1 className="text-xl font-bold text-white">Administrator access required</h1><p className="mt-2 text-sm text-slate-400">Model packages and activation controls are restricted to administrators.</p></div>;
  }

  if (unauthorized) {
    return <div className={`${panel} mx-auto max-w-2xl p-8 text-center`}><LockKeyhole className="mx-auto mb-4 text-amber-300" size={32} /><h1 className="text-xl font-bold text-white">Access denied</h1><p className="mt-2 text-sm text-slate-400">Your account is not authorized to manage models.</p></div>;
  }

  return <div className="space-y-6 pb-8">
    <header className="energy-hero relative overflow-hidden rounded-[24px] border border-cyan-300/10 p-6 text-white md:p-8">
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"><ShieldCheck size={14} /> Central model registry</div><h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Model Management</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Validate versioned forecasting packages, inspect their contract, then activate or roll back through the protected ML service.</p></div>
        <div className="flex gap-2 text-xs text-slate-400"><span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Sequence 60 × 19</span><span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">Cadence 5000 ms</span></div>
      </div>
    </header>

    {operationError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{operationError}</span><button className="ml-auto text-xs underline" onClick={() => setOperationError('')}>Dismiss</button></div>}

    <section className="grid gap-4 md:grid-cols-3">
      <div className={`${panel} p-5 md:col-span-2`}>
        <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active model</p><h2 className="mt-1 text-lg font-semibold text-white">{modelsQuery.isLoading ? 'Loading registry…' : active?.model_id || 'No active model found'}</h2></div><ModelStatus status="active" /></div>
        {modelsQuery.isError ? <p role="alert" className="text-sm text-rose-300">{modelsQuery.error instanceof Error ? modelsQuery.error.message : 'Model registry is unavailable.'}</p> : active ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Version" value={active.model_version || active.version} /><Metric label="Sequence" value={active.sequence_length || 60} suffix=" steps" /><Metric label="Features" value={active.feature_count || 19} /><Metric label="Cadence" value={active.sampling_interval_ms ?? 5000} suffix=" ms" /></div> : <p className="text-sm text-slate-500">The registry has not reported an active model.</p>}
        {active?.metrics && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="MAE" value={active.metrics.mae} /><Metric label="RMSE" value={active.metrics.rmse} /><Metric label="R²" value={active.metrics.r2} /><Metric label="Samples" value={active.metrics.test_samples} /></div>}
      </div>
      <div className={`${panel} grid grid-cols-2 gap-3 p-5`}><div className="col-span-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Registry snapshot</div><div className="rounded-xl bg-slate-950/45 p-3"><div className="text-2xl font-bold text-cyan-200">{models.length - rejected.length}</div><div className="mt-1 text-xs text-slate-500">Stored versions</div></div><div className="rounded-xl bg-slate-950/45 p-3"><div className="text-2xl font-bold text-rose-200">{rejected.length}</div><div className="mt-1 text-xs text-slate-500">Rejected packages</div></div></div>
    </section>

    <section className={`${panel} p-5 md:p-6`}>
      <div className="mb-5 flex items-start gap-3"><div className="rounded-xl bg-indigo-400/10 p-2.5 text-indigo-200"><CloudUpload size={20} /></div><div><h2 className="font-semibold text-white">Upload and validate package</h2><p className="mt-1 text-xs leading-5 text-slate-500">Flat ZIP package · 128 MiB maximum · strict preprocessing and sampling contract required.</p></div></div>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600/70 bg-slate-950/30 px-4 py-5 text-center transition hover:border-cyan-400/50 hover:bg-cyan-400/[0.03]">
        <input type="file" accept=".zip,application/zip" className="sr-only" onChange={event => { setFile(event.target.files?.[0] || null); setValidation(null); setOperationError(''); }} />
        <Database size={21} className="mb-2 text-cyan-300" /><span className="text-sm font-semibold text-slate-200">{file?.name || 'Choose a model package ZIP'}</span><span className="mt-1 text-xs text-slate-500">The package is sent to the authenticated backend for isolated validation</span>
      </label>
      {file && <div className="mt-4 flex flex-wrap items-center gap-3"><button className={`${button} bg-cyan-400 text-slate-950 hover:bg-cyan-300`} disabled={busy || file.size > 128 * 1024 * 1024} onClick={() => { setSuccessMessage(''); validate.mutate(); }}>{validate.isPending ? <><LoaderCircle className="animate-spin" size={16} />Validating package…</> : <><FileCheck2 size={16} />Validate package</>}</button>{validation?.status === 'validated' && <button className={`${button} border border-indigo-300/20 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20`} disabled={busy || file.size > 128 * 1024 * 1024} onClick={() => { setSuccessMessage(''); stage.mutate(); }}>{stage.isPending ? <><LoaderCircle className="animate-spin" size={16} />Staging version…</> : <><Zap size={16} />Stage validated model</>}</button>}<span className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MiB · 128 MiB max</span></div>}
      {(validate.isPending || stage.isPending) && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{uploadProgress >= 100 ? 'Upload complete · isolated model checks running' : stage.isPending ? 'Uploading package for isolated staging' : 'Uploading for isolated validation'}</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-all" style={{ width: `${uploadProgress}%` }} /></div></div>}
      {validation && <div className={cn('mt-5 rounded-xl border p-4', validation.status === 'validated' ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-rose-400/20 bg-rose-400/[0.06]')}>
        <div className="flex items-center gap-2 font-semibold text-slate-100">{validation.status === 'validated' ? <CheckCircle2 className="text-emerald-300" size={18} /> : <TriangleAlert className="text-rose-300" size={18} />}{validation.status === 'validated' ? 'Validation passed' : 'Package rejected'}</div>
        {validation.status === 'validated' ? <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4"><span>Input: {validation.probe?.input_shape?.join(' × ') || validation.contract?.feature_count + ' ordered features'}</span><span>Output: {validation.probe?.output_shape?.join(' × ') || 'single target'}</span><span>Runtime: {validation.runtime?.tensorflow || 'TensorFlow'} / {validation.runtime?.keras || 'Keras'}</span><span>Sampling: {validation.contract?.sampling_interval_ms} ms</span></div> : <p role="alert" className="mt-2 text-sm text-rose-200">{validation.reason || validation.report?.reason || 'The package did not satisfy the model contract.'}</p>}
        {validation.status === 'validated' && validation.checks && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(validation.checks).map(([name, status]) => <span key={name} className="inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] text-emerald-200"><Check size={12} />{name.replace(/_/g, ' ')}: {status}</span>)}</div>}
      </div>}
    </section>

    {successMessage && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100"><CheckCircle2 size={17} />{successMessage}<button className="ml-auto text-xs underline" onClick={() => setSuccessMessage('')}>Dismiss</button></div>}

    <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <div className={`${panel} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="font-semibold text-white">Model versions</h2><p className="mt-1 text-xs text-slate-500">Active, staged, inactive and rejected entries from the registry.</p></div><button className={`${button} border border-white/10 bg-white/[0.04] px-3 text-slate-300`} onClick={refresh} disabled={modelsQuery.isFetching}><RotateCcw className={cn(modelsQuery.isFetching && 'animate-spin')} size={15} />Refresh</button></div>
        {modelsQuery.isLoading ? <div className="p-8 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Loading model registry…</div> : modelsQuery.isError ? <div role="alert" className="p-6 text-sm text-rose-300">The model registry could not be loaded. Confirm the ML service and management token are configured.</div> : models.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No managed versions or validation reports are available.</div> : <div className="divide-y divide-white/[0.05]">{models.map(model => {
          const version = model.version || model.id || '';
          const isActive = version === modelsQuery.data?.active_version || model.active;
          const rowStatus = isActive ? 'active' : model.status === 'validated' && !(model.activation_history?.length) ? 'validated' : model.status;
          return <div key={version} className={cn('flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.025] sm:flex-row sm:items-center', selectedVersion === version && 'bg-cyan-400/[0.04]')}>
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelectedVersion(version)}><span className="rounded-xl bg-slate-800 p-2.5 text-cyan-200">{model.status === 'rejected' ? <TriangleAlert size={17} /> : <Cpu size={17} />}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{model.model_id || model.model_version || 'Rejected upload'}</span><span className="mt-1 block truncate text-xs text-slate-500">{model.model_version || model.package_sha256?.slice(0, 16) || version}</span></span></button>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end"><ModelStatus status={rowStatus || 'inactive'} /><span className="hidden text-xs text-slate-500 md:inline">{model.framework_version ? `TF ${model.framework_version}` : model.source || ''}</span><button aria-label="View model details" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => setSelectedVersion(version)}><ChevronRight size={16} /></button></div>
          </div>;
        })}</div>}
      </div>

      <div className={`${panel} p-5`}>
        <div className="mb-4 flex items-center gap-2"><Activity className="text-cyan-300" size={18} /><h2 className="font-semibold text-white">Selected model</h2></div>
        {!selectedVersion ? <p className="py-8 text-center text-sm text-slate-500">Select a model version to inspect its contract and report.</p> : selectedVersion.startsWith('rejected-') ? <div className="space-y-3"><ModelStatus status="rejected" /><p className="break-all font-mono text-xs text-slate-400">{selectedVersion}</p><p className="text-sm text-rose-200">{models.find(m => (m.id || m.version) === selectedVersion)?.reason || 'Package validation failed.'}</p></div> : detailQuery.isLoading ? <p className="py-8 text-center text-sm text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Loading details…</p> : detailQuery.isError ? <p role="alert" className="text-sm text-rose-300">Could not load model details.</p> : selected ? <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-lg font-semibold text-white">{selected.model_id}</p><p className="font-mono text-xs text-slate-500">{selected.model_version}</p></div><ModelStatus status={selected.active ? 'active' : selected.status} /></div>
          <div className="grid grid-cols-2 gap-2"><Metric label="Input steps" value={selected.sequence_length} /><Metric label="Feature count" value={selected.feature_count} /><Metric label="Sampling" value={selected.sampling_interval_ms} suffix=" ms" /><Metric label="Output" value={selected.target_unit ? `${selected.target_column} (${selected.target_unit})` : selected.target_column} /></div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-slate-500">Declared framework</dt><dd className="text-right text-slate-300">{selected.framework || 'Not recorded'} {selected.tensorflow_version ? `· ${selected.tensorflow_version}` : ''}</dd><dt className="text-slate-500">Declared dataset provenance</dt><dd className="text-right text-slate-300">{selected.dataset_provenance || 'Not recorded'}</dd><dt className="text-slate-500">Created</dt><dd className="text-right text-slate-300">{selected.created_at_utc ? new Date(selected.created_at_utc).toLocaleString() : 'Not recorded'}</dd></dl>
          {selected.feature_columns && <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Ordered input features</p><div className="flex flex-wrap gap-1.5">{selected.feature_columns.map((feature, index) => <span key={feature} className="rounded-md border border-white/[0.06] bg-slate-950/50 px-2 py-1 text-[10px] text-slate-400"><b className="mr-1 text-slate-600">{index + 1}</b>{feature}</span>)}</div></div>}
          {selected.validation_report && <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-100"><FileCheck2 size={14} />Staging validation report</div><div className="space-y-1 text-[11px] text-slate-400">{Object.entries(selected.validation_report.checks || {}).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span>{key.replace(/_/g, ' ')}</span><span className="text-emerald-300">{String(value)}</span></div>)}<div className="flex justify-between gap-3"><span>Probe output</span><span className="font-mono">{selected.validation_report.probe?.output_shape?.join(' × ') || 'Not available'}</span></div></div></div>}
          {selected.metrics && <div className="grid grid-cols-2 gap-2"><Metric label="MAE" value={selected.metrics.mae} /><Metric label="RMSE" value={selected.metrics.rmse} /><Metric label="R²" value={selected.metrics.r2} /><Metric label="Samples" value={selected.metrics.test_samples} /></div>}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">{!selected.active && ['staged', 'validated'].includes(selected.status) && <button className={`${button} bg-emerald-400 text-slate-950 hover:bg-emerald-300`} onClick={() => setConfirmAction({ kind: 'activate', version: selected.version })}><Zap size={15} />Activate</button>}{selected.active && historyQuery.data?.rollback_version ? <button className={`${button} border border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20`} onClick={() => setConfirmAction({ kind: 'rollback' })}><History size={15} />Rollback</button> : null}{!selected.active && selected.source === 'package' && <button className={`${button} border border-rose-300/15 bg-rose-400/[0.06] text-rose-200 hover:bg-rose-400/15`} onClick={() => setConfirmAction({ kind: 'delete', version: selected.version })}><Trash2 size={15} />Delete</button>}</div>
        </div> : null}
      </div>
    </section>

    <section className={`${panel} overflow-hidden`}><div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4"><History size={17} className="text-indigo-200" /><div><h2 className="font-semibold text-white">Activation history</h2><p className="mt-1 text-xs text-slate-500">Registry changes in chronological order.</p></div></div>{historyQuery.isLoading ? <p className="p-5 text-sm text-slate-500">Loading activation history…</p> : historyQuery.data?.activation_history?.length ? <div className="divide-y divide-white/[0.05]">{[...historyQuery.data.activation_history].reverse().map((entry, index) => <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-xs" key={`${entry.from}-${entry.to}-${index}`}><span className="font-mono text-slate-400">{entry.from}</span><ChevronRight size={14} className="text-cyan-300" /><span className="font-mono text-cyan-100">{entry.to}</span><span className="ml-auto text-slate-500">{entry.created_at_utc ? new Date(entry.created_at_utc).toLocaleString() : 'Timestamp unavailable'}</span></div>)}</div> : <div className="flex items-center gap-3 p-5 text-sm text-slate-500"><Clock3 size={17} />No model activations have been recorded yet.</div>}</section>

    <section className={`${panel} overflow-hidden`}><div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4"><History size={17} className="text-indigo-200" /><div><h2 className="font-semibold text-white">Evaluation comparison</h2><p className="mt-1 text-xs text-slate-500">Only registry-stored evaluation results are shown; package-supplied metrics are ignored.</p></div></div>{comparisons.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Version</th>{['mae', 'rmse', 'r2', 'wape', 'test_samples'].map(metric => <th className="px-4 py-3" key={metric}>{metric.replace('_', ' ')}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.05]">{comparisons.map(model => <tr key={model.version}><td className="px-5 py-3 font-medium text-slate-200">{model.model_version || model.version}{model.active ? ' · Active' : ''}</td>{['mae', 'rmse', 'r2', 'wape', 'test_samples'].map(metric => <td className="px-4 py-3 font-mono text-slate-400" key={metric}>{typeof model.metrics?.[metric] === 'number' ? Number(model.metrics[metric]).toFixed(metric === 'test_samples' ? 0 : 5) : '—'}</td>)}</tr>)}</tbody></table></div> : <div className="flex items-center gap-3 p-5 text-sm text-slate-500"><Clock3 size={17} />No stored evaluation results are available for comparison.</div>}</section>

    {confirmAction && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="confirm-model-title" className={`${panel} w-full max-w-md p-6`}><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-amber-300/10 p-2.5 text-amber-200"><AlertTriangle size={20} /></div><div><h2 id="confirm-model-title" className="font-semibold text-white">Confirm model {confirmAction.kind}</h2><p className="text-xs text-slate-500">This administrator action will update the model registry.</p></div></div><p className="text-sm leading-6 text-slate-300">{confirmAction.kind === 'activate' ? `Activate version ${confirmAction.version}? Forecasts will use this version after activation succeeds.` : confirmAction.kind === 'rollback' ? 'Restore the version that was active before the latest activation?' : `Delete inactive version ${confirmAction.version}? This cannot be undone.`}</p><div className="mt-6 flex justify-end gap-2"><button className={`${button} border border-white/10 text-slate-300`} disabled={busy} onClick={() => setConfirmAction(null)}>Cancel</button><button className={`${button} ${confirmAction.kind === 'delete' ? 'bg-rose-400 text-slate-950' : 'bg-cyan-300 text-slate-950'}`} disabled={busy} onClick={() => { if (confirmAction.kind === 'activate' && confirmAction.version) activate.mutate(confirmAction.version); else if (confirmAction.kind === 'rollback') rollback.mutate(undefined); else if (confirmAction.kind === 'delete' && confirmAction.version) remove.mutate(confirmAction.version); }}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}{busy ? 'Working…' : `Confirm ${confirmAction.kind}`}</button></div></div></div>}
  </div>;
};

export default ModelManagementView;
