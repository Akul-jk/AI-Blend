# Smart Energy Monitor — current walkthrough

This note replaces the earlier prototype walkthrough, which described mock dashboard data, unsupported ML claims, and an obsolete local path. The current application is a simulated demonstration; physical hardware has not been tested.

## Start locally

Install dependencies from the checked-in lockfiles with `npm ci` in `backend` and `frontend`. Start the backend and frontend in separate terminals:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

The backend creates/migrates its SQLite database and begins the existing 5-second simulation. Use a disposable `DB_FILE` if you do not want to create a local database. See [README.md](README.md) for authentication bootstrap and environment settings.

## Demonstration flows

- Register a regular user and sign in.
- `/` shows the household summary based on authenticated analytics APIs.
- `/appliances` lists configured appliances; select an appliance to open its detail/history view.
- `/monitoring` shows the live simulator/hardware stream. Its replay panel plays the repository's canonical synthetic CSV as a separate source; choose **Dataset replay** for replay charts. Controls support start, pause, resume, restart, and six speeds. Replay is broadcast-only and never enters SQLite or hardware ingestion.
- `/analytics` shows recorded interval-energy trends and the bill estimator. Choose either the existing saved tariff or the separate sourced KSERC LT-I schedule estimate.
- `/predictions` shows a forecast only when model metadata and runtime cadence match. The checked-in legacy artifact reports 1-second cadence while runtime defaults to 5 seconds, so the forecast is unavailable under the default setup.

## Data and model limitations

The checked-in dataset contains 6,314 synthetic rows for 14 appliance IDs over about 8m56s on 7 October 2026. It is not a long-term history and contains no physical measurements. Model and dataset contracts, tariff assumptions, baseline test blockers, and the future hardware workflow are recorded in [docs/repository-audit-and-handover.md](docs/repository-audit-and-handover.md).

## Verification

Backend tests run with `npm test` in `backend`, which builds TypeScript before running Node tests. Frontend build runs with `npm run build` in `frontend`. The tests/builds require dependencies installed using the lockfiles; no generated bundle is committed.
