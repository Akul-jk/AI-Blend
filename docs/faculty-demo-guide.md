# Smart Energy Monitor — Faculty Demo Guide

## Purpose and honest framing

**One-line description:** Smart Energy Monitor is a simulation-first energy monitoring application that turns meter readings into appliance analytics, transparent bill estimates, alerts, and carefully gated model evaluation.

**Opening (20 seconds):** “This project demonstrates an end-to-end energy monitoring workflow. The current demo uses labeled synthetic telemetry, so I’ll show the product and data pipeline while distinguishing simulated behavior from features that still need physical hardware validation.”

Keep that distinction visible throughout the presentation. Do not describe simulated readings as household measurements, replay time as current time, the reference estimate as an AI prediction, or the LSTM score as real-world accuracy.

## Before the presentation

1. Use the existing demo account, or create a normal user account ahead of time. Public registration does not create an administrator. Do not rely on a legacy default admin password.
2. Start each service in its own PowerShell terminal from the repository root:

   **Terminal 1 — backend**

   ```powershell
   cd backend
   npm run dev
   ```

   **Terminal 2 — frontend**

   ```powershell
   cd frontend
   npm run dev
   ```

   **Terminal 3 — ML service** (needed for model metadata and the comparison page)

   ```powershell
   cd ml-service
   .\.python312\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

   The ML environment is installed from `ml-service/requirements.txt`. If it has not been set up on the demo computer, follow the isolated environment steps in `README.md` before demo day. Keep the ML and backend `DB_FILE` and simulator cadence settings aligned if you override defaults.

3. Open `http://localhost:3000` and sign in. Confirm Overview and Energy Analytics show data and that the header identifies the source as **Simulation**.
4. Open these routes in separate browser tabs and confirm they load before the faculty arrives:
   - `/monitoring`
   - `/analytics`
   - `/ai`
   - `/alerts`
   - `/predictions`
   - `/comparison`
5. On Live Monitoring, check that the replay dataset metadata loads. Keep replay paused until presenting it. It is a historical synthetic file with original timestamps, not a live meter stream.
6. On Forecasts, expect a transparent reference estimate. The LSTM forecast may be disabled because the active legacy model's cadence or preprocessing contract does not match current input. Model Comparison can display a clearly labeled read-only saved candidate evaluation when the ML service is unavailable, provided the candidate metadata is present; training and live forecasts still require the service.
7. Phone alerts require Twilio credentials and India DLT registration. Unless the owner has completed that setup, present the SMS controls as a configured integration point, not a live message demo. Do not enter real phone numbers during a classroom presentation or send test texts without consent.
8. Keep the project overview slides available as a backup if Wi-Fi, a service, or a browser tab fails.

## Suggested 7-minute run-through

| Time | Page | What to show | What to say |
| --- | --- | --- | --- |
| 0:00–0:30 | Overview `/` | Main dashboard and source badge | “This is the application shell. The readings currently come from the built-in simulator.” |
| 0:30–1:30 | Live Monitoring `/monitoring` | Live stream, then replay controls; choose Dataset replay and start briefly | “The simulator creates the current demo readings. Replay is a separate, read-only stream of a checked-in synthetic dataset with its original timestamps; it does not add those rows to the database.” Pause the replay after the demonstration. |
| 1:30–2:15 | Appliances `/appliances` | Appliance list and one appliance detail | “Appliances are logical loads. Meter/circuit assignment is separate; a meter reading does not identify a product by itself.” |
| 2:15–3:30 | Energy Analytics `/analytics` | Observed appliance ranking, coverage/source label, savings scenario, bill estimator | “The ranking sums valid interval energy over the displayed observed window. The savings scenario is measured kWh multiplied by a user-selected reduction assumption. The sourced KSERC estimate lists its tariff period and assumptions; it is not an official bill.” |
| 3:30–4:00 | AI Insights `/ai` | Recommendation summary and synthetic-data label | “These recommendations are deterministic and explainable rules over recorded readings. Unusual-use findings require enough historical coverage; the short demo history correctly withholds them.” |
| 4:00–4:45 | Alerts `/alerts` | Active/history filters and per-alert source; phone opt-in settings | “Alerts have severity and source. Phone delivery is opt-in and only applies to eligible hardware alerts. Simulation/replay alerts remain in the app. Domestic India SMS still needs the approved DLT sender, entity, and template settings.” |
| 4:45–5:45 | Forecasts `/predictions` | Reference estimate and model-unavailable explanation | “The reference estimate is current measured watts × interval seconds ÷ 3,600,000. It assumes that load continues; it is not ML. The LSTM stays disabled when sample cadence, ordered features, sequence length, or preprocessing cannot be verified.” |
| 5:45–6:30 | Model comparison `/comparison` | Candidate vs persistence metrics if ML service is available; otherwise use the saved evaluation table below | “This is a held-out comparison on synthetic data. The candidate does not beat the persistence baseline on MAE, so it remains inactive. This is a useful model-selection result, not a production accuracy claim.” |
| 6:30–7:00 | Close | Return to Overview | Summarize what is implemented and name hardware validation and a longer, representative dataset as the next engineering steps. |

