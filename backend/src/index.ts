import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, getDb } from './db';
import { hashPassword, comparePassword, generateToken, authenticateToken } from './auth';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Global API Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[API REQUEST] [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Helper to format consistent API envelopes
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => {
  res.status(status).json({
    success: true,
    message,
    data
  });
};

const sendError = (res: any, message: string, error: any = {}, status = 500) => {
  res.status(status).json({
    success: false,
    message,
    error
  });
};

// ==========================================
// Authentication Routes (/api/v1/auth/...)
// ==========================================

app.post('/api/v1/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return sendError(res, 'Missing required fields', {}, 400);
  }

  try {
    const db = getDb();
    const hashedPassword = await hashPassword(password);
    const result = await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'operator']
    );
    
    const user = { id: result.lastID!, username, email, role: role || 'operator' };
    const token = generateToken(user);
    sendSuccess(res, { token, user }, 'Registration successful', 201);
  } catch (error: any) {
    if (error.message.includes('UNIQUE')) {
      return sendError(res, 'Username or email already exists', {}, 400);
    }
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return sendError(res, 'Missing username or password', {}, 400);
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return sendError(res, 'Invalid credentials', {}, 400);
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials', {}, 400);
    }

    const payload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = generateToken(payload);
    sendSuccess(res, { token, user: payload }, 'Login successful');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

const recoveryTokens = new Map<string, string>();

app.post('/api/v1/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return sendError(res, 'Missing email', {}, 400);
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return sendError(res, 'Email not registered', {}, 400);
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    recoveryTokens.set(user.username.toLowerCase(), token);

    console.log(`\n=============================================`);
    console.log(`[PASSWORD RECOVERY] User: ${user.username}`);
    console.log(`[PASSWORD RECOVERY] Verification Code: ${token}`);
    console.log(`=============================================\n`);

    sendSuccess(res, {}, 'Verification code sent. Check backend terminal logs.');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/auth/reset-password', async (req, res) => {
  const { username, token, password } = req.body;
  if (!username || !token || !password) {
    return sendError(res, 'Missing required fields', {}, 400);
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return sendError(res, 'User not found', {}, 400);
    }

    const storedToken = recoveryTokens.get(username.toLowerCase());
    if (!storedToken || storedToken !== token) {
      return sendError(res, 'Invalid or expired verification code', {}, 400);
    }

    const hashedPassword = await hashPassword(password);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    
    recoveryTokens.delete(username.toLowerCase());
    sendSuccess(res, {}, 'Password reset successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/auth/refresh', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const token = generateToken(user);
  sendSuccess(res, { token }, 'Token refreshed');
});

app.post('/api/v1/auth/logout', authenticateToken, (req, res) => {
  sendSuccess(res, {}, 'Logged out successfully');
});

// ==========================================
// Device Routes (/api/v1/device/...)
// ==========================================

app.get('/api/v1/devices', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const devices = await db.all('SELECT * FROM devices');
    sendSuccess(res, devices);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/device', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const device = await db.get('SELECT * FROM devices LIMIT 1');
    sendSuccess(res, device);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/device/status', authenticateToken, async (req, res) => {
  sendSuccess(res, {
    status: 'online',
    wifiStrength: '-56 dBm',
    uptime: '14h 22m 10s',
    firmware: 'v1.0.4-pzem',
    lastSync: new Date().toISOString()
  });
});

app.post('/api/v1/device/restart', authenticateToken, (req, res) => {
  io.emit('device_status', { status: 'rebooting' });
  sendSuccess(res, {}, 'Restart command dispatched to ESP32 MCU');
});

app.post('/api/v1/device/update', authenticateToken, (req, res) => {
  sendSuccess(res, { task: 'OTA-592', progress: 'simulated' }, 'OTA firmware compilation initialized');
});

// ==========================================
// Sensor Routes (/api/v1/sensors/...)
// ==========================================

