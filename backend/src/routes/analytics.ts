import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any) => res.json({ success: true, message: 'Success', data });
const sendError = (res: any) => res.status(500).json({ success: false, message: 'Analytics query failed' });

router.get('/summary', authenticateToken, async (_req, res) => {
  try {
    const db = getDb();
    const power = await db.get(`SELECT COALESCE(SUM(power), 0) total_power FROM telemetry t
      WHERE t.id = (SELECT t2.id FROM telemetry t2 WHERE COALESCE(t2.pzem_id, 'appliance:' || t2.appliance_id) = COALESCE(t.pzem_id, 'appliance:' || t.appliance_id) ORDER BY t2.timestamp DESC, t2.id DESC LIMIT 1)`);
    const peak = await db.get(`SELECT COALESCE(MAX(total_power), 0) peak_power FROM (
      SELECT timestamp, SUM(power) total_power FROM telemetry WHERE timestamp >= datetime('now', '-24 hours') GROUP BY timestamp
    )`);
    const energy = await db.get("SELECT COALESCE(SUM(interval_energy_kwh), 0) energy_today FROM telemetry WHERE date(timestamp) = date('now') AND quality = 'valid'");
    const active = await db.get("SELECT COUNT(DISTINCT COALESCE(pzem_id, 'appliance:' || appliance_id)) active_count FROM telemetry WHERE timestamp >= datetime('now', '-60 seconds')");
    const total = await db.get("SELECT COUNT(*) c FROM appliances WHERE status = 'active'");
    const alerts = await db.get('SELECT COUNT(*) c FROM alerts WHERE resolved = 0');
    sendSuccess(res, { total_power: Number(power?.total_power || 0), current_power: Number(power?.total_power || 0), total_energy_today: Number(energy?.energy_today || 0), estimated_cost: null, peak_power: Number(peak?.peak_power || 0), active_appliances: Number(active?.active_count || 0), total_appliances: Number(total?.c || 0), active_alerts: Number(alerts?.c || 0) });
  } catch { sendError(res); }
});

router.get('/breakdown', authenticateToken, async (_req, res) => {
  try {
    const rows = await getDb().all(`SELECT a.id appliance_id, a.name appliance_name, a.category,
      AVG(t.power) power, COALESCE(SUM(CASE WHEN t.quality = 'valid' THEN t.interval_energy_kwh ELSE 0 END), 0) energy
      FROM telemetry t JOIN appliances a ON t.appliance_id = a.id
      WHERE t.timestamp >= datetime('now', '-24 hours') GROUP BY a.id ORDER BY energy DESC`);
    sendSuccess(res, rows);
  } catch { sendError(res); }
});

router.get('/trends', authenticateToken, async (req, res) => {
  const period = String(req.query.period || 'hourly');
  const formats: Record<string, string> = { hourly: '%Y-%m-%d %H:00', daily: '%Y-%m-%d', monthly: '%Y-%m' };
  const format = formats[period];
  if (!format) return res.status(400).json({ success: false, message: 'period must be hourly, daily, or monthly' });
  try {
    const rows = await getDb().all(`WITH readings AS (
      SELECT strftime('${format}', timestamp) time, timestamp, SUM(power) total_power,
        COALESCE(SUM(CASE WHEN quality = 'valid' THEN interval_energy_kwh ELSE 0 END), 0) energy
      FROM telemetry WHERE timestamp >= datetime('now', ?) GROUP BY strftime('${format}', timestamp), timestamp
    ) SELECT time, AVG(total_power) avg_power, MAX(total_power) peak_power, SUM(energy) energy
      FROM readings GROUP BY time ORDER BY time ASC`, [period === 'hourly' ? '-24 hours' : period === 'daily' ? '-30 days' : '-12 months']);
    sendSuccess(res, rows);
  } catch { sendError(res); }
});

router.get('/billing-usage', authenticateToken, async (_req, res) => {
  try {
    const usage = await getDb().get("SELECT COALESCE(SUM(interval_energy_kwh), 0) consumption FROM telemetry WHERE timestamp >= date('now', 'start of month') AND quality = 'valid'");
    sendSuccess(res, { consumption: Number(usage?.consumption || 0), period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() });
  } catch { sendError(res); }
});

export default router;
