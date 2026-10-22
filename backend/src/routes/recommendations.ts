import { Router } from 'express';
import { authenticateToken } from '../auth';
import { getDb } from '../db';
import { buildRecommendations } from '../services/recommendations';

const router = Router();
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const rows = await getDb().all(`SELECT a.id appliance_id, a.name appliance_name, a.category, t.timestamp,
      t.interval_energy_kwh, t.quality, t.source, t.power
      FROM telemetry t JOIN appliances a ON a.id = t.appliance_id
      WHERE t.timestamp >= datetime('now', '-8 days')
      ORDER BY t.timestamp ASC, a.id ASC`);
    res.json({ success: true, data: buildRecommendations(rows) });
  } catch {
    res.status(500).json({ success: false, message: 'Recommendation data is unavailable' });
  }
});
export default router;