If the replay takes too long, start it at 5× or 10× and pause it after showing the timestamped stream. The available speeds are 0.25×, 0.5×, 1×, 2×, 5×, and 10×. Replay Start, Pause, Resume, Restart, and speed controls are safe for a presentation; do not describe the replay as additional database history.

## Feature explanations

### Telemetry and monitoring

The backend accepts canonical electrical readings in volts, amperes, watts, hertz, power factor, and kWh. `energy` is the cumulative meter register; `interval_energy_kwh` is the valid delta between readings. The first reading establishes a baseline, while resets, duplicates, and implausible jumps are handled with quality checks. The app supports a simulator today and an authenticated ingestion boundary for future ESP32/PZEM hardware.

### Appliance analytics and recommendations

The analytics view ranks the recorded appliance/circuit intervals in the selected window and exposes how much valid data supports the result. Recommended actions are practical suggestions tied to appliance category. Optional savings are scenarios rather than promises. An unusual-use comparison is withheld when a suitable history does not exist.

### Tariff estimation

The app keeps the saved tariff profile separate from the KSERC LT-I sourced schedule. The sourced estimate states its effective period, selected phase, units, duty, and values assumed to be zero. Explain it as an estimate based on the displayed assumptions—not the consumer's final bill, subsidy, or utility account.

### Alerts and phone delivery

In-app alerts show severity, time, appliance/meter where known, and source. Users can resolve alerts and filter the list. SMS preferences are stored per user. Only opted-in warning/critical hardware-originated alerts are eligible. Domestic Indian delivery needs the provider credentials and registered DLT values; no physical hardware or live SMS delivery has been validated in this project.

### AI insights and forecast evaluation

“AI Insights” is a product label for the insight page; its consumption recommendations are deterministic calculations and rules, not a generative assistant. The forecasting model is an LSTM with a 60-step, 19-feature input contract and a next-interval kWh target. Compatibility and cadence checks are designed to block an unsupported forecast.

The saved app-compatible evaluation used 1,036 held-out samples from synthetic telemetry:

| Metric | LSTM candidate | Persistence baseline | Interpretation |
| --- | ---: | ---: | --- |
| MAE | 0.00010063 kWh | 0.00008930 kWh | Lower is better; candidate is about 12.69% worse |
| RMSE | 0.00030000 kWh | 0.00031814 kWh | Lower is better; candidate is better on this metric |
| WAPE | 71.18% | 63.17% | Lower is better; candidate is worse |
| R² | 0.4597 | 0.3924 | Higher is better; not an accuracy percentage |

The model stays inactive because it failed the MAE baseline gate. The metrics come from one held-out simulation evaluation; they do not demonstrate accuracy on a real home, across seasons, or on physical meter data. A separate UCI household candidate uses a different dataset, cadence, and target, so its scores must not be compared as if this were the same task.

On **Model Training** (`/training`), the latest candidate shows the underlying sample counts: 12,474 raw simulated readings, 5,278 training sequences, 1,036 validation sequences, and 1,036 held-out test sequences. Each sequence contains 60 readings; gaps can cause sequence windows to be discarded, so raw readings and model samples are different counts. Explain the baseline as “repeat the latest reading”; the LSTM only earns activation if it reduces average held-out error against that simple method.

## Likely faculty questions

**Is the system connected to a real smart meter?**

Not in this demo. It runs on synthetic simulator readings. The authenticated ESP32/PZEM ingestion boundary and validation rules are present, but physical sensors, firmware, wireless reliability, and meter accuracy have not been validated.

**What does “real time” mean here?**

The simulator produces new readings at its configured interval (5 seconds by default) and the dashboard receives updates. Replay is different: it streams a short historical synthetic dataset using its original event times.

**What is the model's accuracy?**

Do not report a single accuracy percentage. Forecast error is summarized by MAE, RMSE, and WAPE on a specified held-out split. Here the persistence baseline has lower MAE and WAPE, so the candidate remains inactive. R² is not percent accuracy.

**Why show a model if it is disabled?**

The page demonstrates an evidence-based safety gate. It displays a transparent current-load reference estimate while clearly saying when a compatible, validated ML model is unavailable. This avoids presenting an unverified score as a prediction.

**Can alerts go to a phone?**

The integration is conditional. A user must opt in; the organization must configure a provider and complete India DLT registration for domestic SMS. This demo does not claim live SMS delivery.

**How is this different from an electricity bill?**

It estimates charges from measured/recorded units and the selected tariff assumptions. Consumer-specific concessions, adjustments, and utility account details are outside the model, so the result is not an official bill.

**What is the next step toward a dependable deployment?**

Connect a real meter, verify device-to-circuit mapping and timestamps, collect representative data across operating conditions, preserve a chronological holdout, and require a candidate to beat persistence before activation. Validate alert delivery through approved opt-in routes and retain rollback.

## Presenter language

Use phrases such as **“simulated reading,” “observed window,” “estimate,” “reference baseline,”** and **“not yet hardware-validated.”** Avoid **“100% accurate,” “AI knows which appliance,” “this is your real bill,”** or **“SMS is working”** unless those claims are independently established during a later hardware/provider validation.

## Related material

- [Project overview slides](../deliverables/Smart_Energy_Monitor_Project_Overview.pptx)
- [Repository audit and handover](repository-audit-and-handover.md)
- [Application setup and limitations](../README.md)
