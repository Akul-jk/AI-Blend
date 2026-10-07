import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const alerts = await db.all('SELECT * FROM alerts ORDER BY timestamp DESC');
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('UPDATE alerts SET resolved = 1 WHERE id = ?', [id]);
    sendSuccess(res, {}, 'Alert resolved successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('DELETE FROM alerts WHERE id = ?', [id]);
    sendSuccess(res, {}, 'Alert deleted successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
