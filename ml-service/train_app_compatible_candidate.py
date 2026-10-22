"""Train a contract-compatible candidate from canonical app telemetry.

The candidate stays isolated until held-out checks establish that it is better
than persistence. Only canonical app telemetry is accepted; this script does
not create training observations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler, MinMaxScaler

from config import FEATURE_COLUMNS, N_FEATURES, SAMPLING_INTERVAL_MS, SAMPLING_INTERVAL_SECONDS, SEQUENCE_LENGTH, TARGET, DATASET_EXPORTS_DIR
from data_pipeline import preprocess_data
from model_registry import CONTRACT_ID, PREPROCESSING_CONTRACT

BASE = Path(__file__).resolve().parent
OUTPUT_ROOT = BASE / "models" / "candidates"
CADENCE = pd.Timedelta(seconds=SAMPLING_INTERVAL_SECONDS)
RAW_FIELDS = ["timestamp", "appliance_id", "voltage", "current", "power", "energy", "interval_energy_kwh", "frequency", "power_factor"]


def _metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    error = predicted - actual
    total = float(np.abs(actual).sum())
    return {
        "mae_kwh": float(np.mean(np.abs(error))),
        "rmse_kwh": float(np.sqrt(np.mean(np.square(error)))),
        "r2": float(1 - np.square(error).sum() / np.square(actual - actual.mean()).sum()) if np.square(actual - actual.mean()).sum() else 0.0,
        "wape_percent": float(np.abs(error).sum() / total * 100) if total else 0.0,
        "samples": int(actual.size),
    }


def _windows(frame: pd.DataFrame, scaled_x: np.ndarray, split_indices: dict[str, dict[str, int]]):
    result = {name: {"x": [], "y": [], "baseline": [], "appliance": []} for name in ("train", "validation", "test")}
    x_offset = 0
    for appliance, group in frame.groupby("appliance_id", sort=False):
        n = len(group)
        split = split_indices[str(appliance)]
        ts = pd.DatetimeIndex(group["timestamp"])
        # pandas 3 defaults to microsecond datetime precision, while older
        # pandas versions used nanoseconds. Normalize before comparing against
        # Timedelta.value so valid 5-second cadence windows are preserved.
        timestamp_ns = ts.to_numpy(dtype="datetime64[ns]").astype(np.int64)
        gap = np.r_[True, (np.diff(timestamp_ns) < CADENCE.value * 0.5) | (np.diff(timestamp_ns) > CADENCE.value * 1.5)]
        segment_start = np.maximum.accumulate(np.where(gap, np.arange(n), 0))
        local_x = scaled_x[x_offset:x_offset + n]
        target = pd.to_numeric(group["interval_energy_kwh"], errors="coerce").to_numpy(dtype=np.float32)
        for i in range(SEQUENCE_LENGTH, n):
            if i - SEQUENCE_LENGTH < segment_start[i] or not np.isfinite(target[i]) or target[i] < 0:
                continue
            if not np.isfinite(local_x[i - SEQUENCE_LENGTH:i]).all():
                continue
            split_name = "train" if i < split["train_end"] else "validation" if i < split["validation_end"] else "test"
            bucket = result[split_name]
            bucket["x"].append(local_x[i - SEQUENCE_LENGTH:i])
            bucket["y"].append(target[i])
            bucket["baseline"].append(target[i - 1])
            bucket["appliance"].append(str(appliance))
        x_offset += n
    return {name: {key: np.asarray(value) for key, value in data.items()} for name, data in result.items()}


def train(data_path: Path, epochs: int = 30) -> Path:
    if epochs < 1 or epochs > 100:
        raise ValueError("epochs must be between 1 and 100")
    frame = pd.read_csv(data_path)
    missing = set(RAW_FIELDS) - set(frame.columns)
    if missing:
        raise ValueError(f"Canonical telemetry is missing columns: {sorted(missing)}")
    frame = frame[RAW_FIELDS].copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, format="mixed", errors="coerce")
    frame["appliance_id"] = frame["appliance_id"].astype(str)
    frame = frame.dropna(subset=["timestamp", "appliance_id", "interval_energy_kwh"])
    frame = frame.sort_values(["appliance_id", "timestamp"], kind="stable").reset_index(drop=True)
    if frame.empty:
        raise ValueError("No canonical valid interval readings are available")

    split_indices = {}
    train_parts = []
    for appliance, group in frame.groupby("appliance_id", sort=False):
        n = len(group)
        train_end, validation_end = int(n * 0.70), int(n * 0.85)
        if train_end <= SEQUENCE_LENGTH or validation_end <= train_end or n <= validation_end:
            raise ValueError(f"Appliance {appliance} has too few rows for chronological 70/15/15 splits")
        split_indices[str(appliance)] = {"train_end": train_end, "validation_end": validation_end}
        train_parts.append(group.iloc[:train_end])

    # Fit input and target scalers on training rows only. Feature generation is
    # performed by the same function used at inference.
    scaler_dir = Path(os.environ.get("TEMP", str(BASE / ".tmp"))) / f"app-model-scalers-{uuid.uuid4().hex}"
    scaler_dir.mkdir(parents=True, exist_ok=False)
    try:
        input_scaler_path, target_scaler_path = scaler_dir / "input.pkl", scaler_dir / "target.pkl"
        preprocess_data(pd.concat(train_parts), True, str(input_scaler_path), str(target_scaler_path))
        scaled_x, _, prepared = preprocess_data(frame, False, str(input_scaler_path), str(target_scaler_path))
    finally:
        # Fitted scalers are serialized in the candidate below before cleanup.
        pass

    split_data = _windows(prepared.reset_index(drop=True), scaled_x.astype(np.float32), split_indices)
    if min(len(split_data[k]["y"]) for k in split_data) == 0:
        raise ValueError("No contiguous 60-reading windows are available in one of the chronological splits")
    train_data, val_data, test_data = (split_data[k] for k in ("train", "validation", "test"))
    import joblib
    target_scaler = joblib.load(target_scaler_path)
    actual = test_data["y"].astype(float)
    baseline = test_data["baseline"].astype(float).clip(min=0)
    for bucket in (train_data, val_data, test_data):
        bucket["y"] = target_scaler.transform(bucket["y"].reshape(-1, 1)).astype(np.float32).ravel()

    tf.keras.utils.set_random_seed(42)
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, N_FEATURES)),
        tf.keras.layers.LSTM(32),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1, activation="relu"),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss="mae")
    history = model.fit(
        train_data["x"], train_data["y"], validation_data=(val_data["x"], val_data["y"]),
        epochs=epochs, batch_size=256, shuffle=True,
        callbacks=[tf.keras.callbacks.TerminateOnNaN()],
        verbose=2,
    )
    # Keep inference batches small: large oneDNN LSTM calls can stall on the
    # Windows CPU runtime even though training batches complete normally.
    prediction_scaled = np.concatenate([
        model(batch, training=False).numpy()
        for batch in np.array_split(test_data["x"], max(1, int(np.ceil(len(test_data["x"]) / 64))))
    ], axis=0).reshape(-1, 1)
    prediction = target_scaler.inverse_transform(prediction_scaled).reshape(-1).clip(min=0)
    overall = {"candidate": _metrics(actual, prediction), "persistence_baseline": _metrics(actual, baseline)}
    base_mae = overall["persistence_baseline"]["mae_kwh"]
    overall["mae_improvement_vs_persistence_percent"] = float((1 - overall["candidate"]["mae_kwh"] / base_mae) * 100) if base_mae else 0.0
    eligible = overall["candidate"]["mae_kwh"] < overall["persistence_baseline"]["mae_kwh"]
    per_appliance = {}
    for appliance in sorted(set(test_data["appliance"].tolist())):
        mask = test_data["appliance"] == appliance
        per_appliance[appliance] = {"candidate": _metrics(actual[mask], prediction[mask]), "persistence_baseline": _metrics(actual[mask], baseline[mask])}

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    version = f"energy_lstm_app_candidate_{timestamp.strftime('%Y%m%dT%H%M%S%fZ')}_{uuid.uuid4().hex[:8]}"
    candidate = OUTPUT_ROOT / version
    candidate.mkdir(exist_ok=False)
    model.save(candidate / "model.keras")
    # Managed inference converts these fitted scalers to normalized JSON under
    # the isolated staging process; source artifacts are included in the ZIP.
    import shutil
    shutil.copy2(input_scaler_path, candidate / "input_scaler.pkl")
    shutil.copy2(target_scaler_path, candidate / "target_scaler.pkl")
    del shutil
    input_scaler = joblib.load(input_scaler_path)
    input_scaler_json = {"mean": input_scaler.mean_.tolist(), "scale": input_scaler.scale_.tolist()}
    target_scaler_json = {"scale": target_scaler.scale_.tolist(), "min": target_scaler.min_.tolist()}
    scaler_dir.unlink(missing_ok=True) if scaler_dir.is_file() else None
    import shutil as _shutil
    _shutil.rmtree(scaler_dir, ignore_errors=True)

    digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
    metrics = {"overall": overall, "per_appliance": per_appliance}
    metadata = {
        "contract_id": CONTRACT_ID,
        "model_id": "energy_lstm_app_v1",
        "model_version": version,
        "model_format": ".keras",
        "model_type": "LSTM next-interval energy forecaster",
        "framework": "TensorFlow/Keras",
        "tensorflow_version": tf.__version__,
        "created_at_utc": timestamp.isoformat(),
        "feature_count": N_FEATURES,
        "feature_columns": FEATURE_COLUMNS,
        "sequence_length": SEQUENCE_LENGTH,
        "sampling_interval_ms": SAMPLING_INTERVAL_MS,
        "forecast_horizon_intervals": 1,
        "target_column": "interval_energy_kwh",
        "target_unit": "kWh",
        "dataset_source": "simulation",
        "scalers": {"input": {"class": "StandardScaler", "features": N_FEATURES}, "target": {"class": "MinMaxScaler", "features": 1}},
        "preprocessing": PREPROCESSING_CONTRACT,
        "input_scaler_file": "input_scaler.pkl",
        "target_scaler_file": "target_scaler.pkl",
        "feature_columns_file": "feature_columns.json",
        "model_sha256": hashlib.sha256((candidate / "model.keras").read_bytes()).hexdigest(),
        "training_data": f"app canonical simulated telemetry; {len(frame)} rows; sha256 {digest}",
        "training_data_rows": int(len(frame)),
        "training_samples": int(len(train_data["y"])),
        "validation_samples": int(len(val_data["y"])),
        "test_samples": int(len(test_data["y"])),
        "split": "per-appliance chronological 70/15/15; windows are discarded across timestamp gaps",
        "epochs_completed": len(history.history["loss"]),
        "metrics": metrics,
        "deployment_eligible": bool(eligible),
        "activation": "not eligible: held-out MAE must beat the persistence baseline" if not eligible else "eligible for validation; activation still requires a separate review",
    }
    for filename, value in {
        "metadata.json": metadata,
        "feature_columns.json": FEATURE_COLUMNS,
        "bias_corrections.json": {},
        "selected_methods.json": {},
        "input_scaler.json": input_scaler_json,
        "target_scaler.json": target_scaler_json,
        "metrics.json": metrics,
    }.items():
        (candidate / filename).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    (candidate / "README.md").write_text(
        "App-contract simulation candidate. Trained on the application's canonical simulated telemetry; "
        "this result does not measure physical-meter accuracy. It predicts the next configured interval "
        "from 60 consecutive readings. See metadata.json and metrics.json for split and held-out baseline results.\n",
        encoding="utf-8",
    )
    package = candidate / "candidate.zip"
    package_files = ["model.keras", "input_scaler.pkl", "target_scaler.pkl", "feature_columns.json", "metadata.json", "bias_corrections.json", "selected_methods.json", "README.md"]
    with zipfile.ZipFile(package, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for filename in package_files:
            archive.write(candidate / filename, arcname=filename)
    print(json.dumps({"candidate_dir": str(candidate), "package": str(package), "metadata": metadata}, indent=2))
    return candidate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=None, help="Canonical app telemetry CSV; defaults to newest unique telemetry export")
    parser.add_argument("--epochs", type=int, default=30)
    args = parser.parse_args()
    if args.data:
        data_path = args.data
    else:
        exports = sorted(Path(DATASET_EXPORTS_DIR).glob("canonical_simulation_telemetry_*.csv"), key=lambda p: p.stat().st_mtime)
        if not exports:
            raise FileNotFoundError("No canonical telemetry export found. Export canonical app telemetry before training.")
        data_path = exports[-1]
    train(data_path, args.epochs)


if __name__ == "__main__":
    main()
