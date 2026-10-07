import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const defaults: Record<string, string> = { phase_type: 'single' };

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const rows = await getDb().all("SELECT key, value FROM app_settings WHERE key = 'phase_type'");
    const settings = { ...defaults, ...Object.fromEntries(rows.map((row: { key: string; value: string }) => [row.key, row.value])) };
    res.json({ success: true, message: 'Success', data: settings });
  } catch { res.status(500).json({ success: false, message: 'Could not load settings' }); }
});

router.put('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const allowed = ['phase_type'];
  const values: Record<string, string> = {};
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    const value = String(req.body[key]).trim();
    if (!value || value.length > 64) return res.status(400).json({ success: false, message: `Invalid ${key}` });
    values[key] = value;
  }
  if (values.phase_type && !['single', 'three'].includes(values.phase_type)) return res.status(400).json({ success: false, message: 'phase_type must be single or three' });
  try {
    const db = getDb();
    await db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, value] of Object.entries(values)) await db.run('INSERT INTO app_settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP', [key, value]);
      await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
    res.json({ success: true, message: 'Settings saved', data: values });
  } catch { res.status(500).json({ success: false, message: 'Could not persist settings' }); }
});

export default router;
