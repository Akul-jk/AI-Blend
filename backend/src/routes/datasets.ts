import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const datasets = await db.all('SELECT id, name, uploadedAt AS uploaded_at, rowCount AS row_count, sizeBytes AS size_bytes FROM datasets ORDER BY uploadedAt DESC');
    sendSuccess(res, datasets);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.post('/upload', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  res.status(501).json({ success: false, message: 'File upload is not implemented. Generate datasets from canonical telemetry.' });
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('DELETE FROM datasets WHERE id = ?', [id]);
    sendSuccess(res, {}, 'Dataset deleted successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
