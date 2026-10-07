import { Server } from 'socket.io';
import { getDb } from '../db';
import { DataSource, TelemetryReading } from '../types';

export class TelemetryValidationError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

let telemetrySocket: Server | undefined;
export function setTelemetryBroadcaster(io: Server) { telemetrySocket = io; }

const finiteRange = (value: unknown, min: number, max: number, field: string): number => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new TelemetryValidationError(`${field} must be between ${min} and ${max}`);
  return number;
};

/** Single persistence path for simulator and authenticated hardware ingestion. */
export async function acceptTelemetry(input: TelemetryReading, io?: Server) {
  const db = getDb();
  if (typeof input.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(input.timestamp)) throw new TelemetryValidationError('timestamp must be an ISO 8601 date with timezone');
  const timestamp = new Date(input.timestamp);
  if (!Number.isFinite(timestamp.getTime())) throw new TelemetryValidationError('timestamp must be a valid ISO date');
  const age = Date.now() - timestamp.getTime();
  if (age > 5 * 60_000 || age < -60_000) throw new TelemetryValidationError('timestamp is stale or too far in the future');
  if (input.appliance_id == null && !input.pzem_id) throw new TelemetryValidationError('appliance_id or pzem_id is required');
  if (input.device_id && !await db.get('SELECT id FROM esp32_devices WHERE id = ?', [input.device_id])) throw new TelemetryValidationError('unknown device_id', 404);
  if (input.pzem_id && !await db.get('SELECT id FROM pzem_devices WHERE id = ?', [input.pzem_id])) throw new TelemetryValidationError('unknown pzem_id', 404);
  if (input.appliance_id != null && !await db.get('SELECT id FROM appliances WHERE id = ?', [input.appliance_id])) throw new TelemetryValidationError('unknown appliance_id', 404);
  if (input.circuit_id != null && !await db.get('SELECT id FROM circuits WHERE id = ?', [input.circuit_id])) throw new TelemetryValidationError('unknown circuit_id', 404);
  if (input.device_id != null && typeof input.device_id !== 'string') throw new TelemetryValidationError('device_id must be a string');
  if (input.pzem_id != null && typeof input.pzem_id !== 'string') throw new TelemetryValidationError('pzem_id must be a string');
  if (input.appliance_id != null && (!Number.isInteger(Number(input.appliance_id)) || Number(input.appliance_id) < 1)) throw new TelemetryValidationError('appliance_id must be a positive integer');
  if (input.circuit_id != null && (!Number.isInteger(Number(input.circuit_id)) || Number(input.circuit_id) < 1)) throw new TelemetryValidationError('circuit_id must be a positive integer');
  if (input.source === DataSource.HARDWARE && (!input.device_id || !input.pzem_id)) throw new TelemetryValidationError('hardware telemetry requires device_id and pzem_id');
  if (input.device_id && input.pzem_id) {
    const meter = await db.get('SELECT esp32_device_id FROM pzem_devices WHERE id = ?', [input.pzem_id]);
    if (meter && meter.esp32_device_id && meter.esp32_device_id !== input.device_id) throw new TelemetryValidationError('pzem_id is not assigned to device_id', 409);
  }
  if (input.circuit_id && input.pzem_id) {
    const circuit = await db.get('SELECT pzem_id FROM circuits WHERE id = ?', [input.circuit_id]);
    if (circuit?.pzem_id && circuit.pzem_id !== input.pzem_id) throw new TelemetryValidationError('pzem_id does not match circuit assignment', 409);
  }
  if (input.appliance_id != null && input.pzem_id) {
    const assignment = await db.get(`SELECT id FROM appliance_measurement_assignments WHERE appliance_id = ? AND pzem_id = ?
      AND julianday(valid_from) <= julianday(?) AND (valid_to IS NULL OR julianday(valid_to) >= julianday(?)) LIMIT 1`,
    [input.appliance_id, input.pzem_id, timestamp.toISOString(), timestamp.toISOString()]);
    if (!assignment) throw new TelemetryValidationError('appliance_id and pzem_id have no effective assignment at this timestamp', 409);
  }
  const voltage = finiteRange(input.voltage, 0.1, 300, 'voltage');
  const current = finiteRange(input.current, 0, 250, 'current');
  const power = finiteRange(input.power, 0, 50_000, 'power');
  const energy = finiteRange(input.energy, 0, 1e12, 'energy');
  const frequency = finiteRange(input.frequency, 45, 65, 'frequency');
  const power_factor = finiteRange(input.power_factor, 0, 1, 'power_factor');
  if (![DataSource.HARDWARE, DataSource.SIMULATION].includes(input.source)) throw new TelemetryValidationError('source is invalid');
  if (Math.abs(power - voltage * current * power_factor) > Math.max(20, power * 0.5)) throw new TelemetryValidationError('power is inconsistent with voltage, current and power factor');
  let interval: number | null = null;
  let quality: TelemetryReading['quality'] = 'baseline';
  const received_at = new Date().toISOString();
  let reading: TelemetryReading & { id: number; received_at: string; interval_energy_kwh: number | null; quality: NonNullable<TelemetryReading['quality']> };
  await db.exec('BEGIN IMMEDIATE');
  try {
    const duplicate = input.pzem_id
      ? await db.get('SELECT id FROM telemetry WHERE pzem_id = ? AND timestamp = ?', [input.pzem_id, timestamp.toISOString()])
      : await db.get('SELECT id FROM telemetry WHERE appliance_id = ? AND timestamp = ?', [input.appliance_id, timestamp.toISOString()]);
    if (duplicate) throw new TelemetryValidationError('duplicate meter timestamp', 409);

    const series = input.pzem_id ? 'pzem_id' : 'appliance_id';
    const seriesId = input.pzem_id || input.appliance_id;
    const previous = await db.get(`SELECT energy, timestamp FROM telemetry WHERE ${series} = ? ORDER BY timestamp DESC, id DESC LIMIT 1`, [seriesId]);
    if (previous) {
      const elapsedHours = (timestamp.getTime() - new Date(previous.timestamp).getTime()) / 3_600_000;
      if (energy < previous.energy) quality = 'counter_reset';
      else if (elapsedHours > 0) {
        const delta = energy - previous.energy;
        const maxPlausibleKwh = (Math.max(power, 1) * elapsedHours / 1000) * 3 + 0.02;
        if (delta > maxPlausibleKwh) quality = 'energy_jump';
        else { interval = delta; quality = 'valid'; }
      }
    }
    const result = await db.run(`INSERT INTO telemetry
      (timestamp, pzem_id, appliance_id, voltage, current, power, energy, frequency, power_factor, source, interval_energy_kwh, quality, device_id, circuit_id, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [timestamp.toISOString(), input.pzem_id, input.appliance_id, voltage, current, power, energy, frequency, power_factor, input.source, interval, quality, input.device_id || null, input.circuit_id ?? null, received_at]);
    if (input.pzem_id) await db.run("UPDATE pzem_devices SET last_seen = ?, status = 'online' WHERE id = ?", [received_at, input.pzem_id]);
    if (input.device_id) await db.run("UPDATE esp32_devices SET last_seen = ?, status = 'online' WHERE id = ?", [received_at, input.device_id]);
    await db.exec('COMMIT');
    reading = { ...input, id: result.lastID!, timestamp: timestamp.toISOString(), received_at, voltage, current, power, energy, frequency, power_factor, interval_energy_kwh: interval, quality: quality || 'baseline' };
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  (io || telemetrySocket)?.emit('telemetry:update', [reading]);
  return reading;
}
