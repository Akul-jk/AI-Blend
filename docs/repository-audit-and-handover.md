# Smart Energy Monitor repository audit

Audit date: 15 October 2026. The working tree was clean at handover on branch `master` (latest commit `4b086c5`). No local database, `.env`, or dependency directories were present. No repository `AGENTS.md` was found.

## Implementation checklist

- [x] Confirm branch, commit history, and clean handover state.
- [x] Inspect application routes, services, schemas, seed logic, datasets, model metadata, and tests.
- [x] Verify LT-I slab rates and phase fixed charges against the [KSERC order and Gazette schedule](https://dev.erckerala.org/api/storage/orders/o0sDy6ZmrpxIKwgD9dz8lMNuYvVEq11l9P1VcHeP.pdf).
- [x] Add a sourced, separate LT-I estimate profile and boundary tests; preserve the saved tariff configuration.
- [x] Implement a selectable replay controller and controls, isolated from hardware ingestion and database cumulative registers.
- [x] Verify or disable the incompatible forecast path in the UI and document the model/data contract blocker.
- [x] Document the mock metrics in the non-routed legacy dashboard and AI overview prototypes.
- [x] Make dataset exports and training outputs unique so they cannot overwrite the checked-in dataset or legacy model artifacts.
- [x] Add deterministic appliance recommendations, a baseline-gated unusual-usage check, and an operator-controlled observed-window savings scenario.
- [x] Verify replay ordering, timestamps, restart/reset behavior, speed changes, duplicate-safe client history, and authentication.
- [x] Run backend tests, frontend TypeScript/build checks, and ML tests; record remaining environment/model limitations.

## Existing features and reusable components

- Express + SQLite backend with additive schema migration, authenticated telemetry ingestion, duplicate meter/timestamp rejection, cumulative-register delta calculation, quality flags, retention, Socket.IO telemetry broadcasts, and an existing 5-second simulator.
- Authenticated appliance, telemetry, analytics, tariff, settings, ML, dataset, and reporting endpoints. Existing appliance detail and analytics pages can reuse the current React Query API client and chart components.
- Frontend route `/` uses `frontend/src/pages/DashboardView.tsx`; appliance details use `/appliances/:id`; analytics and forecasts use `/analytics` and `/predictions`.
- Database schema and seed code configure 14 appliances and meters on a fresh database. The database itself was absent, so no persisted records/settings could be inspected.
- Existing saved tariff values/slabs are retained and remain available as the “Saved tariff settings” profile.
- Admin dataset export now writes a unique snapshot under `ml-service/datasets/exports/`; candidate training writes a unique output directory under `ml-service/models/candidates/`. Neither operation replaces the checked-in replay CSV, legacy model/scalers/metrics, or active registry pointer. Training consumes the newest generated export if available and does not activate it.

## Dataset and model contracts found

- Only `ml-service/datasets/simulation/canonical_simulation_telemetry.csv` exists in the repository. It contains 6,314 data rows (451 records for each of 14 IDs), source `simulation`, and columns `timestamp,pzem_id,appliance_id,voltage,current,power,energy,interval_energy_kwh,frequency,power_factor,source,quality`.
- Timestamp coverage is 2026-10-07 09:16:11.045Z through 09:25:06.807Z, about 8m56s. Each ID has the same start/end coverage. Per-ID samples are approximately 1.2 seconds apart, irregular and not a 5-minute, multi-day or 90-day dataset. This export must not be treated as a source of live wall-clock telemetry.
- IDs 1–14 align positionally with the 14 fresh-database seed appliances/meters, but names are not embedded in the CSV. Seed profiles are Refrigerator, Laptop, Fan, Lighting, TV, Phone Charger, Mixer Grinder, Iron Box, Kettle, Washing Machine, AC, Water Heater, Microwave, and Generic Load. `ml-service/config.py` separately lists only six legacy APP-* profiles, with string IDs; that mapping is not the canonical CSV contract.
- `ml-service/config.py`, `main.py`, and `MODEL_PACKAGE_CONTRACT.md` define a 19-feature input, ordered as voltage, current, power, cumulative energy, frequency, power factor, seven UTC time features, three interval-energy lags, and three power lags. Preprocessing code forward-fills within appliance then zero-fills; lags use `interval_energy_kwh`/power; inference requires one uniform cadence and uses train-fitted StandardScaler and MinMaxScaler.
- The checked-in `energy_lstm_sim_v1` metadata records a 60-step sequence and a 1-second interval/horizon. Runtime defaults to 5 seconds. The repository has no 12-step, 5-minute candidate package, no matching preprocessing/training notebook, and no candidate per-appliance scaler set. The included canonical dataset also violates both the 1-second and 5-second cadence contracts. The model must not be described as validated for this data or hardware.
- Model registry code retains `legacy-energy-lstm-sim-v1` as a rollback starting point and validates managed packages against the 60 × 19, runtime-cadence contract. The actual persistent `MODEL_STORE_DIR/registry.json` was absent, so active registry state could not be confirmed from disk.

## Tariff profile added

`backend/src/services/ksebTariff.ts` calculates the separate “KSERC LT-I Domestic · sourced estimate” profile from Order 427/D(T)/2023/KSERC. It uses the 1 April 2025–31 March 2027 rate period, phase-specific fixed-charge bands, telescopic rates through 250 monthly units, and the applicable non-telescopic rate on all units above 250. It estimates 10% duty on energy charges. Variable fuel adjustment, meter rent, and green charge default to zero and can be supplied explicitly. BPL and other consumer-specific concessions are not inferred. The saved DB tariff is unchanged.

Replay is implemented by authenticated `/api/v1/simulation/replay` controls and `backend/src/simulation/replay.ts`. It emits a distinct `telemetry:replay` event, preserves dataset timestamps, groups readings sharing a timestamp, and does not call the persistence service. The Live Monitoring page keeps replay history in a separate client store and has selectable playback speed and source controls. The Predictions page checks model sequence length, feature count, and configured cadence before making a prediction request; the checked-in 1-second model is disabled against the default 5-second runtime.

## High-risk areas and unresolved questions

- Existing simulator and hardware ingest share `acceptTelemetry`; replaying historical timestamps through that boundary currently fails the five-minute freshness check and could contaminate cumulative energy if rewritten. A replay controller should be separate, read the dataset without edits, and broadcast a distinct replay source.
- Replay rows use the same appliance IDs as fresh DB seed rows, but no local DB was available to verify whether a user's local database maps them identically. Do not write these rows into persistent telemetry without an explicit data-separation strategy.
- Household aggregate-meter plus appliance-meter topology is not represented by a validated local database. Avoid claiming aggregate double-count protection until the actual source topology can be established.
- Current fuel price adjustment and meter-rent applicability vary. The new sourced profile avoids silently asserting values for them.
- Forecast inference is disabled unless the exact ordered 19-feature contract, 60-step sequence, each observed input gap, and model/runtime sampling interval agree. No five-minute resampling is inferred.
- Recommendation rankings sum valid interval energy from the observed rolling 24-hour window and display exact available coverage/source. Unusual-use findings require seven previous UTC dates with at least 18 hours of distributed readings from the same source each and at least four current-day hours. An operator-selected percentage produces only a labeled energy scenario for the observed window; no monetary saving or off-peak schedule is claimed.
- The older, non-routed `frontend/src/pages/Dashboard/DashboardView.tsx` and `frontend/src/pages/AIOverview/AIOverviewView.tsx` contain mock metrics. Neither is imported by `App.tsx`; comments and README identify them as visual prototypes.

## Handover baseline verification (15 October 2026)

- At handover the JavaScript dependencies were absent, so builds/tests had not run. This section records the original handover condition, not the follow-up results below.

## Remaining work

1. Establish an ML environment matching the declared TensorFlow requirement, then version the complete preprocessing contract and scaler/model provenance.
2. Obtain or train a candidate with verified appliance identity mapping, cadence-compatible data, chronological holdout metrics, persistence-baseline comparison, and per-appliance performance.
3. Keep inference disabled until that candidate passes the managed package probe and the current runtime cadence matches its training contract.
4. Validate aggregate-meter/appliance-meter topology and actual tariff operating assumptions before attributing monetary savings or adding scheduling recommendations.
5. Validate future ESP32/PZEM capture on physical equipment; no hardware was available in this review.

## Follow-up verification (15 October 2026)

- The starting branch was `master` at commit `4b086c5` with the reported changes uncommitted. Existing edits were preserved. No commit, push, deployment, destructive database action, or model artifact overwrite was performed; no database was created.
- Backend lockfile dependencies were restored with `npm ci`. Frontend dependencies were already installed from the prior launch and required `npm ci --legacy-peer-deps` because the locked React 19 / `lucide-react@0.363.0` peer ranges conflict. Lockfiles remain unchanged. npm reported 19 backend and 18 frontend vulnerabilities; no automatic audit fix was run.
- Added authenticated `GET /api/v1/recommendations`, valid-interval ranking, conservative baseline detection, practical appliance-specific actions, and a user-selected energy-only scenario. There is no rupee-savings claim or unsupported time-of-use schedule.
- Replay rows validate quality values. Speed changes reschedule playback, restart broadcasts a reset event, and the client store orders readings and suppresses duplicate meter/timestamp pairs. SQLite telemetry remains separate from replay history.
- Backend `npm test`: passed, 17 tests. Frontend `npm test`: passed, 2 Node built-in tests. Frontend `npx tsc --noEmit -p tsconfig.app.json`: passed. Frontend `npm run build`: passed. Python `python -m unittest discover -s tests -v`: passed, 22 tests. Backend `npm test` includes the TypeScript build. No separate frontend test runner existed initially; a dependency-free Node test script was added for replay history.
- Legacy model smoke check: TensorFlow loaded the model in safe mode with input shape `(None, 60, 19)`, output `(None, 1)`, and 19/1-feature scalers. A zero-scaled input produced a finite inverse-scaled nonnegative value in kWh. This is only a loadability/shape smoke check; it does not verify preprocessing against training or model accuracy.
- Model remains unverified for inference. Requirements declare TensorFlow 2.18.1, but the available runtime is TensorFlow 2.22.0-rc0; scikit-learn runtime 1.9.0 warned that scaler artifacts were serialized by 1.9.1. Legacy metadata has feature names/order and a 60 × 19 / 1-second declaration, but no preprocessing contract ID/object or training-code hash. The candidate directory/package and its scalers/mapping are absent. The checked-in 6,314-row replay CSV spans about 8m56s with irregular ~1.2-second intervals; runtime defaults to 5 seconds. Numeric IDs 1–14 are not tied to a versioned model mapping (the older profile lists only six `APP-*` IDs). Stored metrics are aggregate only (MAE 0.0000210 kWh, RMSE 0.0000526 kWh, R² 0.249, MAPE 88.9%, WAPE 117.5%, 892 samples); there is no persistence baseline or per-appliance score. Inference remains fail-closed.
- Python tests initially failed because the sandbox could not create temporary SQLite/test directories; rerunning outside the sandbox passed all 22. The environment runs Python 3.14.2, while the README recommends Python 3.11 for the pinned TensorFlow dependency; the installed TensorFlow differs from `requirements.txt`. No Python packages were installed or changed.
- No physical hardware was available or tested. Appliance billing attribution remains limited by the unverified household meter topology.
