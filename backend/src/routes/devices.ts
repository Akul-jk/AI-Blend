import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

router.get('/esp32-devices', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const devices = await db.all('SELECT * FROM esp32_devices');
    sendSuccess(res, devices);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.get('/pzem-devices', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const devices = await db.all('SELECT * FROM pzem_devices');
    sendSuccess(res, devices);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

router.get('/system/status', authenticateToken, async (req, res) => {
  try {
    const latest = await getDb().get('SELECT source, timestamp FROM telemetry ORDER BY timestamp DESC, id DESC LIMIT 1');
    const recent = latest && Date.now() - new Date(latest.timestamp).getTime() <= 60_000;
    sendSuccess(res, { status: recent ? 'online' : 'no_recent_telemetry', mode: latest?.source || 'unavailable', lastSync: latest?.timestamp || null, backendUptimeSeconds: Math.floor(process.uptime()), samplingIntervalMs: Number(process.env.SIMULATION_INTERVAL_MS || 5000), hardwareVerified: false });
  } catch (error) { sendError(res, 'Could not read system status'); }
});

export default router;
