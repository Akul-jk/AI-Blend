import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { DataSource, TelemetryReading } from '../types';

type ReplayRow = TelemetryReading & { original_timestamp: string };
type ReplayState = 'idle' | 'running' | 'paused' | 'completed';

const datasetPath = path.resolve(__dirname, '../../../ml-service/datasets/simulation/canonical_simulation_telemetry.csv');
const allowedSpeeds = [0.25, 0.5, 1, 2, 5, 10];

export function readReplayDataset(): ReplayRow[] {
  const contents = fs.readFileSync(datasetPath, 'utf8').replace(/^\uFEFF/, '').trim();
  const [headerLine, ...lines] = contents.split(/\r?\n/);
  const headers = headerLine.split(',');
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const required = ['timestamp', 'pzem_id', 'appliance_id', 'voltage', 'current', 'power', 'energy', 'interval_energy_kwh', 'frequency', 'power_factor', 'quality'];
  if (required.some(name => column[name] === undefined)) throw new Error('Replay dataset does not match the canonical telemetry schema');
  return lines.map((line, index) => {
    const fields = line.split(',');
    const timestamp = fields[column.timestamp];
    const date = new Date(timestamp);
    if (!timestamp || !Number.isFinite(date.getTime())) throw new Error(`Invalid replay timestamp on dataset row ${index + 2}`);
    const number = (name: string) => {
      const value = Number(fields[column[name]]);
      if (!Number.isFinite(value)) throw new Error(`Invalid ${name} on dataset row ${index + 2}`);
      return value;
    };
    const quality = fields[column.quality] || 'valid';
    if (!['valid', 'baseline', 'counter_reset', 'energy_jump'].includes(quality)) {
      throw new Error(`Invalid quality on dataset row ${index + 2}`);
    }
    return {
      original_timestamp: date.toISOString(),
      timestamp: date.toISOString(),
      pzem_id: fields[column.pzem_id] || null,
      appliance_id: number('appliance_id'),
      voltage: number('voltage'),
      current: number('current'),
      power: number('power'),
      energy: number('energy'),
      interval_energy_kwh: fields[column.interval_energy_kwh] === '' ? null : number('interval_energy_kwh'),
      frequency: number('frequency'),
      power_factor: number('power_factor'),
      quality: quality as TelemetryReading['quality'],
      source: DataSource.REPLAY,
    };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || Number(a.appliance_id) - Number(b.appliance_id));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export class ReplayController {
  private readonly rows = readReplayDataset();
  private state: ReplayState = 'idle';
  private speed = 1;
  private cursor = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly io: Server) {}

  status() {
    const timestamps = this.rows.map(row => row.timestamp);
    const byAppliance = new Map<string, number[]>();
    for (const row of this.rows) {
      const id = String(row.appliance_id);
      const values = byAppliance.get(id) || [];
      values.push(new Date(row.timestamp).getTime());
      byAppliance.set(id, values);
    }
    const gaps = [...byAppliance.values()].flatMap(values => values.slice(1).map((value, index) => (value - values[index]) / 1000));
    return {
      state: this.state,
      speed: this.speed,
      cursor: this.cursor,
      row_count: this.rows.length,
      appliance_count: byAppliance.size,
      coverage_start: timestamps[0] || null,
      coverage_end: timestamps.at(-1) || null,
      median_interval_seconds: median(gaps),
      source: DataSource.REPLAY,
      persistent: false,
    };
  }

  setSpeed(speed: number) {
    if (!allowedSpeeds.includes(speed)) throw new Error(`speed must be one of ${allowedSpeeds.join(', ')}`);
    this.speed = speed;
    if (this.state === 'running') this.scheduleNext();
    return this.status();
  }

  start() {
    if (this.state === 'running') throw new Error('Replay is already running');
    if (this.state === 'completed') {
      this.cursor = 0;
      this.io.emit('telemetry:replay:reset', { source: DataSource.REPLAY });
    }
    this.state = 'running';
    this.tick();
    return this.status();
  }

  pause() {
    if (this.state !== 'running') throw new Error('Replay is not running');
    this.clearTimer();
    this.state = 'paused';
    return this.status();
  }

  resume() {
    if (this.state !== 'paused') throw new Error('Replay is not paused');
    this.state = 'running';
    this.tick();
    return this.status();
  }

  restart() {
    this.clearTimer();
    this.cursor = 0;
    this.io.emit('telemetry:replay:reset', { source: DataSource.REPLAY });
    this.state = 'running';
    this.tick();
    return this.status();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick() {
    if (this.state !== 'running') return;
    const row = this.rows[this.cursor];
    if (!row) {
      this.state = 'completed';
      this.clearTimer();
      return;
    }
    const batch: TelemetryReading[] = [];
    while (this.cursor < this.rows.length && this.rows[this.cursor].timestamp === row.timestamp) {
      batch.push({ ...this.rows[this.cursor], received_at: new Date().toISOString() });
      this.cursor += 1;
    }
    this.io.emit('telemetry:replay', batch);
    this.scheduleNext();
  }

  private scheduleNext() {
    this.clearTimer();
    if (this.state !== 'running') return;
    const row = this.rows[this.cursor - 1];
    const next = this.rows[this.cursor];
    if (!next) {
      this.state = 'completed';
      return;
    }
    const gapMs = Math.max(0, new Date(next.timestamp).getTime() - new Date(row.timestamp).getTime());
    this.timer = setTimeout(() => this.tick(), gapMs / this.speed);
  }
}
