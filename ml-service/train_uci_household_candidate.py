"""Train an isolated 5-minute household-load candidate from the UCI data set.

This is a separate aggregate-house contract. It does not use the legacy
19-feature appliance model, and it never activates or overwrites a model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA = BASE_DIR / "datasets" / "external" / "uci-household" / "household_power_consumption.txt"
DEFAULT_OUTPUT = BASE_DIR / "models" / "candidates"
SEQUENCE_LENGTH = 12  # 12 five-minute readings give one hour of history.
INTERVAL = pd.Timedelta(minutes=5)
RAW_FEATURES = [
    "Global_active_power", "Global_reactive_power", "Voltage", "Global_intensity",
    "Sub_metering_1", "Sub_metering_2", "Sub_metering_3",
]
FEATURE_COLUMNS = RAW_FEATURES + ["time_of_day_sin", "time_of_day_cos", "weekday_sin", "weekday_cos"]


def load_five_minute_bins(path: Path) -> tuple[pd.DataFrame, pd.Series]:
    """Load only complete, measured five-minute blocks; never fill missing data."""
    frame = pd.read_csv(
        path,
        sep=";",
        usecols=["Date", "Time", *RAW_FEATURES],
        na_values=["?"],
        dtype={column: np.float32 for column in RAW_FEATURES},
    )
    timestamps = pd.to_datetime(
        frame.pop("Date") + " " + frame.pop("Time"),
        format="%d/%m/%Y %H:%M:%S",
        errors="coerce",
    )
    frame.index = pd.DatetimeIndex(timestamps, name="timestamp")
    frame = frame.sort_index()
    frame["_timestamp_ns"] = frame.index.asi8

    resampler = frame.resample("5min", closed="right", label="right")
    means = resampler[RAW_FEATURES].mean()
    counts = resampler[RAW_FEATURES].count()
    sizes = resampler.size()
    first_ns = resampler["_timestamp_ns"].min()
    last_ns = resampler["_timestamp_ns"].max()
    # Five distinct minute observations spanning exactly four minutes are a
    # complete, regular bin. Missing or duplicated clock minutes are rejected.
    complete = counts.eq(5).all(axis=1) & sizes.eq(5) & ((last_ns - first_ns) == pd.Timedelta(minutes=4).value)

    energy_kwh = resampler["Global_active_power"].sum(min_count=5) / 60.0
    bins = means.loc[complete].copy()
    target = energy_kwh.loc[complete].astype(np.float32)
    bins.index.name = "timestamp"

    minutes = (bins.index.hour * 60 + bins.index.minute).to_numpy(dtype=np.float32)
    weekdays = bins.index.dayofweek.to_numpy(dtype=np.float32)
    bins["time_of_day_sin"] = np.sin(2 * np.pi * minutes / 1440.0)
    bins["time_of_day_cos"] = np.cos(2 * np.pi * minutes / 1440.0)
    bins["weekday_sin"] = np.sin(2 * np.pi * weekdays / 7.0)
    bins["weekday_cos"] = np.cos(2 * np.pi * weekdays / 7.0)
    return bins[FEATURE_COLUMNS].astype(np.float32), target


def metric_report(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | int]:
    error = predicted - actual
    denominator = float(np.abs(actual).sum())
    smape_denominator = np.abs(actual) + np.abs(predicted)
    nonzero = smape_denominator > 0
    return {
        "mae_kwh_per_5min": float(np.mean(np.abs(error))),
        "rmse_kwh_per_5min": float(np.sqrt(np.mean(np.square(error)))),
        "r2": float(1 - np.square(error).sum() / np.square(actual - actual.mean()).sum()),
        "wape_percent": float(np.abs(error).sum() / denominator * 100) if denominator else 0.0,
        "smape_percent": float(np.mean(2 * np.abs(error[nonzero]) / smape_denominator[nonzero]) * 100) if nonzero.any() else 0.0,
        "samples": int(actual.size),
    }


def build_windows(features: np.ndarray, target: np.ndarray, timestamps: pd.DatetimeIndex):
    """Return windows only where all twelve inputs and target are consecutive."""
    n = len(features)
    if n <= SEQUENCE_LENGTH:
        raise ValueError("Not enough complete bins to form a 60-minute history window.")
    valid = np.isfinite(features).all(axis=1) & np.isfinite(target)
    # Invalidate bins whose source timestamps are not on the continuous 5-min grid.
    valid &= np.r_[True, np.diff(timestamps.asi8) == INTERVAL.value]
    bad_prefix = np.r_[0, np.cumsum(~valid)]
    target_indices = np.arange(SEQUENCE_LENGTH, n)
    window_ok = (bad_prefix[target_indices] - bad_prefix[target_indices - SEQUENCE_LENGTH] == 0) & valid[target_indices]
    windows = np.lib.stride_tricks.sliding_window_view(features[:-1], SEQUENCE_LENGTH, axis=0).transpose(0, 2, 1)
    return windows[target_indices[window_ok] - SEQUENCE_LENGTH], target[target_indices[window_ok]], timestamps[target_indices[window_ok]], target_indices[window_ok]


def train(data_path: Path, output_root: Path, epochs: int = 12) -> Path:
    if not data_path.is_file():
        raise FileNotFoundError(f"UCI data file not found: {data_path}. Download and extract the official UCI archive first.")
    if epochs < 1 or epochs > 50:
        raise ValueError("epochs must be between 1 and 50")

    features_frame, target_series = load_five_minute_bins(data_path)
    timestamps = features_frame.index
    raw_x = features_frame.to_numpy(dtype=np.float32)
    raw_y = target_series.to_numpy(dtype=np.float32)
    windows, y, target_times, target_indices = build_windows(raw_x, raw_y, timestamps)
    cut70 = timestamps[int(len(timestamps) * 0.70)]
    cut85 = timestamps[int(len(timestamps) * 0.85)]
    train_mask = target_times < cut70
    val_mask = (target_times >= cut70) & (target_times < cut85)
    test_mask = target_times >= cut85
    if min(train_mask.sum(), val_mask.sum(), test_mask.sum()) == 0:
        raise ValueError("Chronological split produced an empty train, validation, or test set.")

    # Scalers see only the training period. The held-out test is the final 15%.
    scaler = StandardScaler().fit(raw_x[: int(len(raw_x) * 0.70)][np.isfinite(raw_x[: int(len(raw_x) * 0.70)]).all(axis=1)])
    target_scaler = StandardScaler().fit(y[train_mask].reshape(-1, 1))
    scaled_x = scaler.transform(raw_x).astype(np.float32)
    scaled_windows, scaled_y, target_times, target_indices = build_windows(scaled_x, raw_y, timestamps)
    # Same eligibility masks, reconstructed after scaling to avoid scaler drift.
    train_mask = target_times < cut70
    val_mask = (target_times >= cut70) & (target_times < cut85)
    test_mask = target_times >= cut85
    scaled_y = target_scaler.transform(scaled_y.reshape(-1, 1)).astype(np.float32).ravel()

    x_train = np.ascontiguousarray(scaled_windows[train_mask], dtype=np.float32)
    y_train = scaled_y[train_mask]
    x_val = np.ascontiguousarray(scaled_windows[val_mask], dtype=np.float32)
    y_val = scaled_y[val_mask]
    x_test = np.ascontiguousarray(scaled_windows[test_mask], dtype=np.float32)
    y_test_scaled = scaled_y[test_mask]
    y_test = target_scaler.inverse_transform(y_test_scaled.reshape(-1, 1)).ravel()
    test_indices = target_indices[test_mask]
    persistence = raw_x[test_indices - 1, 0] * (5.0 / 60.0)

    tf.keras.utils.set_random_seed(42)
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, len(FEATURE_COLUMNS))),
        tf.keras.layers.LSTM(24),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss="mae")
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=2, restore_best_weights=True),
        tf.keras.callbacks.TerminateOnNaN(),
    ]
    history = model.fit(
        x_train, y_train,
        validation_data=(x_val, y_val),
        epochs=epochs,
        batch_size=1024,
        shuffle=True,
        callbacks=callbacks,
        verbose=2,
    )
    pred_scaled = model.predict(x_test, batch_size=2048, verbose=0).reshape(-1, 1)
    prediction = target_scaler.inverse_transform(pred_scaled).ravel().clip(min=0)
    actual = y_test.clip(min=0)
    metrics = {
        "candidate": metric_report(actual, prediction),
        "persistence_baseline": metric_report(actual, persistence.clip(min=0)),
        "mae_improvement_vs_persistence_percent": float(
            (1 - metric_report(actual, prediction)["mae_kwh_per_5min"] / metric_report(actual, persistence.clip(min=0))["mae_kwh_per_5min"]) * 100
        ),
    }

    output_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    candidate_dir = output_root / f"uci-household-5min-{stamp}-{uuid.uuid4().hex[:8]}"
    candidate_dir.mkdir(parents=False, exist_ok=False)
    model.save(candidate_dir / "model.keras")
    (candidate_dir / "input_scaler.json").write_text(json.dumps({"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}), encoding="utf-8")
    (candidate_dir / "target_scaler.json").write_text(json.dumps({"mean": target_scaler.mean_.tolist(), "scale": target_scaler.scale_.tolist()}), encoding="utf-8")
    digest = hashlib.sha256()
    with data_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    data_hash = digest.hexdigest()
    metadata = {
        "model_version": candidate_dir.name,
        "source": "external_candidate",
        "dataset": "UCI Individual Household Electric Power Consumption",
        "dataset_doi": "10.24432/C58K54",
        "dataset_license": "CC BY 4.0",
        "dataset_sha256": data_hash,
        "dataset_file": data_path.name,
        "task": "single-household aggregate next-5-minute energy forecasting",
        "target_column": "Global_active_power integrated across the next five one-minute measurements",
        "target_unit": "kWh per 5-minute interval",
        "sequence_length": SEQUENCE_LENGTH,
        "sampling_interval_seconds": 300,
        "forecast_horizon_seconds": 300,
        "feature_columns": FEATURE_COLUMNS,
        "preprocessing": "complete five-minute bins only; no imputation; StandardScaler fit on chronological training period only; UTC is not assumed (source timestamps are naive local time)",
        "split": {"method": "chronological", "train_before": str(cut70), "validation_before": str(cut85), "test_after": str(cut85)},
        "complete_bins": int(len(features_frame)),
        "train_samples": int(train_mask.sum()),
        "validation_samples": int(val_mask.sum()),
        "test_samples": int(test_mask.sum()),
        "epochs_completed": len(history.history["loss"]),
        "metrics": metrics,
        "activation": "not activated; incompatible with the app's legacy 19-feature, 5-second appliance prediction contract",
    }
    (candidate_dir / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    (candidate_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return candidate_dir


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--epochs", type=int, default=12)
    args = parser.parse_args()
    candidate = train(args.data, args.output_root, args.epochs)
    print(json.dumps({"candidate_dir": str(candidate), "metadata": json.loads((candidate / "metadata.json").read_text(encoding="utf-8"))}, indent=2))


if __name__ == "__main__":
    main()
