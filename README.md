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

Install JavaScript dependencies from the checked-in lockfiles with `npm ci` in `backend`. For `frontend`, use `npm ci --legacy-peer-deps`: the current lockfile resolves React 19 with `lucide-react@0.363.0`, whose published peer range ends at React 18. Do not run `npm audit fix` as part of setup because it can change the lockfile.

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
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio API credentials for optional India SMS | Backend only; keep secrets out of source control |
| `TWILIO_DLT_SENDER_ID` | DLT registered alphanumeric sender header | Must be registered with the DLT portal and Twilio for domestic India delivery |
| `TWILIO_DLT_ENTITY_ID`, `TWILIO_DLT_TEMPLATE_ID` | DLT Principal Entity ID and approved content template ID | Both are required; template must be whitelisted for the sender ID |

### SMS delivery in India

The Alerts page accepts Indian mobile numbers in `+91XXXXXXXXXX` format. SMS delivery is disabled until all five Twilio settings above are present. Users must explicitly opt in; only warning or critical alerts marked as hardware-originated are sent. Simulated and replay alerts remain in the app. Do not enter credentials or DLT identifiers into the frontend.

For domestic India delivery, register the organization/entity, alphanumeric sender ID and service/transactional use case in a DLT portal, create the approved message template, and complete Twilio's India sender registration/whitelisting process. Twilio's India guidelines require DLT registration for domestic sender IDs and restrict their use to the DLT-approved case ([India SMS guidelines](https://www.twilio.com/en-us/guidelines/in/sms)); Twilio's registration instructions describe the Entity ID, Template ID, sender registration, and template whitelisting steps ([Twilio India registration](https://help.twilio.com/articles/21162166457755-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-India)).

The application sends this fixed template with one variable slot; register the exact final text with your DLT portal and Twilio before enabling delivery:

```text
Smart Energy Monitor alert: {#var#}. Review the Alerts page in your account.
```

Set `TWILIO_DLT_SENDER_ID` to the approved alphanumeric header, `TWILIO_DLT_ENTITY_ID` to the Principal Entity ID (sent to Twilio as `DltPEId`), and `TWILIO_DLT_TEMPLATE_ID` to the approved DLT content template ID. A mismatch or unapproved template will be rejected by Twilio/carriers. The repository does not contain provider credentials or DLT registration values, so SMS remains unavailable until the account owner completes registration and supplies these values through the backend's private environment configuration.

Frontend variables are optional and contain server origins (without `/api/v1`): `VITE_API_URL` and `VITE_SOCKET_URL`. Both default to `http://localhost:5000`.

The ML process reads `DB_FILE`, `SIMULATION_INTERVAL_MS`, `MODEL_STORE_DIR`, and `ML_INTERNAL_TOKEN` from its environment. If `DB_FILE` is unset, it reads `backend/database.sqlite` relative to the ML service directory. Keep the cadence value identical in backend and ML environments. `MODEL_STORE_DIR` must point to persistent local storage; managed model versions and the active registry are stored there. The model-management routes are accessed through the authenticated Express backend and require `ML_INTERNAL_TOKEN` to be configured identically in both services.

## Run services

Start each service in a separate terminal. Starting the backend initializes/migrates its configured SQLite database and starts simulation writes; use a disposable database if you do not want the local database modified.

For a timed walkthrough, presenter script, feature explanations, and faculty Q&A, see [docs/faculty-demo-guide.md](docs/faculty-demo-guide.md).

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

### Phone alerts and energy insights

The AI Insights page shows deterministic, explainable summaries from valid readings: highest measured appliance use and unusual-use comparisons only when the seven-day baseline and coverage requirements are met. It labels simulation data and does not report invented savings or model-generated advice. Alert Center lets each account save an Indian mobile number in `+91` format and explicitly opt in to SMS. The backend sends only hardware-origin alerts, only to users who opted in, and only when the Twilio credentials and all India DLT settings are configured. Alert details are sent to Twilio and the configured phone number; simulated and replay alerts remain in the app. Delivery attempts are deduplicated per alert and user. Configure Twilio credentials privately in the backend environment; never commit credentials to the repository.

### Synthetic dataset replay

Open **Live Monitoring** and use the **Synthetic dataset replay** controls to start, pause, resume, restart, and change speed (0.25×–10×). Replay reads `ml-service/datasets/simulation/canonical_simulation_telemetry.csv` without modifying it. It broadcasts timestamp-ordered readings on the separate `telemetry:replay` Socket.IO event and does not write to SQLite, update cumulative registers, or use the authenticated hardware ingestion endpoint. Switch the chart selector to **Dataset replay** to view replay values. Replay rows keep their original historical timestamps and are labeled as replay.

The checked-in dataset contains 6,314 rows for 14 appliance IDs, from 2026-10-07 09:16:11Z to 09:25:06Z (about 8m56s). Per-appliance samples are approximately 1.2 seconds apart and irregular; this is not a multi-day/90-day history or hardware measurement set. Fresh database seed order maps IDs 1–14 to its appliance inventory, but names are not stored in the CSV itself.

## Deterministic recommendations

Energy Analytics ranks appliances by valid `interval_energy_kwh` recorded in the available rolling 24-hour window and displays the exact observed coverage and telemetry source. It gives practical, category-aware conservation actions. Synthetic readings are labeled as demo data. Unusual-use comparisons are withheld unless there are seven previous UTC dates with at least 18 hours of distributed coverage each, from the same telemetry source, plus at least four hours of current-day coverage. The checked-in replay dataset spans only about 8m56s, so it cannot establish such a baseline.

The optional savings scenario is an operator-entered reduction percentage applied only to that appliance's measured energy in the displayed window: `observed kWh × selected percentage`. This is an illustrative energy calculation, not a prediction or guaranteed saving. The app does not assign a rupee saving to an appliance because household meter topology and actual operating hours are not established. It does not suggest off-peak scheduling because the available tariff profiles do not establish time-of-use periods.

## ML training and predictions

The checked-in legacy model files under `ml-service/models/simulation/energy_lstm_sim_v1/` report a 60-step sequence and 1-second training cadence/horizon. Runtime defaults to a 5-second simulator interval, so the Predictions page disables inference when these contract values do not match. The separate 12-step, 5-minute candidate described in earlier notes is not present in this repository. Do not treat existing metrics or this legacy artifact as validated for the checked-in irregular dataset or physical hardware.

The reusable training pipeline defines 19 features, train-fitted input/target scalers, chronological per-appliance splits, and a next-interval energy target. Dataset generation/training requires a uniform cadence. Model metadata records feature order, target, dataset hash, cadence, horizon, source, training time, and evaluation metrics. Predictions remain unavailable until the input cadence and model contract match.

Use the authenticated admin actions in the Training page to export a uniquely named dataset snapshot and request training. Exports go under `ml-service/datasets/exports/`; the checked-in canonical replay CSV is left unchanged. Training reads the newest export (or the checked-in dataset if no export exists) and writes a uniquely named candidate under `ml-service/models/candidates/`. It does not replace the legacy model, active registry, or other candidates. Candidate training runs in the ML service background and does not activate the candidate. Review and package it against the managed model contract before staging/activation; keep the rollback path available.

## Billing and settings

Energy Analytics offers both the existing saved tariff and a separate **KSERC LT-I sourced schedule** estimate. The sourced estimate follows Order 427/D(T)/2023/KSERC (OP 18/2023), using the 1 April 2025–31 March 2027 rates, phase-specific fixed charges, telescopic slabs through 250 monthly units, and the applicable non-telescopic rate on all units above 250. Duty is estimated at 10% of energy charges. Fuel adjustment, meter rent, and green charge default to zero because their application/value can vary; the estimate lists these assumptions and links the regulator Gazette. Consumer-specific concessions are not inferred. Existing DB tariff values are preserved and remain editable by an admin. Neither profile produces an official bill.

## Database migrations

Initialization is additive and idempotent. Existing cumulative `energy` values are preserved; interval energy is backfilled using ordered readings where a nonnegative, plausible delta exists. Baselines, resets, and implausible jumps are labeled without deleting historical readings. Schema migration markers and indexes are stored in SQLite. Existing accounts and data are not reset by migrations. The previously seeded `admin` account is denied while it still has the known `admin123` password; supplying an explicit strong `ADMIN_PASSWORD` rotates that specific legacy credential at startup.

## Verification and limitations

Run backend TypeScript checks and Node tests with `npm test` in `backend`; this builds the backend before the tests. Run frontend unit tests with `npm test`, the TypeScript check with `npx tsc --noEmit -p tsconfig.app.json`, and the production build with `npm run build` in `frontend`. Run ML tests with `python -m unittest discover -s tests -v` in `ml-service` (the test suite needs a writable `ml-service/.tmp` directory on Windows).

Current limitations: physical hardware, firmware, Wi-Fi health, archived storage outside the bounded SQLite retention, persistent report history, and a persisted anomaly workflow are not implemented. Recommendations describe only recorded telemetry and only estimate energy for an operator-selected scenario; they do not forecast savings or attribute bill changes. Forecast inference remains disabled unless exact feature order, sequence length, input cadence, and runtime cadence agree. The checked-in legacy model has no preprocessing contract identifier, and the candidate package/artifacts needed to validate its model-to-scaler-to-appliance mapping are absent. Password recovery requires an explicitly configured delivery webhook. The older non-routed pages `frontend/src/pages/Dashboard/DashboardView.tsx` and `frontend/src/pages/AIOverview/AIOverviewView.tsx` are visual prototypes with mock metrics; the active `/` and `/ai` routes use the root-level page files.

## Moving from simulation to hardware

The future ESP32/PZEM integration should continue to use authenticated `POST /api/v1/telemetry` with device, PZEM, appliance/circuit mapping, ISO timestamp, source, and cumulative energy. Preserve raw source timestamps and quality; validate clock drift, cadence, duplicate readings, meter resets, and physical power consistency before preparing a training export. Keep replay data out of hardware ingestion and training truth. Build a versioned dataset with a feature-schema manifest, train/validation/test chronological split, and persistence baseline; report overall and per-appliance metrics. Validate the exact preprocessing/scalers against the staged candidate, then activate through the managed registry only after review; retain rollback to the prior version. The repository has not been tested against physical hardware.
