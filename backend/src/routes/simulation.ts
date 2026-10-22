import { Router } from 'express';
import { Server } from 'socket.io';
import { authenticateToken } from '../auth';
import { ReplayController } from '../simulation/replay';

const ok = (res: any, data: any) => res.json({ success: true, data });
const error = (res: any, message: string, status = 400) => res.status(status).json({ success: false, message });

export function createSimulationRouter(io: Server) {
  const router = Router();
  const replay = new ReplayController(io);
  router.get('/replay', authenticateToken, (_req, res) => ok(res, replay.status()));
  router.post('/replay/start', authenticateToken, (_req, res) => {
    try { return ok(res, replay.start()); } catch (err) { return error(res, err instanceof Error ? err.message : 'Replay could not start', 409); }
  });
  router.post('/replay/pause', authenticateToken, (_req, res) => {
    try { return ok(res, replay.pause()); } catch (err) { return error(res, err instanceof Error ? err.message : 'Replay could not pause', 409); }
  });
  router.post('/replay/resume', authenticateToken, (_req, res) => {
    try { return ok(res, replay.resume()); } catch (err) { return error(res, err instanceof Error ? err.message : 'Replay could not resume', 409); }
  });
  router.post('/replay/restart', authenticateToken, (_req, res) => ok(res, replay.restart()));
  router.put('/replay/speed', authenticateToken, (req, res) => {
    try { return ok(res, replay.setSpeed(Number(req.body?.speed))); } catch (err) { return error(res, err instanceof Error ? err.message : 'Invalid replay speed'); }
  });
  return router;
}
