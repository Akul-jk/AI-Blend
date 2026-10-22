import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, RotateCcw } from 'lucide-react';
import GlassPanel from './glass/GlassPanel';
import { useReplayStore } from '../stores/replayStore';
import type { ReplayStatus } from '../types';
import { fetchReplayStatus, pauseReplay, restartReplay, resumeReplay, setReplaySpeed, startReplay } from '../services/api';

const key = ['simulation', 'replay'];
const fmtDate = (value: string | null) => value ? new Date(value).toLocaleString() : 'Unavailable';

export default function ReplayControls() {
  const client = useQueryClient();
  const clearReplay = useReplayStore(state => state.clear);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await fetchReplayStatus()).data,
    refetchInterval: current => current.state.data?.state === 'running' ? 1000 : 15000,
    retry: 1,
  });

  const action = useMutation<ReplayStatus, Error, () => Promise<{ data: ReplayStatus }>>({
    mutationFn: async request => (await request()).data,
    onSuccess: result => client.setQueryData(key, result),
  });
  const speed = useMutation({
    mutationFn: async (value: number) => (await setReplaySpeed(value)).data,
    onSuccess: value => client.setQueryData(key, value),
  });
  const status = query.data;
  const busy = action.isPending || speed.isPending;
  const run = (request: () => Promise<{ data: ReplayStatus }>, reset = false) => {
    if (reset) clearReplay();
    action.mutate(request);
  };

  return <GlassPanel title="Synthetic dataset replay" icon={<Play size={17} />}>
    <div className="space-y-4">
      <p className="text-xs leading-5 text-[var(--text-muted)]">Read-only playback of the checked-in synthetic telemetry export. Rows are broadcast with their original dataset timestamps and are not written to SQLite or sent through hardware ingestion.</p>
      {query.isLoading ? <p role="status" className="text-sm text-[var(--text-muted)]">Loading replay dataset metadata…</p> : query.isError ? <p role="alert" className="text-sm text-rose-300">Replay metadata is unavailable. Check that the backend can read the repository dataset.</p> : status && <>
        <div className="grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
          <p>State: <strong className="text-[var(--text-primary)]">{status.state}</strong></p>
          <p>Progress: <strong className="text-[var(--text-primary)]">{status.cursor.toLocaleString()} / {status.row_count.toLocaleString()}</strong> rows</p>
          <p>Dataset coverage: {fmtDate(status.coverage_start)} – {fmtDate(status.coverage_end)}</p>
          <p>Appliances: {status.appliance_count} · median sample interval: {status.median_interval_seconds?.toFixed(2) ?? '—'} s</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {(status.state === 'idle' || status.state === 'completed') && <button type="button" disabled={busy} onClick={() => run(startReplay, status.state === 'completed')} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Play size={14} />Start</button>}
            {status.state === 'running' && <button type="button" disabled={busy} onClick={() => run(pauseReplay)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"><Pause size={14} />Pause</button>}
            {status.state === 'paused' && <button type="button" disabled={busy} onClick={() => run(resumeReplay)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Play size={14} />Resume</button>}
            <button type="button" disabled={busy} onClick={() => run(restartReplay, true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"><RotateCcw size={14} />Restart</button>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">Playback speed
            <select aria-label="Replay speed" disabled={busy} value={status.speed} onChange={event => speed.mutate(Number(event.target.value))} className="rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-2 text-[var(--text-primary)]">
              {[0.25, 0.5, 1, 2, 5, 10].map(value => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
        </div>
        {(action.isError || speed.isError) && <p role="alert" className="text-xs text-rose-300">{action.error?.message || speed.error?.message || 'Replay control failed.'}</p>}
      </>}
    </div>
  </GlassPanel>;
}