app.get('/api/v1/sensors', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const sensors = await db.all('SELECT * FROM sensors');
    sendSuccess(res, sensors);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/sensors/latest', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const sensors = await db.all('SELECT * FROM sensors');
    sendSuccess(res, sensors);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/sensors/:id/history', authenticateToken, async (req, res) => {
  const sensorId = req.params.id;
  const limit = parseInt(req.query.limit as string) || 50;
  try {
    const db = getDb();
    const history = await db.all(
      'SELECT * FROM sensor_history WHERE sensorId = ? ORDER BY timestamp DESC LIMIT ?',
      [sensorId, limit]
    );
    sendSuccess(res, history.reverse());
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/sensors/history', authenticateToken, async (req, res) => {
  const { sensorId, limit } = req.query;
  const targetId = (sensorId as string) || 'sns-001';
  const targetLimit = parseInt(limit as string) || 30;
  try {
    const db = getDb();
    const history = await db.all(
      'SELECT * FROM sensor_history WHERE sensorId = ? ORDER BY timestamp DESC LIMIT ?',
      [targetId, targetLimit]
    );
    sendSuccess(res, history.reverse());
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/sensors/statistics', authenticateToken, async (req, res) => {
  sendSuccess(res, {
    min: 120.4,
    max: 580.2,
    average: 341.2,
    stdDev: 24.5,
    variance: 600.25,
    median: 338.4
  });
});

app.put('/api/v1/sensors/:id', authenticateToken, async (req, res) => {
  const sensorId = req.params.id;
  const { warningLow, warningHigh, criticalLow, criticalHigh, calibrationMultiplier } = req.body;
  try {
    const db = getDb();
    await db.run(
      `UPDATE sensors SET 
        warningLow = ?, 
        warningHigh = ?, 
        criticalLow = ?, 
        criticalHigh = ?, 
        calibrationMultiplier = ? 
      WHERE id = ?`,
      [warningLow, warningHigh, criticalLow, criticalHigh, calibrationMultiplier, sensorId]
    );
    sendSuccess(res, {}, 'Sensor parameters updated');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// ==========================================
// Dataset Routes (/api/v1/dataset/...)
// ==========================================

app.get('/api/v1/dataset', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const datasets = await db.all('SELECT * FROM datasets');
    sendSuccess(res, datasets);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/dataset/upload', authenticateToken, async (req, res) => {
  const { name, size, records, uploaded_by } = req.body;
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO datasets (name, filePath, rowCount, sizeBytes) VALUES (?, ?, ?, ?)',
      [name, 'uploads/' + name, records || 18540, size || '2.4 MB']
    );
    io.emit('dataset_uploaded', { id: result.lastID, name });
    sendSuccess(res, { id: result.lastID }, 'Dataset uploaded successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/dataset/preview', authenticateToken, (req, res) => {
  sendSuccess(res, [
    { timestamp: '17:15:00', voltage: 229.4, current: 2.36, power: 541 },
    { timestamp: '17:15:03', voltage: 228.9, current: 2.45, power: 561 }
  ]);
});

app.get('/api/v1/dataset/statistics', authenticateToken, (req, res) => {
  sendSuccess(res, {
    records: 18540,
    features: 14,
    missingValues: 3,
    duplicates: 21,
    qualityScore: 96.4
  });
});

app.delete('/api/v1/dataset/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('DELETE FROM datasets WHERE id = ?', [id]);
    sendSuccess(res, {}, 'Dataset deleted successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// Deprecated routes mapped to v1
app.get('/api/datasets', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const datasets = await db.all('SELECT * FROM datasets');
    res.json(datasets);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});
app.post('/api/datasets', authenticateToken, async (req, res) => {
  const { name, size, records } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO datasets (name, filePath, rowCount, sizeBytes) VALUES (?, ?, ?, ?)', [name, 'uploads/' + name, records || 15000, size || '1.8 MB']);
    res.json({ id: result.lastID });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ==========================================
// ML Services Routes (/api/v1/ml/...)
// ==========================================

app.get('/api/v1/models', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const models = await db.all('SELECT * FROM models');
    sendSuccess(res, models);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/ml/model', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const activeModel = await db.get("SELECT * FROM models WHERE status = 'completed' ORDER BY id DESC LIMIT 1");
    sendSuccess(res, activeModel || { name: 'LSTM v2.4', algorithm: 'LSTM', accuracy: 0.973, rmse: 0.12 });
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/ml/predict', authenticateToken, (req, res) => {
  sendSuccess(res, {
    hour_prediction: 0.54,
    day_prediction: 7.82,
    week_prediction: 54.6,
    predicted_bill: 1548.0,
    confidence: 0.973
  });
});

app.post('/api/v1/ml/train', authenticateToken, async (req, res) => {
  const { name, type } = req.body;
  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO models (name, type, status, accuracy, loss) VALUES (?, ?, ?, ?, ?)',
      [name, type, 'training', null, null]
    );
    const modelId = result.lastID!;
    
    // Simulate training progress
    setTimeout(async () => {
      const trainDb = getDb();
      const accuracy = 0.85 + Math.random() * 0.12;
      const loss = 0.15 + Math.random() * 0.10;
      await trainDb.run(
        'UPDATE models SET status = ?, accuracy = ?, loss = ? WHERE id = ?',
        ['completed', accuracy, loss, modelId]
      );
      
      io.emit('training_progress', { id: modelId, status: 'completed', accuracy, loss });
      io.emit('ml:model_updated', { id: modelId, status: 'completed', accuracy, loss });
    }, 5000);

    sendSuccess(res, { modelId }, 'Training loop started');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.get('/api/v1/ml/compare', authenticateToken, (req, res) => {
  sendSuccess(res, [
    { name: 'LSTM v2.4', rmse: 0.12, mae: 0.09, r2: 0.98 },
    { name: 'XGBoost Forecaster', rmse: 0.18, mae: 0.13, r2: 0.96 }
  ]);
});

app.get('/api/v1/ml/features', authenticateToken, (req, res) => {
  sendSuccess(res, {
    power: 0.36,
    current: 0.25,
    voltage: 0.18,
    time: 0.12
  });
});

app.post('/api/v1/ml/explain', authenticateToken, (req, res) => {
  sendSuccess(res, {
    confidence: 97.3,
    contribution: {
      power: 0.42,
      current: 0.24,
      voltage: 0.21,
      temp: 0.13
    }
  });
});

app.get('/api/v1/ml/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const models = await db.all('SELECT * FROM models ORDER BY createdAt DESC');
    sendSuccess(res, models);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.post('/api/v1/ml/deploy', authenticateToken, async (req, res) => {
  const { name } = req.body;
  io.emit('model_deployed', { name });
  sendSuccess(res, {}, `Estimator ${name} deployed successfully`);
});

// Deprecated routes mapped to v1
app.get('/api/models', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const models = await db.all('SELECT * FROM models');
    res.json(models);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});
app.post('/api/ml/train', authenticateToken, async (req, res) => {
  const { name, type } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO models (name, type, status, accuracy, loss) VALUES (?, ?, ?, ?, ?)', [name, type, 'training', null, null]);
    const modelId = result.lastID!;
    setTimeout(async () => {
      const trainDb = getDb();
      const accuracy = 0.92;
      await trainDb.run('UPDATE models SET status = ?, accuracy = ?, loss = ? WHERE id = ?', ['completed', accuracy, 0.08, modelId]);
      io.emit('ml:model_updated', { id: modelId, status: 'completed', accuracy, loss: 0.08 });
    }, 5000);
    res.json({ modelId });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});
app.post('/api/models/deploy', authenticateToken, async (req, res) => {
  res.json({ message: 'Deployed' });
});

// ==========================================
// Reports Routes (/api/v1/reports/...)
// ==========================================

app.post('/api/v1/reports/generate', authenticateToken, (req, res) => {
  sendSuccess(res, { reportId: Math.round(Math.random() * 1000) }, 'Report compilation completed');
});

app.get('/api/v1/reports/download/:id', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.id}.csv`);
  res.status(200).send('Timestamp,Voltage,Current,Power,Energy\n17:15:00,229.4,2.36,541,7.82');
});

app.get('/api/v1/reports', authenticateToken, (req, res) => {
  sendSuccess(res, [
    { id: 1, type: 'Monthly Analysis', generated_by: 'Admin', generated_at: new Date().toISOString() }
  ]);
});

// ==========================================
// Alerts Routes (/api/v1/alerts/...)
// ==========================================

app.get('/api/v1/alerts', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const alerts = await db.all('SELECT * FROM alerts ORDER BY timestamp DESC');
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.put('/api/v1/alerts/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('UPDATE alerts SET resolved = 1 WHERE id = ?', [id]);
    io.emit('alert_update', { id, status: 'resolved' });
    sendSuccess(res, {}, 'Alert resolved successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

app.delete('/api/v1/alerts/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.run('DELETE FROM alerts WHERE id = ?', [id]);
    sendSuccess(res, {}, 'Alert deleted successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// ==========================================
// Settings Routes (/api/v1/settings/...)
// ==========================================

app.get('/api/v1/settings', authenticateToken, (req, res) => {
  sendSuccess(res, {
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    tariffRate: 6.50
  });
});

app.put('/api/v1/settings', authenticateToken, (req, res) => {
  sendSuccess(res, {}, 'Settings saved successfully');
});

// ==========================================
// Socket.IO updates and simulation
// ==========================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const sendCurrentState = async () => {
    try {
      const db = getDb();
      const sensors = await db.all('SELECT * FROM sensors');
      const devices = await db.all('SELECT * FROM devices');
      socket.emit('telemetry:init', { sensors, devices });
      socket.emit('device_status', { status: 'online', devices });
    } catch (e) {
      console.error('Socket init error:', e);
    }
  };
  
  sendCurrentState();

  socket.on('telemetry:ping', (timestamp: number) => {
    socket.emit('telemetry:pong', timestamp);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Telemetry simulation loop
async function runTelemetrySimulation() {
  const db = getDb();
  setInterval(async () => {
    try {
      const sensors = await db.all('SELECT * FROM sensors');
      for (const sensor of sensors) {
        let delta = 0;
        switch (sensor.type) {
          case 'power':
            delta = (Math.random() - 0.5) * 15; // Power fluctuate
            break;
          case 'temperature':
            delta = (Math.random() - 0.5) * 0.4;
            break;
          case 'humidity':
            delta = (Math.random() - 0.5) * 1.0;
            break;
          case 'efficiency':
            delta = (Math.random() - 0.5) * 0.8;
            break;
          default:
            delta = (Math.random() - 0.5) * 2;
        }

        const multiplier = sensor.calibrationMultiplier || 1.0;
        let newValue = Math.max(0, parseFloat((sensor.value + delta).toFixed(2)));
        if (sensor.type === 'efficiency') newValue = Math.min(100, newValue);

        const calibratedValue = parseFloat((newValue * multiplier).toFixed(2));

        await db.run('UPDATE sensors SET value = ?, lastUpdated = CURRENT_TIMESTAMP WHERE id = ?', [newValue, sensor.id]);
        await db.run('INSERT INTO sensor_history (sensorId, value) VALUES (?, ?)', [sensor.id, calibratedValue]);

        await db.run(`
          DELETE FROM sensor_history 
          WHERE sensorId = ? AND id NOT IN (
            SELECT id FROM sensor_history WHERE sensorId = ? ORDER BY timestamp DESC LIMIT 100
          )
        `, [sensor.id, sensor.id]);

        let alertSeverity: 'warning' | 'critical' | null = null;
        let alertMsg = '';

        if (sensor.criticalHigh !== null && calibratedValue >= sensor.criticalHigh) {
          alertSeverity = 'critical';
          alertMsg = `CRITICAL: ${sensor.name} high limit exceeded (${calibratedValue} ${sensor.unit})`;
        } else if (sensor.warningHigh !== null && calibratedValue >= sensor.warningHigh) {
          alertSeverity = 'warning';
          alertMsg = `WARNING: ${sensor.name} warning limit exceeded (${calibratedValue} ${sensor.unit})`;
        } else if (sensor.criticalLow !== null && calibratedValue <= sensor.criticalLow) {
          alertSeverity = 'critical';
          alertMsg = `CRITICAL: ${sensor.name} low limit drop (${calibratedValue} ${sensor.unit})`;
        } else if (sensor.warningLow !== null && calibratedValue <= sensor.warningLow) {
          alertSeverity = 'warning';
          alertMsg = `WARNING: ${sensor.name} warning limit drop (${calibratedValue} ${sensor.unit})`;
        }

        if (alertSeverity && alertMsg) {
          const existing = await db.get(
            'SELECT * FROM alerts WHERE sensorId = ? AND resolved = 0 ORDER BY timestamp DESC LIMIT 1',
            [sensor.id]
          );
          
          if (!existing) {
            const alertResult = await db.run(
              'INSERT INTO alerts (sensorId, deviceId, type, severity, message) VALUES (?, ?, ?, ?, ?)',
              [sensor.id, sensor.deviceId, sensor.type, alertSeverity, alertMsg]
            );

            io.emit('telemetry:alert', {
              id: alertResult.lastID,
              sensorId: sensor.id,
              deviceId: sensor.deviceId,
              type: sensor.type,
              severity: alertSeverity,
              message: alertMsg,
              timestamp: new Date().toISOString(),
              resolved: 0
            });
            io.emit('alert_update', { id: alertResult.lastID, severity: alertSeverity, message: alertMsg });
          }
        }
      }

      const updatedSensors = await db.all('SELECT * FROM sensors');
      io.emit('telemetry:update', updatedSensors);
      io.emit('sensor_update', updatedSensors);
    } catch (e) {
      console.error('Telemetry simulation error:', e);
    }
  }, 3000);
}

// Start Server
async function start() {
  try {
    await initDb();
    
    const db = getDb();
    const adminCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (adminCount.count === 0) {
      const hashedPassword = await hashPassword('admin123');
      await db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@aiblend.com', hashedPassword, 'admin']
      );
      console.log('Seeded default admin user: admin / admin123');
    }

    server.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
      runTelemetrySimulation();
    });
  } catch (error) {
    console.error('Failed to start backend server:', error);
  }
}

start();
