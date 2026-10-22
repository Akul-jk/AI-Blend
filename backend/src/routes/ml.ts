import { Router } from 'express';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const MODEL_UPLOAD_LIMIT = 128 * 1024 * 1024;
const APP_MODEL_CONTRACT = 'smart-energy-19f-v1';

async function readSavedCandidateEvaluation() {
  const candidateRoot = path.resolve(__dirname, '../../../ml-service/models/candidates');
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(candidateRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = await Promise.all(entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('energy_lstm_app_candidate_'))
    .map(async entry => {
      const metadataPath = path.join(candidateRoot, entry.name, 'metadata.json');
      try {
        const [metadataText, fileInfo] = await Promise.all([fs.readFile(metadataPath, 'utf8'), fs.stat(metadataPath)]);
        return { metadata: JSON.parse(metadataText), modifiedAt: fileInfo.mtimeMs };
      } catch {
        return null;
      }
    }));

  let latest = candidates
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .find(item => item.metadata?.contract_id === APP_MODEL_CONTRACT
      && item.metadata?.metrics?.overall?.candidate
      && item.metadata?.metrics?.overall?.persistence_baseline);
  if (!latest) {
    const snapshotPath = path.resolve(__dirname, '../../../ml-service/evaluation_snapshots/app_compatible_candidate.json');
    try {
      const metadata = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
      if (metadata.contract_id === APP_MODEL_CONTRACT && metadata.evaluation_only === true
        && metadata.metrics?.overall?.candidate && metadata.metrics?.overall?.persistence_baseline) {
        latest = { metadata, modifiedAt: 0 };
      }
    } catch {
      return null;
    }
  }
  if (!latest) return null;

  const metadata = latest.metadata;
  return {
    name: 'LSTM Energy Forecaster',
    version: null,
    status: 'not_trained',
    dataset_source: metadata.dataset_source || 'unknown',
    features: metadata.feature_columns || [],
    sequence_length: metadata.sequence_length,
    sampling_interval: `${metadata.sampling_interval_ms}ms`,
    training_date: null,
    appliance_scope: 'per-appliance sequence',
    metrics: null,
    metadata_source: 'saved_candidate',
    latest_candidate: {
      version: metadata.model_version,
      dataset_source: metadata.dataset_source || 'unknown',
      deployment_eligible: metadata.deployment_eligible === true,
      activation: metadata.activation,
      metrics: metadata.metrics.overall,
      training_data_rows: metadata.training_data_rows,
      training_samples: metadata.training_samples,
      validation_samples: metadata.validation_samples,
      test_samples: metadata.test_samples,
    },
  };
}

async function proxyModelManagement(req: any, res: any, path: string, method = 'GET', body?: Buffer, contentType = 'application/zip') {
  const internalToken = process.env.ML_INTERNAL_TOKEN || '';
  if (internalToken.length < 32) return sendError(res, 'Model management is not configured.', {}, 503);
  try {
    const response = await fetch(`${ML_URL}/management${path}`, {
      method,
      headers: {
        'X-ML-Internal-Token': internalToken,
        ...(body ? { 'Content-Type': contentType, 'Content-Length': String(body.length) } : {}),
        ...(method === 'POST' && !body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    const data: any = await response.json().catch(() => ({ detail: 'Model service returned an invalid response.' }));
    if (!response.ok) return sendError(res, data.detail || 'Model management request failed.', {}, response.status);
    return sendSuccess(res, data);
  } catch {
    return sendError(res, 'Model management service is unavailable.', {}, 503);
  }
}

const adminOnly = [authenticateToken, authorizeRoles('admin')];
const rawModelPackage = express.raw({
  type: ['application/zip', 'application/octet-stream'],
  limit: MODEL_UPLOAD_LIMIT,
});

router.get('/model-management/models', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, '/models'));
router.get('/model-management/history', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, '/history'));
router.get('/model-management/models/:version', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, `/models/${encodeURIComponent(req.params.version)}`));
router.post('/model-management/models/validate', ...adminOnly, rawModelPackage, (req, res) => {
  if (!Buffer.isBuffer(req.body)) return sendError(res, 'Upload must be a ZIP package.', {}, 415);
  proxyModelManagement(req, res, '/models/validate', 'POST', req.body);
});
router.post('/model-management/models/stage', ...adminOnly, rawModelPackage, (req, res) => {
  if (!Buffer.isBuffer(req.body)) return sendError(res, 'Upload must be a ZIP package.', {}, 415);
  proxyModelManagement(req, res, '/models/stage', 'POST', req.body);
});
router.post('/model-management/models/:version/activate', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, `/models/${encodeURIComponent(req.params.version)}/activate`, 'POST'));
router.post('/model-management/rollback', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, '/rollback', 'POST', Buffer.from(JSON.stringify(req.body || {})), 'application/json'));
router.delete('/model-management/models/:version', ...adminOnly, (req, res) =>
  proxyModelManagement(req, res, `/models/${encodeURIComponent(req.params.version)}`, 'DELETE'));

router.get('/model', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${ML_URL}/model`);
    if (!response.ok) throw new Error('ML Service failed');
    const data: any = await response.json();
    data.metadata_source = 'live';
    sendSuccess(res, data);
  } catch {
    const savedEvaluation = await readSavedCandidateEvaluation();
    if (savedEvaluation) return sendSuccess(res, savedEvaluation, 'Showing saved candidate evaluation; the ML service is unavailable.');
    return sendError(res, 'ML Service error', {}, 503);
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
