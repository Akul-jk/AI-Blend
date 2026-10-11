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

  // Create/Update tables
  await db.exec(`
    -- Existing tables preserved
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId TEXT,
      deviceId TEXT,
      appliance_id INTEGER,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0
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

    -- New tables
    CREATE TABLE IF NOT EXISTS esp32_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip_address TEXT,
      firmware_version TEXT,
      status TEXT NOT NULL,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pzem_devices (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      esp32_device_id TEXT,
      status TEXT NOT NULL,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (esp32_device_id) REFERENCES esp32_devices(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS circuits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pzem_id TEXT,
      description TEXT,
      location TEXT,
      FOREIGN KEY (pzem_id) REFERENCES pzem_devices(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS appliance_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT,
      default_power_range TEXT
    );

    CREATE TABLE IF NOT EXISTS appliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      description TEXT,
      location TEXT,
      image_url TEXT,
      pzem_id TEXT,
      circuit_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pzem_id) REFERENCES pzem_devices(id) ON DELETE SET NULL,
      FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS appliance_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appliance_id INTEGER NOT NULL,
      rated_voltage REAL,
      rated_current REAL,
      rated_power REAL,
      rated_frequency REAL,
      rated_power_factor REAL,
      standby_power REAL,
      FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      pzem_id TEXT,
      appliance_id INTEGER,
      voltage REAL NOT NULL,
      current REAL NOT NULL,
      power REAL NOT NULL,
      energy REAL NOT NULL,
      frequency REAL NOT NULL,
      power_factor REAL NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (pzem_id) REFERENCES pzem_devices(id) ON DELETE SET NULL,
      FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appliance_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      predicted_power REAL NOT NULL,
      confidence REAL NOT NULL,
      FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appliance_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      anomaly_type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tariffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      fixed_charge REAL NOT NULL,
      meter_rent REAL NOT NULL,
      fuel_surcharge REAL NOT NULL,
      electricity_duty_percent REAL NOT NULL,
      green_tariff_optional REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tariff_slabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tariff_id INTEGER NOT NULL,
      is_telescopic INTEGER NOT NULL,
      min_units REAL NOT NULL,
      max_units REAL,
      rate REAL NOT NULL,
      FOREIGN KEY (tariff_id) REFERENCES tariffs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS training_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      status TEXT NOT NULL,
      accuracy REAL,
      loss REAL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appliance_measurement_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appliance_id INTEGER NOT NULL,
      pzem_id TEXT,
      circuit_id INTEGER,
      valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      valid_to DATETIME,
      FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE,
      FOREIGN KEY (pzem_id) REFERENCES pzem_devices(id) ON DELETE SET NULL,
      FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE SET NULL
    );
  `);

  // Additive migration: existing cumulative energy is preserved and interval
  // energy is derived from each meter's ordered register readings.
  const telemetryColumns = await db.all('PRAGMA table_info(telemetry)');
  const ensureTelemetryColumn = async (name: string, ddl: string) => {
    if (!telemetryColumns.some((column: { name: string }) => column.name === name)) await db.exec(`ALTER TABLE telemetry ADD COLUMN ${ddl}`);
  };
  await ensureTelemetryColumn('device_id', 'device_id TEXT');
  await ensureTelemetryColumn('circuit_id', 'circuit_id INTEGER');
  await ensureTelemetryColumn('received_at', 'received_at DATETIME');
  if (!telemetryColumns.some((column: { name: string }) => column.name === 'interval_energy_kwh')) {
    await db.exec('ALTER TABLE telemetry ADD COLUMN interval_energy_kwh REAL');
    await db.exec(`
      WITH ordered AS (
        SELECT id, energy, power, timestamp,
          LAG(energy) OVER (PARTITION BY COALESCE(pzem_id, 'appliance:' || appliance_id) ORDER BY timestamp, id) AS previous_energy,
          LAG(timestamp) OVER (PARTITION BY COALESCE(pzem_id, 'appliance:' || appliance_id) ORDER BY timestamp, id) AS previous_timestamp
        FROM telemetry
      )
      UPDATE telemetry
      SET interval_energy_kwh = (SELECT energy - previous_energy FROM ordered WHERE ordered.id = telemetry.id)
      WHERE id IN (SELECT id FROM ordered WHERE previous_energy IS NOT NULL AND energy >= previous_energy
        AND (julianday(timestamp) - julianday(previous_timestamp)) > 0
        AND energy - previous_energy <= (MAX(power, 1) * ((julianday(timestamp) - julianday(previous_timestamp)) * 24) / 1000 * 3) + 0.02)
    `);
  }
  if (!telemetryColumns.some((column: { name: string }) => column.name === 'quality')) {
    await db.exec("ALTER TABLE telemetry ADD COLUMN quality TEXT NOT NULL DEFAULT 'valid'");
    await db.exec("UPDATE telemetry SET quality = 'baseline' WHERE interval_energy_kwh IS NULL");
    await db.exec("UPDATE telemetry SET quality = 'counter_reset' WHERE id IN (SELECT id FROM (SELECT id, energy, LAG(energy) OVER (PARTITION BY COALESCE(pzem_id, 'appliance:' || appliance_id) ORDER BY timestamp, id) AS prior FROM telemetry) WHERE prior IS NOT NULL AND energy < prior)");
    await db.exec("UPDATE telemetry SET quality = 'energy_jump' WHERE interval_energy_kwh IS NULL AND id IN (SELECT id FROM (SELECT id, energy, LAG(energy) OVER (PARTITION BY COALESCE(pzem_id, 'appliance:' || appliance_id) ORDER BY timestamp, id) AS prior FROM telemetry) WHERE prior IS NOT NULL AND energy >= prior)");
  }
  await db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_appliance_time ON telemetry(appliance_id, timestamp DESC)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_pzem_time ON telemetry(pzem_id, timestamp DESC)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, timestamp DESC)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry(timestamp DESC)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_assignment_appliance_time ON appliance_measurement_assignments(appliance_id, valid_from DESC)');
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_one_current_per_appliance ON appliance_measurement_assignments(appliance_id) WHERE valid_to IS NULL');
  await db.run(`INSERT INTO appliance_measurement_assignments(appliance_id, pzem_id, circuit_id, valid_from)
    SELECT a.id, a.pzem_id, a.circuit_id, COALESCE(a.updated_at, CURRENT_TIMESTAMP) FROM appliances a
    WHERE (a.pzem_id IS NOT NULL OR a.circuit_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM appliance_measurement_assignments m WHERE m.appliance_id = a.id AND m.valid_to IS NULL)`);
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  await db.run('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)');
  const duplicateRatings = await db.get('SELECT appliance_id FROM appliance_ratings GROUP BY appliance_id HAVING COUNT(*) > 1 LIMIT 1');
  if (!duplicateRatings) await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_appliance_ratings_one_per_appliance ON appliance_ratings(appliance_id)');

  // Seeding initial data if categories are empty
  const catCount = await db.get('SELECT COUNT(*) as count FROM appliance_categories');
  if (catCount.count === 0) {
    console.log('Seeding Smart Energy Monitor initial data...');

    // Categories
    const categories = [
      ['Laptop', 'laptop_mac', '50-100W'],
      ['Phone Charger', 'smartphone', '5-20W'],
      ['Refrigerator', 'kitchen', '100-800W'],
      ['Mixer Grinder', 'blender', '500-1000W'],
      ['Iron Box', 'iron', '1000-2000W'],
      ['Lighting', 'lightbulb', '9-40W'],
      ['Kettle', 'coffee_maker', '1500-2000W'],
      ['Fan', 'mode_fan', '50-100W'],
      ['TV', 'tv', '50-200W'],
      ['Washing Machine', 'local_laundry_service', '500-2000W'],
      ['AC', 'ac_unit', '1000-3000W'],
      ['Water Heater', 'hot_tub', '1500-3000W'],
      ['Microwave', 'microwave', '800-1200W'],
      ['Other', 'devices_other', '0-1000W']
    ];

    for (const cat of categories) {
      await db.run('INSERT OR IGNORE INTO appliance_categories (name, icon, default_power_range) VALUES (?, ?, ?)', cat);
    }

    // Devices
    await db.run("INSERT OR IGNORE INTO esp32_devices (id, name, ip_address, firmware_version, status) VALUES ('ESP32-SIM-001', 'Main Hub', '192.168.1.100', 'v1.0.0', 'online')");

    for (let i = 1; i <= 14; i++) {
      const pzemId = `PZEM-${String(i).padStart(3, '0')}`;
      await db.run("INSERT OR IGNORE INTO pzem_devices (id, address, esp32_device_id, status) VALUES (?, ?, 'ESP32-SIM-001', 'online')", [pzemId, `0x0${i}`]);
    }

    // Appliances & Ratings
    const seedApps = [
      { name: 'Samsung Refrigerator', cat: 'Refrigerator', mfg: 'Samsung', pzem: 'PZEM-001', v: 230, c: 0.65, p: 150, f: 50 },
      { name: 'Dell XPS 15', cat: 'Laptop', mfg: 'Dell', pzem: 'PZEM-002', v: 230, c: 0.28, p: 65, f: 50 },
      { name: 'Living Room Fan', cat: 'Fan', mfg: 'Crompton', pzem: 'PZEM-003', v: 230, c: 0.33, p: 75, f: 50 },
      { name: 'Bedroom LED', cat: 'Lighting', mfg: 'Philips', pzem: 'PZEM-004', v: 230, c: 0.43, p: 100, f: 50 },
      { name: 'Smart TV', cat: 'TV', mfg: 'LG', pzem: 'PZEM-005', v: 230, c: 0.52, p: 120, f: 50 },
      { name: 'Phone Charger', cat: 'Phone Charger', mfg: 'Samsung', pzem: 'PZEM-006', v: 230, c: 0.08, p: 18, f: 50 },
      { name: 'Preethi Zodiac', cat: 'Mixer Grinder', mfg: 'Preethi', pzem: 'PZEM-007', v: 230, c: 3.2, p: 750, f: 50 },
      { name: 'Philips Iron', cat: 'Iron Box', mfg: 'Philips', pzem: 'PZEM-008', v: 230, c: 4.3, p: 1000, f: 50 },
      { name: 'Pigeon Kettle', cat: 'Kettle', mfg: 'Pigeon', pzem: 'PZEM-009', v: 230, c: 6.5, p: 1500, f: 50 },
      { name: 'LG Washing Machine', cat: 'Washing Machine', mfg: 'LG', pzem: 'PZEM-010', v: 230, c: 8.7, p: 2000, f: 50 },
      { name: 'Voltas Split AC', cat: 'AC', mfg: 'Voltas', pzem: 'PZEM-011', v: 230, c: 6.5, p: 1500, f: 50 },
      { name: 'V-Guard Heater', cat: 'Water Heater', mfg: 'V-Guard', pzem: 'PZEM-012', v: 230, c: 8.7, p: 2000, f: 50 },
      { name: 'Samsung Microwave', cat: 'Microwave', mfg: 'Samsung', pzem: 'PZEM-013', v: 230, c: 3.5, p: 800, f: 50 },
      { name: 'Generic Load', cat: 'Other', mfg: 'Generic', pzem: 'PZEM-014', v: 230, c: 0.43, p: 100, f: 50 }
    ];

    for (const app of seedApps) {
      const result = await db.run(
        "INSERT OR IGNORE INTO appliances (name, category, manufacturer, pzem_id, status) VALUES (?, ?, ?, ?, 'active')",
        [app.name, app.cat, app.mfg, app.pzem]
      );
      await db.run(
        "INSERT OR IGNORE INTO appliance_ratings (appliance_id, rated_voltage, rated_current, rated_power, rated_frequency, rated_power_factor, standby_power) VALUES (?, ?, ?, ?, ?, 0.9, 0)",
        [result.lastID, app.v, app.c, app.p, app.f]
      );
    }

    // The general assignment backfill runs before seed appliances exist.
    // Create their initial effective meter assignments after seeding so the
    // simulator can safely emit telemetry on a fresh database.
    await db.run(`INSERT INTO appliance_measurement_assignments(appliance_id, pzem_id, circuit_id, valid_from)
      SELECT a.id, a.pzem_id, a.circuit_id, COALESCE(a.updated_at, CURRENT_TIMESTAMP) FROM appliances a
      WHERE (a.pzem_id IS NOT NULL OR a.circuit_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM appliance_measurement_assignments m WHERE m.appliance_id = a.id AND m.valid_to IS NULL)`);

    // Tariff Seeding (KSEB)
    const tariffResult = await db.run(
      "INSERT OR IGNORE INTO tariffs (name, type, fixed_charge, meter_rent, fuel_surcharge, electricity_duty_percent, green_tariff_optional) VALUES ('KSEB LT-I Domestic', 'domestic', 50, 6, 0.10, 5, 0.77)"
    );
    const tariffId = tariffResult.lastID;

    // Telescopic slabs (0-250)
    const telescopicSlabs = [
      { min: 0, max: 50, rate: 3.35 },
      { min: 51, max: 100, rate: 4.25 },
      { min: 101, max: 150, rate: 5.35 },
      { min: 151, max: 200, rate: 7.20 },
      { min: 201, max: 250, rate: 8.50 }
    ];
    for (const slab of telescopicSlabs) {
      await db.run(
        "INSERT OR IGNORE INTO tariff_slabs (tariff_id, is_telescopic, min_units, max_units, rate) VALUES (?, 1, ?, ?, ?)",
        [tariffId, slab.min, slab.max, slab.rate]
      );
    }

    // Non-Telescopic slabs (250+)
    const nonTelescopicSlabs = [
      { min: 251, max: 300, rate: 6.75 },
      { min: 301, max: 350, rate: 7.60 },
      { min: 351, max: 400, rate: 7.95 },
      { min: 401, max: 500, rate: 8.25 },
      { min: 501, max: 999999, rate: 9.20 }
    ];
    for (const slab of nonTelescopicSlabs) {
      await db.run(
        "INSERT OR IGNORE INTO tariff_slabs (tariff_id, is_telescopic, min_units, max_units, rate) VALUES (?, 0, ?, ?, ?)",
        [tariffId, slab.min, slab.max, slab.rate]
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

export async function closeDb() {
  if (db) {
    await db.close();
    db = undefined as unknown as Database<sqlite3.Database, sqlite3.Statement>;
  }
}
