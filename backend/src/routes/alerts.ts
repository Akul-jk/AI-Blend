import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const alerts = await db.all(`SELECT alerts.*, appliances.name AS appliance_name FROM alerts
      LEFT JOIN appliances ON appliances.id = alerts.appliance_id ORDER BY alerts.timestamp DESC, alerts.id DESC LIMIT 500`);
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return sendError(res, 'Invalid alert id', {}, 400);
  try {
    const db = getDb();
    const result = await db.run('UPDATE alerts SET resolved = 1 WHERE id = ?', [id]);
    if (!result.changes) return sendError(res, 'Alert not found', {}, 404);
    // Keep the application notification bell and alert timeline in sync.
    const io = (req.app as any).get('io');
    io?.emit('alert_update', { id: Number(id), status: 'resolved' });
    sendSuccess(res, {}, 'Alert resolved successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return sendError(res, 'Invalid alert id', {}, 400);
  try {
    const db = getDb();
    const result = await db.run('DELETE FROM alerts WHERE id = ?', [id]);
    if (!result.changes) return sendError(res, 'Alert not found', {}, 404);
    sendSuccess(res, {}, 'Alert deleted successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
