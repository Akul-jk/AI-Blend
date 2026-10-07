import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();

const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const appliances = await db.all(`
      SELECT a.*, r.rated_power, r.rated_voltage, r.rated_current, r.rated_frequency, r.rated_power_factor, r.standby_power
      FROM appliances a
      LEFT JOIN appliance_ratings r ON a.id = r.appliance_id
    `);

    const enriched = await Promise.all(appliances.map(async (app) => {
      const latest = await db.get('SELECT * FROM telemetry WHERE appliance_id = ? ORDER BY timestamp DESC LIMIT 1', [app.id]);
      const energyToday = await db.get("SELECT COALESCE(SUM(interval_energy_kwh), 0) energy_today FROM telemetry WHERE appliance_id = ? AND date(timestamp) = date('now') AND quality = 'valid'", [app.id]);
      return { ...app, latest_telemetry: latest || null, energy_today: Number(energyToday?.energy_today || 0) };
    }));

    sendSuccess(res, enriched);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const app = await db.get('SELECT * FROM appliances WHERE id = ?', [req.params.id]);
    if (!app) return sendError(res, 'Appliance not found', {}, 404);

    const rating = await db.get('SELECT * FROM appliance_ratings WHERE appliance_id = ?', [app.id]);
    const latest = await db.get('SELECT * FROM telemetry WHERE appliance_id = ? ORDER BY timestamp DESC LIMIT 1', [app.id]);
    const energyToday = await db.get("SELECT COALESCE(SUM(interval_energy_kwh), 0) energy_today FROM telemetry WHERE appliance_id = ? AND date(timestamp) = date('now') AND quality = 'valid'", [app.id]);
    sendSuccess(res, { ...app, rating, latest_telemetry: latest, energy_today: Number(energyToday?.energy_today || 0) });
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { name, category, manufacturer, model, serial_number, description, location, pzem_id, circuit_id, rated_voltage, rated_current, rated_power, rated_frequency, rated_power_factor, standby_power } = req.body;
    if (typeof name !== 'string' || !name.trim() || typeof category !== 'string' || !category.trim()) return sendError(res, 'Name and category are required', {}, 400);
    if (!await db.get('SELECT id FROM appliance_categories WHERE name = ?', [category])) return sendError(res, 'Unknown appliance category', {}, 400);
    if (pzem_id && !await db.get('SELECT id FROM pzem_devices WHERE id = ?', [pzem_id])) return sendError(res, 'Unknown PZEM device', {}, 400);
    if (circuit_id && !await db.get('SELECT id FROM circuits WHERE id = ?', [circuit_id])) return sendError(res, 'Unknown circuit', {}, 400);
    const rating = [rated_voltage, rated_current, rated_power, rated_frequency ?? 50].map(Number);
    if (rating.some(value => !Number.isFinite(value) || value <= 0)) return sendError(res, 'Rated voltage, current, power and frequency must be positive numbers', {}, 400);
    const powerFactor = Number(rated_power_factor ?? 0.9), standbyPower = Number(standby_power ?? 0);
    if (!Number.isFinite(powerFactor) || powerFactor < 0 || powerFactor > 1 || !Number.isFinite(standbyPower) || standbyPower < 0) return sendError(res, 'Rated power factor must be 0–1 and standby power non-negative', {}, 400);
    await db.exec('BEGIN IMMEDIATE');
    let applianceId: number;
    try {
      const result = await db.run(`INSERT INTO appliances (name, category, manufacturer, model, serial_number, description, location, pzem_id, circuit_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name.trim(), category, manufacturer || null, model || null, serial_number || null, description || null, location || null, pzem_id || null, circuit_id || null]);
      applianceId = result.lastID!;
      await db.run(`INSERT INTO appliance_ratings (appliance_id, rated_voltage, rated_current, rated_power, rated_frequency, rated_power_factor, standby_power) VALUES (?, ?, ?, ?, ?, ?, ?)`, [applianceId, ...rating, powerFactor, standbyPower]);
      if (pzem_id || circuit_id) await db.run('INSERT INTO appliance_measurement_assignments(appliance_id, pzem_id, circuit_id) VALUES (?, ?, ?)', [applianceId, pzem_id || null, circuit_id || null]);
      await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
    sendSuccess(res, { id: applianceId }, 'Appliance created', 201);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const db = getDb();
    const allowed = ['name', 'category', 'manufacturer', 'model', 'serial_number', 'description', 'location', 'pzem_id', 'circuit_id', 'status'];
    const updates = allowed.filter(key => req.body[key] !== undefined);
    if (!updates.length) return sendError(res, 'No fields to update', {}, 400);
    if (req.body.category && !await getDb().get('SELECT id FROM appliance_categories WHERE name = ?', [req.body.category])) return sendError(res, 'Unknown appliance category', {}, 400);
    if (req.body.pzem_id && !await getDb().get('SELECT id FROM pzem_devices WHERE id = ?', [req.body.pzem_id])) return sendError(res, 'Unknown PZEM device', {}, 400);
    if (req.body.circuit_id && !await getDb().get('SELECT id FROM circuits WHERE id = ?', [req.body.circuit_id])) return sendError(res, 'Unknown circuit', {}, 400);
    await db.exec('BEGIN IMMEDIATE');
    try {
      const existing = await db.get('SELECT pzem_id, circuit_id FROM appliances WHERE id = ?', [req.params.id]);
      if (!existing) { await db.exec('ROLLBACK'); return sendError(res, 'Appliance not found', {}, 404); }
      await db.run(`UPDATE appliances SET ${updates.map(key => `${key} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...updates.map(key => req.body[key] ?? null), req.params.id]);
      if (updates.includes('pzem_id') || updates.includes('circuit_id')) {
        await db.run('UPDATE appliance_measurement_assignments SET valid_to = CURRENT_TIMESTAMP WHERE appliance_id = ? AND valid_to IS NULL', [req.params.id]);
        const newPzem = req.body.pzem_id !== undefined ? req.body.pzem_id : existing.pzem_id;
        const newCircuit = req.body.circuit_id !== undefined ? req.body.circuit_id : existing.circuit_id;
        if (newPzem || newCircuit) await db.run('INSERT INTO appliance_measurement_assignments(appliance_id, pzem_id, circuit_id) VALUES (?, ?, ?)', [req.params.id, newPzem || null, newCircuit || null]);
      }
      await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
    sendSuccess(res, {}, 'Appliance updated');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM appliances WHERE id = ?', [req.params.id]);
    sendSuccess(res, {}, 'Appliance deleted');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.get('/:id/telemetry', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const applianceId = Number(req.params.id);
    if (!Number.isInteger(applianceId) || applianceId < 1) return sendError(res, 'Invalid appliance id', {}, 400);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && from > to)) return sendError(res, 'Invalid time range', {}, 400);
    const clauses = ['appliance_id = ?'];
    const params: Array<number | string> = [applianceId];
    if (from) { clauses.push('timestamp >= ?'); params.push(from.toISOString()); }
    if (to) { clauses.push('timestamp <= ?'); params.push(to.toISOString()); }
    params.push(limit);
    const telemetry = await db.all(`SELECT * FROM telemetry WHERE ${clauses.join(' AND ')} ORDER BY timestamp DESC, id DESC LIMIT ?`, params);
    sendSuccess(res, telemetry);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const avg = await db.get("SELECT AVG(power) as avg_power, MAX(power) as peak_power, COALESCE(SUM(CASE WHEN quality = 'valid' AND date(timestamp) = date('now') THEN interval_energy_kwh ELSE 0 END), 0) energy_today FROM telemetry WHERE appliance_id = ?", [req.params.id]);
    sendSuccess(res, avg);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
