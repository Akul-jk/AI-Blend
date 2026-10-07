import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';

const router = Router();

const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const categories = await db.all('SELECT * FROM appliance_categories');
    sendSuccess(res, categories);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
