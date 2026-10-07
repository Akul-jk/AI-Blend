import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

router.get('/model', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/model`);
    if (!response.ok) throw new Error('ML Service failed');
    const data = await response.json();
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, 'ML Service error', error);
  }
});

router.get('/models', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/models`);
    if (!response.ok) throw new Error('ML Service failed');
    const data = await response.json();
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, 'ML Service error', error);
  }
});

router.get('/metrics', authenticateToken, async (_req, res) => {
  try {
    const response = await fetch(`${ML_URL}/metrics`);
    const data = await response.json();
    if (!response.ok) throw new Error('ML Service failed');
    sendSuccess(res, data);
  } catch (error) { sendError(res, 'ML Service error', error); }
});

router.post('/evaluate', authenticateToken, authorizeRoles('admin'), async (_req, res) => {
  try {
    const response = await fetch(`${ML_URL}/evaluate`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error('ML Service failed');
    sendSuccess(res, data);
  } catch (error) { sendError(res, 'ML Service error', error); }
});

router.post('/anomaly/detect', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/anomaly/detect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body || {}) });
    const data = await response.json();
    if (!response.ok) throw new Error('ML Service failed');
    sendSuccess(res, data);
  } catch (error) { sendError(res, 'ML Service error', error); }
});

router.post('/train', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    if (!response.ok) throw new Error('ML Service failed');
    const data = await response.json();
    sendSuccess(res, data, 'Training started');
  } catch (error) {
    sendError(res, 'ML Service error', error);
  }
});

router.post('/predict', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    if (!response.ok) throw new Error('ML Service prediction failed');
    const data = await response.json();
    sendSuccess(res, data, 'Prediction successful');
  } catch (error) {
    sendError(res, 'ML Service error', error);
  }
});

router.post('/dataset/generate', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/dataset/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    if (!response.ok) throw new Error('ML Service dataset generation failed');
    const data = await response.json();
    sendSuccess(res, data, 'Dataset generated');
  } catch (error) {
    sendError(res, 'ML Service error', error);
  }
});

export default router;
