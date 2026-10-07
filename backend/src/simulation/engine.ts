import { Server } from 'socket.io';
import { getDb } from '../db';
import { profiles } from './profiles';
import { DataSource, TelemetryReading } from '../types';
import { acceptTelemetry } from '../services/telemetry';

let simTimer: NodeJS.Timeout | null = null;
const configuredInterval = Number(process.env.SIMULATION_INTERVAL_MS || 5000);
const UPDATE_INTERVAL_MS = Number.isFinite(configuredInterval) ? Math.min(60_000, Math.max(1000, configuredInterval)) : 5000;

export function stopSimulationEngine() {
  if (simTimer) clearTimeout(simTimer);
  simTimer = null;
}

export function runSimulationEngine(io: Server) {
  stopSimulationEngine();
  console.log(`Starting Simulation Engine (${UPDATE_INTERVAL_MS}ms interval)...`);
  let running = false;
  let lastRetentionSweep = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const db = getDb();
      const appliances = await db.all(`SELECT a.*, r.rated_power, r.rated_voltage, r.standby_power, p.esp32_device_id AS device_id
        FROM appliances a LEFT JOIN appliance_ratings r ON a.id = r.appliance_id
        LEFT JOIN pzem_devices p ON p.id = a.pzem_id WHERE a.status = 'active'`);
      const timestamp = new Date().toISOString();
      for (const app of appliances) {
        const profile = profiles[app.category] || profiles['Default'];
        const measured = profile.generateReadings(app);
        const voltage = Number(measured.voltage.toFixed(2));
        const current = Number(measured.current.toFixed(3));
        const power = Number(measured.power.toFixed(2));
        const power_factor = Number(measured.power_factor.toFixed(3));
        const previous = await db.get('SELECT energy FROM telemetry WHERE pzem_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1', [app.pzem_id]);
        const delta = power * (UPDATE_INTERVAL_MS / 3_600_000) / 1000;
        const reading: TelemetryReading = {
          timestamp, pzem_id: app.pzem_id, appliance_id: app.id,
          voltage, current, power, energy: Number(((previous?.energy || 0) + delta).toFixed(6)),
          frequency: Number(measured.frequency.toFixed(3)), power_factor, source: DataSource.SIMULATION,
          device_id: app.device_id || undefined, circuit_id: app.circuit_id || undefined,
        };
        await acceptTelemetry(reading, io);
      }
      if (Date.now() - lastRetentionSweep >= 60 * 60_000) {
        const retentionDays = Math.min(365, Math.max(1, Number(process.env.TELEMETRY_RETENTION_DAYS) || 30));
        await db.run("DELETE FROM telemetry WHERE timestamp < datetime('now', ?)", [`-${retentionDays} days`]);
        lastRetentionSweep = Date.now();
      }
    } catch (error) {
      console.error('Simulation Engine Error:', error);
    } finally {
      running = false;
      simTimer = setTimeout(tick, UPDATE_INTERVAL_MS);
    }
  };
  simTimer = setTimeout(tick, 0);
}
