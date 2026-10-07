import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, getDb } from './db';
import { assertAuthConfiguration, comparePassword, hashPassword, verifyToken } from './auth';

// Route Imports
import authRoutes from './routes/auth';
import applianceRoutes from './routes/appliances';
import applianceCategoryRoutes from './routes/appliance-categories';
import deviceRoutes from './routes/devices';
import telemetryRoutes from './routes/telemetry';
import analyticsRoutes from './routes/analytics';
import tariffRoutes from './routes/tariff';
import mlRoutes from './routes/ml';
import alertsRoutes from './routes/alerts';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import datasetsRoutes from './routes/datasets';

// Simulation Engine
import { runSimulationEngine } from './simulation/engine';
import { setTelemetryBroadcaster } from './services/telemetry';

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
export const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});
setTelemetryBroadcaster(io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Global API Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[API REQUEST] [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Register Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/appliances', applianceRoutes);
app.use('/api/v1/appliance-categories', applianceCategoryRoutes);
app.use('/api/v1', deviceRoutes); // contains /devices, /system/status
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/tariff', tariffRoutes);
app.use('/api/v1/ml', mlRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/dataset', datasetsRoutes);

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const sendCurrentState = async () => {
    try {
      const db = getDb();
      const appliances = await db.all('SELECT * FROM appliances');
      const latestTelemetry = await db.all(`SELECT t.* FROM telemetry t WHERE t.id = (SELECT t2.id FROM telemetry t2 WHERE COALESCE(t2.pzem_id, 'appliance:' || t2.appliance_id) = COALESCE(t.pzem_id, 'appliance:' || t.appliance_id) ORDER BY t2.timestamp DESC, t2.id DESC LIMIT 1) ORDER BY t.timestamp DESC`);

      socket.emit('telemetry:init', { appliances, latestTelemetry });
      socket.emit('device_status', { status: 'online' });
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

// Start Server
async function start() {
  try {
    assertAuthConfiguration();
    if (process.env.NODE_ENV === 'production' && (!process.env.FRONTEND_ORIGINS || allowedOrigins.includes('*'))) {
      throw new Error('FRONTEND_ORIGINS must list explicit trusted origins in production; wildcard CORS is not allowed');
    }
    await initDb();

    const db = getDb();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
      if (!adminCount || adminCount.count === 0) {
        const username = process.env.ADMIN_USERNAME || 'admin';
        const email = process.env.ADMIN_EMAIL || 'admin@localhost';
        const hashedPassword = await hashPassword(adminPassword);
        await db.run(
          'INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, 'admin']
        );
        console.log('Bootstrapped admin account from explicit environment configuration.');
      } else {
        const legacyAdmin = await db.get("SELECT id, password FROM users WHERE username = 'admin' AND role = 'admin'");
        if (legacyAdmin && await comparePassword('admin123', legacyAdmin.password)) {
          const hashedPassword = await hashPassword(adminPassword);
          await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, legacyAdmin.id]);
          console.log('Replaced the known legacy admin password using explicit ADMIN_PASSWORD configuration.');
        }
      }
    }

    server.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
      // Start new telemetry simulation engine
      runSimulationEngine(io);
    });
  } catch (error) {
    console.error('Failed to start backend server:', error);
  }
}

start();
