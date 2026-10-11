# Smart Energy Monitor

Smart Energy Monitor collects simulated or authenticated meter readings, stores them in SQLite, streams them to a React dashboard, and can train an LSTM to forecast the next interval's energy use.

## Architecture and telemetry contract

The backend simulator and authenticated ingestion endpoint use the same persistence service:

```text
Simulation or authenticated meter → canonical telemetry validation → SQLite → REST / Socket.IO → React
                                                                              ↘ ML dataset export → training / prediction
```

Canonical units are volts, amperes, watts, hertz, power factor (0–1), and kWh. The existing `energy` field remains the **cumulative meter register** for compatibility. `interval_energy_kwh` is a separate derived value computed from consecutive registers. The first observation is a baseline; resets and implausible jumps have no interval value and carry a quality status. Analytics and billing sum only valid interval values.

`POST /api/v1/telemetry` is the future ESP32/PZEM ingestion boundary. It requires an authenticated user token. Hardware readings must include an existing `device_id` and `pzem_id`; configured PZEM-to-hub assignments, known appliance/circuit IDs, numeric ranges, physical power consistency, ISO 8601 timestamps, stale/future timestamps, duplicates, register resets, and large jumps are checked. **Hardware has not been verified against physical equipment.**

Logical appliance identity and nameplate ratings are stored separately from telemetry. PZEM/circuit assignments are manually configured and recorded with effective dates in `appliance_measurement_assignments`; meters do not identify products.

## Requirements

- Node.js and npm compatible with the lockfiles.
- Python 3.11 recommended for the ML service and its TensorFlow 2.18 dependency.
- Windows PowerShell commands below assume the repository root.

Install JavaScript dependencies with `npm install` in `backend` and `frontend` if they are not already installed.

## Environment

Backend variables:

| Variable | Purpose | Default / rule |
| --- | --- | --- |
| `PORT` | HTTP port | `5000` |
| `DB_FILE` | SQLite file under `backend` (or an absolute path) | `database.sqlite` |
| `JWT_SECRET` | Token signing secret | Optional in development (random per process); required in production and at least 32 characters |
| `ADMIN_PASSWORD` | Explicit first-admin bootstrap | Optional; if set, at least 16 characters |
| `ADMIN_USERNAME`, `ADMIN_EMAIL` | Bootstrap identity | `admin`, `admin@localhost` |
| `FRONTEND_ORIGINS` | Comma-separated trusted origins | `http://localhost:3000`; required explicitly in production; `*` rejected in production |
| `PASSWORD_RESET_WEBHOOK_URL` | Password recovery delivery endpoint | If absent, recovery returns unavailable; codes are never displayed or logged |
| `SIMULATION_INTERVAL_MS` | Simulator cadence | `5000` |
| `SIMULATION_SEED` | Deterministic simulation noise seed | `42` |
| `MODEL_STORE_DIR` | Persistent versioned ML model registry and artifact store | `ml-service/models/managed` |
| `TELEMETRY_RETENTION_DAYS` | Bounded telemetry retention | `30`, clamped to 1–365 days |
| `ML_SERVICE_URL` | ML service origin | `http://localhost:8000` |
| `ML_INTERNAL_TOKEN` | Shared backend-to-ML token for model-management routes | Must be the same random secret of at least 32 characters in both services; otherwise management APIs return unavailable |

Frontend variables are optional and contain server origins (without `/api/v1`): `VITE_API_URL` and `VITE_SOCKET_URL`. Both default to `http://localhost:5000`.

The ML process reads `DB_FILE`, `SIMULATION_INTERVAL_MS`, `MODEL_STORE_DIR`, and `ML_INTERNAL_TOKEN` from its environment. If `DB_FILE` is unset, it reads `backend/database.sqlite` relative to the ML service directory. Keep the cadence value identical in backend and ML environments. `MODEL_STORE_DIR` must point to persistent local storage; managed model versions and the active registry are stored there. The model-management routes are accessed through the authenticated Express backend and require `ML_INTERNAL_TOKEN` to be configured identically in both services.

## Run services

Start each service in a separate terminal. Starting the backend initializes/migrates its configured SQLite database and starts simulation writes; use a disposable database if you do not want the local database modified.

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Create/activate a Python virtual environment, install `ml-service/requirements.txt`, then run:

```powershell
cd ml-service
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Fresh databases receive the demo appliance/device inventory and tariff. Public registration creates a normal `user`; it cannot choose administrator. To bootstrap the first admin, configure `ADMIN_PASSWORD` explicitly before starting the backend.

## Simulation, data and retention

The backend is the sole telemetry simulator. Appliance profiles produce electrical readings with `power ≈ voltage × current × power_factor`; cumulative kWh advances by power and elapsed configured interval. Source is marked `simulation`. The ML dataset generator exports valid simulated rows from the backend SQLite database as `ml-service/datasets/simulation/canonical_simulation_telemetry.csv`; it does not create an independent Python simulation. Exported datasets use the simulator's cadence and canonical units.

The database keeps 30 days by default, with query indexes on meter/appliance/device and time. Daily analytics and current-month billing use interval deltas. CSV exports are generated from database telemetry at download time and are not stored as report history.

## ML training and predictions

The active model is versioned under `ml-service/models/simulation/energy_lstm_sim_v1/`. Training uses per-appliance chronological 70/15/15 splits, train-only feature and target scalers, 60 observations, 100 maximum epochs, and batch size 32 with early stopping, checkpointing, and learning-rate reduction. The target is the next valid interval's energy in kWh. Dataset generation/training requires enough valid telemetry with the configured uniform cadence. Model metadata records feature order, target, dataset hash, cadence, horizon, source, training time, and evaluated metrics. Predictions are unavailable until compatible model and scaler artifacts exist; the UI does not show fabricated forecasts or confidence.

Use the authenticated admin actions in the Training page to export a dataset and request training. Training runs in the ML service background. Model metadata and metrics become available after a successful run.

## Billing and settings

Billing uses the persisted tariff configuration and month-to-date valid interval consumption. Fresh seeded tariff values use the specified KSEB slab rates, ₹0.10/unit fuel surcharge, 5% duty, ₹50 fixed charge, ₹6 single-phase meter rent, ₹15 three-phase meter rent, and optional ₹0.77/unit green charge. Above 250 units the configured bracket rate applies to all units; there are no separate invented three-phase energy slabs. Tariffs can be edited by an admin in Settings and are updated transactionally. Bill figures are estimates based on configured rates; verify rates for actual billing.

## Database migrations

Initialization is additive and idempotent. Existing cumulative `energy` values are preserved; interval energy is backfilled using ordered readings where a nonnegative, plausible delta exists. Baselines, resets, and implausible jumps are labeled without deleting historical readings. Schema migration markers and indexes are stored in SQLite. Existing accounts and data are not reset by migrations. The previously seeded `admin` account is denied while it still has the known `admin123` password; supplying an explicit strong `ADMIN_PASSWORD` rotates that specific legacy credential at startup.

## Verification and limitations

Run TypeScript checks with `npx tsc --noEmit -p tsconfig.json` in `backend` and `npx tsc --noEmit -p tsconfig.app.json` in `frontend`. Run the frontend production build with `npm run build` in `frontend`.

Current limitations: physical hardware, firmware, Wi-Fi health, archived storage outside the bounded SQLite retention, persistent report history, and a persisted anomaly workflow are not implemented. Password recovery requires an explicitly configured delivery webhook. Legacy non-routed page files remain in the source tree and are not the active routed pages.
