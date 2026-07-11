import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbFile = process.env.DB_FILE || 'database.sqlite';
const dbPath = path.resolve(__dirname, '..', dbFile);

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDb() {
  const dbExists = fs.existsSync(dbPath);
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  if (!dbExists) {
    console.log('Database file not found. Creating database structure...');
  }

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensors (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      unit TEXT NOT NULL,
      value REAL NOT NULL,
      lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
      warningLow REAL DEFAULT NULL,
      warningHigh REAL DEFAULT NULL,
      criticalLow REAL DEFAULT NULL,
      criticalHigh REAL DEFAULT NULL,
      calibrationMultiplier REAL DEFAULT 1.0,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sensor_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId TEXT NOT NULL,
      value REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sensorId) REFERENCES sensors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0,
      FOREIGN KEY (sensorId) REFERENCES sensors(id) ON DELETE CASCADE,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filePath TEXT NOT NULL,
      rowCount INTEGER NOT NULL,
      sizeBytes INTEGER NOT NULL,
      uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      accuracy REAL,
      loss REAL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Populate initial devices and sensors if empty
  const deviceCount = await db.get('SELECT COUNT(*) as count FROM devices');
  if (deviceCount.count === 0) {
    console.log('Seeding initial devices and sensors...');
    
    const initialDevices = [
      { id: 'dev-001', name: 'Main Power Grid Link', type: 'Grid Connector', status: 'online', location: 'Substation A' },
      { id: 'dev-002', name: 'HVAC Control Unit 1', type: 'Climate Controller', status: 'online', location: 'Building B - Floor 2' },
      { id: 'dev-003', name: 'Solar Array Inverter', type: 'Inverter', status: 'online', location: 'Rooftop West' },
      { id: 'dev-004', name: 'Backup Diesel Generator', type: 'Generator', status: 'offline', location: 'Substation B' }
    ];

    for (const d of initialDevices) {
      await db.run(
        'INSERT INTO devices (id, name, type, status, location) VALUES (?, ?, ?, ?, ?)',
        [d.id, d.name, d.type, d.status, d.location]
      );
    }

    const initialSensors = [
      { id: 'sns-001', deviceId: 'dev-001', name: 'Active Power Draw', type: 'power', unit: 'kW', value: 342.5, warningHigh: 400, criticalHigh: 450 },
      { id: 'sns-002', deviceId: 'dev-001', name: 'Grid Frequency', type: 'frequency', unit: 'Hz', value: 50.02, warningLow: 49.8, warningHigh: 50.2 },
      { id: 'sns-003', deviceId: 'dev-002', name: 'Ambient Temperature', type: 'temperature', unit: '°C', value: 21.8, warningHigh: 30, criticalHigh: 35 },
      { id: 'sns-004', deviceId: 'dev-002', name: 'Relative Humidity', type: 'humidity', unit: '%', value: 45.2, warningHigh: 80 },
      { id: 'sns-005', deviceId: 'dev-003', name: 'Solar Power Output', type: 'power', unit: 'kW', value: 124.8 },
      { id: 'sns-006', deviceId: 'dev-003', name: 'Solar Efficiency', type: 'efficiency', unit: '%', value: 88.5 },
      { id: 'sns-007', deviceId: 'dev-004', name: 'Generator Fuel Level', type: 'fuel', unit: '%', value: 75.0, warningLow: 20 }
    ];

    for (const s of initialSensors) {
      await db.run(
        `INSERT INTO sensors (
          id, deviceId, name, type, unit, value, 
          warningLow, warningHigh, criticalLow, criticalHigh, calibrationMultiplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.deviceId, s.name, s.type, s.unit, s.value,
          (s as any).warningLow ?? null, (s as any).warningHigh ?? null,
          (s as any).criticalLow ?? null, (s as any).criticalHigh ?? null,
          1.0
        ]
      );
      // Seed initial history
      await db.run(
        'INSERT INTO sensor_history (sensorId, value) VALUES (?, ?)',
        [s.id, s.value]
      );
    }
  }

  console.log('Database initialized successfully.');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
