import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';
import { once } from 'events';

const router = Router();
const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

router.get('/export.csv', authenticateToken, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const applianceId = req.query.appliance_id ? Number(req.query.appliance_id) : undefined;
  if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime())) || (from && to && from > to)) return res.status(400).json({ success: false, message: 'Invalid time range' });
  if (applianceId !== undefined && (!Number.isInteger(applianceId) || applianceId < 1)) return res.status(400).json({ success: false, message: 'Invalid appliance_id' });
  try {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (from) { clauses.push('t.timestamp >= ?'); params.push(from.toISOString()); }
    if (to) { clauses.push('t.timestamp <= ?'); params.push(to.toISOString()); }
    if (applianceId) { clauses.push('t.appliance_id = ?'); params.push(applianceId); }
    const columns = ['timestamp', 'pzem_id', 'appliance_id', 'appliance_name', 'voltage', 'current', 'power', 'cumulative_energy_kwh', 'interval_energy_kwh', 'frequency', 'power_factor', 'source', 'quality', 'device_id', 'circuit_id', 'received_at'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=telemetry-export.csv');
    res.status(200);
    res.write(`${columns.join(',')}\r\n`);
    const db = getDb();
    let cursor: { timestamp: string; id: number } | undefined;
    while (!res.destroyed) {
      const pageClauses = [...clauses];
      const pageParams: Array<string | number> = [...params];
      if (cursor) { pageClauses.push('(t.timestamp > ? OR (t.timestamp = ? AND t.id > ?))'); pageParams.push(cursor.timestamp, cursor.timestamp, cursor.id); }
      pageParams.push(1000);
      const rows = await db.all(`SELECT t.id, t.timestamp, t.pzem_id, t.appliance_id, a.name appliance_name, t.voltage, t.current, t.power, t.energy cumulative_energy_kwh, t.interval_energy_kwh, t.frequency, t.power_factor, t.source, t.quality, t.device_id, t.circuit_id, t.received_at FROM telemetry t LEFT JOIN appliances a ON a.id = t.appliance_id ${pageClauses.length ? `WHERE ${pageClauses.join(' AND ')}` : ''} ORDER BY t.timestamp, t.id LIMIT ?`, pageParams);
      if (!rows.length) break;
      for (const row of rows) {
        const line = `${columns.map(column => csv((row as Record<string, unknown>)[column])).join(',')}\r\n`;
        if (!res.write(line)) await once(res, 'drain');
      }
      const last = rows[rows.length - 1];
      cursor = { timestamp: last.timestamp, id: last.id };
      if (rows.length < 1000) break;
    }
    res.end();
  } catch { res.status(500).json({ success: false, message: 'Could not export telemetry' }); }
});

router.get('/', authenticateToken, (_req, res) => res.json({ success: true, message: 'Reports are generated on demand from telemetry.', data: [] }));

export default router;
