import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';
import { acceptTelemetry, TelemetryValidationError } from '../services/telemetry';
import { DataSource, TelemetryReading } from '../types';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/latest', authenticateToken, async (_req, res) => {
  try {
    const db = getDb();
    const latest = await db.all(`SELECT t.* FROM telemetry t WHERE t.id =
      (SELECT t2.id FROM telemetry t2 WHERE COALESCE(t2.pzem_id, 'appliance:' || t2.appliance_id) = COALESCE(t.pzem_id, 'appliance:' || t.appliance_id) ORDER BY t2.timestamp DESC, t2.id DESC LIMIT 1)
      ORDER BY t.timestamp DESC`);
    sendSuccess(res, latest);
  } catch { sendError(res, 'Could not load latest telemetry'); }
});

router.get('/history', authenticateToken, async (req, res) => {
  const applianceId = req.query.appliance_id ? Number(req.query.appliance_id) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
  if (applianceId !== undefined && (!Number.isInteger(applianceId) || applianceId < 1)) return sendError(res, 'appliance_id must be a positive integer', {}, 400);
  if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && from > to)) return sendError(res, 'Invalid time range', {}, 400);
  try {
    const clauses: string[] = [];
    const params: Array<number | string> = [];
    if (applianceId) { clauses.push('appliance_id = ?'); params.push(applianceId); }
    if (from) { clauses.push('timestamp >= ?'); params.push(from.toISOString()); }
    if (to) { clauses.push('timestamp <= ?'); params.push(to.toISOString()); }
    params.push(limit);
    const history = await getDb().all(`SELECT * FROM telemetry ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY timestamp DESC, id DESC LIMIT ?`, params);
    sendSuccess(res, history);
  } catch { sendError(res, 'Could not load telemetry history'); }
});

router.get('/totals', authenticateToken, async (_req, res) => {
  try {
    const db = getDb();
    const totals = await db.get(`SELECT COALESCE(SUM(t.power), 0) AS total_power FROM telemetry t
      WHERE t.id = (SELECT t2.id FROM telemetry t2 WHERE COALESCE(t2.pzem_id, 'appliance:' || t2.appliance_id) = COALESCE(t.pzem_id, 'appliance:' || t.appliance_id) ORDER BY t2.timestamp DESC, t2.id DESC LIMIT 1)`);
    const energy = await db.get("SELECT COALESCE(SUM(interval_energy_kwh), 0) AS total_energy_kwh FROM telemetry WHERE timestamp >= datetime('now', '-1 hour') AND quality = 'valid'");
    sendSuccess(res, { ...totals, ...energy });
  } catch { sendError(res, 'Could not calculate telemetry totals'); }
});

router.post('/', authenticateToken, authorizeRoles('admin', 'user'), async (req, res) => {
  try {
    const reading = await acceptTelemetry({ ...req.body, source: DataSource.HARDWARE } as TelemetryReading);
    sendSuccess(res, reading, 'Telemetry accepted', 201);
  } catch (error) {
    if (error instanceof TelemetryValidationError) return sendError(res, error.message, {}, error.statusCode);
    sendError(res, 'Could not persist telemetry');
  }
});

export default router;
