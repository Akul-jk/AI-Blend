# Managed model package contract, version 1

The ML service loads the model version recorded as active in `MODEL_STORE_DIR/registry.json` (default: `ml-service/models/managed`). Set `MODEL_STORE_DIR` to durable storage when deployments use ephemeral application disks. Version directories are immutable after validation. The original legacy model remains the initial active version.

## Package contents

A package is one flat ZIP with exactly these files: `model.keras`, `input_scaler.pkl`, `target_scaler.pkl`, `feature_columns.json`, `metadata.json`, `bias_corrections.json`, `selected_methods.json`, and `README.md`. Upload transport is intentionally not part of Phase 1.

ZIP limits are 128 MiB compressed, 256 MiB expanded, 16 members, and a 200:1 member compression ratio. Absolute paths, nested paths, backslashes, links, duplicates, missing members, and unexpected members are rejected.

## Required inference metadata

In addition to model identity and the package file declarations, `metadata.json` must include:

- `contract_id`: `smart-energy-19f-v1`
- `sequence_length`: 60, `feature_count`: 19, and the exact ordered `feature_columns` list
- `sampling_interval_ms`: equal to the service `SIMULATION_INTERVAL_MS`
- `target_column`: `interval_energy_kwh`; `target_unit`: `kWh`
- `scalers`: `{"input":{"class":"StandardScaler","features":19},"target":{"class":"MinMaxScaler","features":1}}`
- `preprocessing`: the exact object shown by `PREPROCESSING_CONTRACT` in `model_registry.py`

Preprocessing uses UTC timestamp fields; hour sine/cosine with period 23, weekday period 6, month period 12, and weekend for weekdays 5–6; forward-fill per appliance then zero-fill; cumulative `energy` remains a separate feature from `interval_energy_kwh`; lag features use interval energy and power offsets 1–3; sequences must stay within one appliance and contain no sampling gap.

## Trust boundary

The archive validator never deserializes pickle files. `staging_runner.py` starts `staging_worker.py` in a separate Windows process, suspended until it has been assigned to a Windows Job Object. The job enforces 3 GiB total job and per-process memory limits, 120 seconds total job and per-process CPU time, an eight-process tree limit, and a 180 second wall-clock limit. The job kills descendants when closed. If job assignment or limits cannot be established, the worker is not resumed. Staging is disabled on non-Windows systems until an equivalent process-tree isolation backend is implemented. The worker uses a restricted pickle unpickler that permits only sklearn StandardScaler/MinMaxScaler state and NumPy array reconstruction, then converts fitted parameters to JSON numeric arrays. It loads Keras with safe mode, no custom objects and no compilation, checks actual input/output shapes, and performs finite probe inference. Only normalized scaler parameters are used for managed inference. The registry does not accept caller-provided staging callbacks.

Registry mutations use a per-process thread lock plus an OS file lock and atomic JSON replacement. This supports cooperating workers on an approved local filesystem. Model staging and activation fail closed on Windows network/removable/unknown drives and on POSIX filesystems outside the explicit local filesystem allowlist. Do not point `MODEL_STORE_DIR` at network storage or a shared filesystem unless its locking and atomic-rename semantics are separately established.

Bias corrections and per-appliance selection rules are retained as package data but are not used by the predictor. They require independent evaluation and an explicit appliance mapping before a later phase may use them.

## Lifecycle

Staging writes only beneath `.staging`, validates the package, invokes the staging runner, writes normalized scaler JSON, and atomically publishes a version directory. Validation failure removes staging data and does not change the active pointer. Activation first prepares/loads the complete inference bundle, then atomically replaces the registry JSON. Rollback activates a prior validated version. Training writes unique, isolated candidates under `ml-service/models/candidates/`; it does not replace the legacy model or active registry. Candidate packaging and activation remain explicit later steps and must follow the package contract above.
