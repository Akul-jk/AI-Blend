import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';
import { isIndiaPhoneNumber, isSmsConfigured } from '../services/smsAlerts';

const router = Router();
const defaults: Record<string, string> = { phase_type: 'single' };

router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const user = await getDb().get('SELECT phone_number, sms_alerts_enabled FROM users WHERE id = ?', [req.user!.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: {
      phone_number: user.phone_number || '',
      sms_alerts_enabled: Boolean(user.sms_alerts_enabled),
      sms_configured: isSmsConfigured(),
      sms_scope: 'hardware alerts only',
    } });
  } catch { res.status(500).json({ success: false, message: 'Could not load notification settings' }); }
});

router.put('/notifications', authenticateToken, async (req, res) => {
  const phone = typeof req.body.phone_number === 'string' ? req.body.phone_number.trim() : '';
  const enabled = req.body.sms_alerts_enabled;
  if (enabled !== undefined && typeof enabled !== 'boolean') return res.status(400).json({ success: false, message: 'sms_alerts_enabled must be true or false' });
  if (phone && !isIndiaPhoneNumber(phone)) return res.status(400).json({ success: false, message: 'Enter a valid Indian mobile number in international format, such as +919876543210' });
  if (enabled === true && !phone) return res.status(400).json({ success: false, message: 'Add a phone number before enabling SMS alerts' });
  if (enabled === true && !isSmsConfigured()) return res.status(503).json({ success: false, message: 'SMS delivery is not configured by the administrator yet' });
  try {
    const db = getDb();
    await db.run('UPDATE users SET phone_number = ?, sms_alerts_enabled = ? WHERE id = ?', [phone || null, enabled === undefined ? 0 : Number(enabled), req.user!.id]);
    const user = await db.get('SELECT phone_number, sms_alerts_enabled FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, message: 'Notification settings saved', data: {
      phone_number: user.phone_number || '', sms_alerts_enabled: Boolean(user.sms_alerts_enabled),
      sms_configured: isSmsConfigured(), sms_scope: 'hardware alerts only',
    } });
  } catch { res.status(500).json({ success: false, message: 'Could not save notification settings' }); }
});

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
