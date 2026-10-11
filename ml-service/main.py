from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
import joblib
import json
import hashlib
import hmac
import os
import tempfile
from pathlib import Path
import pandas as pd
import numpy as np

from config import SEQUENCE_LENGTH, FEATURE_COLUMNS, SAMPLING_INTERVAL_SECONDS, SAMPLING_INTERVAL_MS, FORECAST_HORIZON_INTERVALS, TARGET
from simulation import generate_dataset
from lstm_model import train_model
from anomaly import detect_anomalies
from data_pipeline import preprocess_data
from model_registry import default_registry, ModelRegistryError, MAX_PACKAGE_BYTES
from staging_runner import StagingRunnerError

import tensorflow as tf

app = FastAPI(title="Smart Energy Monitor ML Service")


def require_model_management_token(request: Request) -> None:
    expected = os.environ.get("ML_INTERNAL_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "Model-management API is disabled: ML_INTERNAL_TOKEN is not configured.")
    supplied = request.headers.get("x-ml-internal-token", "")
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, "Unauthorized model-management request.")


def validate_model_upload_headers(headers) -> None:
    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in {"application/zip", "application/octet-stream"}:
        raise HTTPException(415, "Upload must be a ZIP package.")
    declared_length = headers.get("content-length")
    if declared_length:
        try:
            if int(declared_length) > MAX_PACKAGE_BYTES:
                raise HTTPException(413, "Model package exceeds the 128 MiB upload limit.")
        except ValueError as exc:
            raise HTTPException(400, "Invalid Content-Length header.") from exc


async def read_model_upload(request: Request) -> bytes:
    validate_model_upload_headers(request.headers)
    chunks = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_PACKAGE_BYTES:
            raise HTTPException(413, "Model package exceeds the 128 MiB upload limit.")
        chunks.append(chunk)
    if not size:
        raise HTTPException(400, "Model package is empty.")
    return b"".join(chunks)


def store_uploaded_archive(data: bytes) -> Path:
    registry = default_registry()
    registry.state()
    registry.staging_dir.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix="upload-", suffix=".zip", dir=registry.staging_dir)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
    return Path(name)


def rejected_upload(data: bytes, reason: str) -> dict:
    digest = hashlib.sha256(data).hexdigest()
    try:
        record = default_registry().record_rejection(digest, reason)
        rejection_id = record["id"]
    except ModelRegistryError:
        rejection_id = digest[:16]
    return {"status": "rejected", "id": rejection_id if str(rejection_id).startswith("rejected-") else f"rejected-{rejection_id}", "package_sha256": digest,
            "report": {"status": "rejected", "reason": str(reason)[:1000]}}

class TelemetryReading(BaseModel):
    timestamp: str
    voltage: float = Field(ge=0, le=300)
    current: float = Field(ge=0, le=250)
    power: float = Field(ge=0, le=50000)
    energy: float = Field(ge=0)
    interval_energy_kwh: Optional[float] = Field(default=None, ge=0)
    frequency: float = Field(ge=45, le=65)
    power_factor: float = Field(ge=0, le=1)

class PredictRequest(BaseModel):
    appliance_id: str
    recent_readings: List[TelemetryReading]

class AnomalyRequest(BaseModel):
    readings: List[dict]

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/dataset/generate")
def generate_data(background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_dataset)
    return {"message": "Dataset generation started in background."}

@app.post("/train")
def train(background_tasks: BackgroundTasks):
    background_tasks.add_task(train_model)
    return {"message": "Model training started in background."}

@app.post("/predict")
def predict(req: PredictRequest):
    if len(req.recent_readings) != SEQUENCE_LENGTH:
        raise HTTPException(400, f"Expected exactly {SEQUENCE_LENGTH} readings.")
    timestamps = pd.to_datetime([r.timestamp for r in req.recent_readings], format='mixed', utc=True, errors='coerce')
    if timestamps.isna().any() or not timestamps.is_monotonic_increasing:
        raise HTTPException(400, "Readings must have valid, strictly ordered timestamps.")
    if len(timestamps) > 1:
        gaps = timestamps.to_series().diff().dt.total_seconds().dropna()
        if (gaps < SAMPLING_INTERVAL_SECONDS * 0.5).any() or (gaps > SAMPLING_INTERVAL_SECONDS * 1.5).any():
            raise HTTPException(400, "Readings do not match the configured sampling cadence.")
    if any(r.interval_energy_kwh is None for r in req.recent_readings):
        raise HTTPException(400, "Each reading must include interval_energy_kwh.")

    df = pd.DataFrame([r.dict() for r in req.recent_readings])
    df['appliance_id'] = req.appliance_id

    try:
        artifacts = default_registry().active_artifacts()
        metadata = json.loads(artifacts['metadata'].read_text(encoding='utf-8'))
        active_record = artifacts['record']
        if (metadata.get('model_version') != active_record.get('model_version')
                or metadata.get('feature_columns', metadata.get('feature_order')) != FEATURE_COLUMNS
                or metadata.get('sequence_length') != SEQUENCE_LENGTH
                or metadata.get('sampling_interval_ms') != SAMPLING_INTERVAL_MS):
            raise HTTPException(409, "Model metadata is incompatible with this service configuration.")
        scaled_features, _, _ = preprocess_data(
            df, is_training=False,
            scaler_path=str(artifacts['input_scaler']),
            target_scaler_path=str(artifacts['target_scaler']),
        )
        X = np.expand_dims(scaled_features[-SEQUENCE_LENGTH:], axis=0)

        model = tf.keras.models.load_model(artifacts['model'], safe_mode=True, compile=False)
        if tuple(model.input_shape[1:]) != (SEQUENCE_LENGTH, len(FEATURE_COLUMNS)) or model.output_shape[-1] != 1:
            raise HTTPException(409, "Model input/output shape does not match the canonical feature contract.")
        pred_scaled = model.predict(X)[0][0]
        if artifacts['target_scaler'].suffix == '.json':
            target_scaler = json.loads(artifacts['target_scaler'].read_text(encoding='utf-8'))
            pred_unscaled = (pred_scaled - target_scaler['min'][0]) / target_scaler['scale'][0]
        else:
            target_scaler = joblib.load(artifacts['target_scaler'])
            pred_unscaled = target_scaler.inverse_transform([[pred_scaled]])[0][0]
        pred_unscaled = float(np.clip(pred_unscaled, a_min=0, a_max=None))

        return {
            "source": "package" if active_record.get("source") == "package" else metadata.get('source', 'simulation'),
            "model": "energy_lstm",
            "model_version": metadata['model_version'],
            "appliance_id": req.appliance_id,
            "prediction": pred_unscaled,
            "unit": "kWh",
            "target": TARGET,
            "forecast_horizon_intervals": FORECAST_HORIZON_INTERVALS,
            "forecast_horizon_seconds": SAMPLING_INTERVAL_SECONDS * FORECAST_HORIZON_INTERVALS,
            "timestamp": df['timestamp'].iloc[-1]
        }
    except HTTPException:
        raise
    except ModelRegistryError as e:
        raise HTTPException(503, str(e)) from e
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/evaluate")
def evaluate():
    return get_metrics()

@app.get("/model")
def get_model():
    try:
        artifacts = default_registry().active_artifacts()
    except (ModelRegistryError, FileNotFoundError):
        return {"name": "LSTM Energy Forecaster", "version": None, "status": "not_trained", "dataset_source": "simulation", "features": FEATURE_COLUMNS, "sequence_length": SEQUENCE_LENGTH, "sampling_interval": f"{SAMPLING_INTERVAL_MS}ms", "training_date": None, "appliance_scope": "per-appliance sequence", "metrics": None}
    metadata = json.loads(artifacts['metadata'].read_text(encoding='utf-8'))
    metrics = artifacts['record'].get('evaluation_metrics')
    if metrics is None and 'metrics' in artifacts['record'].get('files', {}):
        metric_path = artifacts['directory'] / artifacts['record']['files']['metrics']['name']
        if metric_path.is_file():
            metrics = json.loads(metric_path.read_text(encoding='utf-8'))
    package_source = artifacts['record'].get('source') == 'package'
    return {"name": "LSTM Energy Forecaster", "version": metadata['model_version'], "status": "trained", "active_version": artifacts['version'], "dataset_source": metadata.get('training_data') if package_source else metadata.get('source', 'simulation'), "features": metadata.get('feature_columns', metadata.get('feature_order', FEATURE_COLUMNS)), "sequence_length": metadata['sequence_length'], "sampling_interval": f"{metadata.get('sampling_interval_ms', SAMPLING_INTERVAL_MS)}ms", "forecast_horizon_seconds": metadata.get('forecast_horizon_seconds'), "target": metadata.get('target_column', metadata.get('target', TARGET)), "training_date": metadata.get('training_timestamp', metadata.get('created_at_utc')), "appliance_scope": metadata.get('appliance_scope', 'per-appliance sequence'), "metrics": metrics}

@app.get("/metrics")
def get_metrics():
    try:
        artifacts = default_registry().active_artifacts()
    except (ModelRegistryError, FileNotFoundError):
        return {"message": "No evaluation metrics found."}
    if 'metrics' in artifacts['record'].get('files', {}):
        metrics_path = artifacts['directory'] / artifacts['record']['files']['metrics']['name']
        if metrics_path.is_file():
            return json.loads(metrics_path.read_text(encoding='utf-8'))
    metadata = json.loads(artifacts['metadata'].read_text(encoding='utf-8'))
    metrics = artifacts['record'].get('evaluation_metrics')
    if metrics is not None:
        return metrics
    return {"message": "No metrics available."}

@app.get("/models")
def list_models():
    try:
        artifacts = default_registry().active_artifacts()
        return sorted(path.name for path in artifacts['directory'].iterdir() if path.is_file())
    except (ModelRegistryError, FileNotFoundError):
        return []


@app.get("/management/models")
def management_list_models(request: Request):
    require_model_management_token(request)
    registry = default_registry()
    return {"active_version": registry.active_version(), "models": registry.list_models()}


@app.get("/management/models/{version}")
def management_model_details(version: str, request: Request):
    require_model_management_token(request)
    try:
        return default_registry().get_model(version)
    except ModelRegistryError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/management/history")
def management_history(request: Request):
    require_model_management_token(request)
    return default_registry().version_history()


@app.post("/management/models/validate")
async def management_validate_model(request: Request):
    require_model_management_token(request)
    data = await read_model_upload(request)
    path = store_uploaded_archive(data)
    try:
        report = default_registry().validate_candidate(path)
        report["package_sha256"] = hashlib.sha256(data).hexdigest()
        return report
    except Exception as exc:
        return rejected_upload(data, str(exc))
    finally:
        path.unlink(missing_ok=True)


@app.post("/management/models/stage")
async def management_stage_model(request: Request):
    require_model_management_token(request)
    data = await read_model_upload(request)
    path = store_uploaded_archive(data)
    try:
        staged = default_registry().stage_candidate(path)
        report = default_registry().get_model(staged["version"]).get("validation_report") or {}
        return {**staged, **report}
    except Exception as exc:
        return rejected_upload(data, str(exc))
    finally:
        path.unlink(missing_ok=True)


def prepare_model_for_activation(directory: Path, record: dict) -> None:
    """Load the immutable validated model and JSON scalers before pointer swap."""
    model_file = directory / record["files"]["model"]["name"]
    input_scaler_file = directory / record["files"]["input_scaler"]["name"]
    target_scaler_file = directory / record["files"]["target_scaler"]["name"]
    model = tf.keras.models.load_model(model_file, compile=False, safe_mode=True, custom_objects=None)
    if tuple(model.input_shape) != (None, SEQUENCE_LENGTH, len(FEATURE_COLUMNS)) or tuple(model.output_shape) != (None, 1):
        raise ValueError("Model input/output shapes do not match the registered contract.")
    input_scaler = json.loads(input_scaler_file.read_text(encoding="utf-8"))
    target_scaler = json.loads(target_scaler_file.read_text(encoding="utf-8"))
    input_mean = np.asarray(input_scaler.get("mean"), dtype=float)
    input_scale = np.asarray(input_scaler.get("scale"), dtype=float)
    target_scale = np.asarray(target_scaler.get("scale"), dtype=float)
    target_min = np.asarray(target_scaler.get("min"), dtype=float)
    if (input_mean.shape != (len(FEATURE_COLUMNS),) or input_scale.shape != input_mean.shape
            or target_scale.shape != (1,) or target_min.shape != (1,)
            or not all(np.isfinite(x).all() for x in (input_mean, input_scale, target_scale, target_min))
            or (input_scale <= 0).any() or (target_scale <= 0).any()):
        raise ValueError("Registered scaler parameters are malformed.")
    probe = np.asarray(model(np.zeros((1, SEQUENCE_LENGTH, len(FEATURE_COLUMNS)), dtype=np.float32), training=False))
    if probe.shape != (1, 1) or not np.isfinite(probe).all():
        raise ValueError("Registered model activation probe failed.")


@app.post("/management/models/{version}/activate")
def management_activate_model(version: str, request: Request):
    require_model_management_token(request)
    try:
        return default_registry().activate(version, prepare_model_for_activation)
    except ModelRegistryError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Activation preparation failed: {str(exc)[:500]}") from exc


@app.post("/management/rollback")
async def management_rollback(request: Request):
    require_model_management_token(request)
    body = await request.json()
    version = body.get("version") if isinstance(body, dict) else None
    try:
        return default_registry().rollback(prepare_model_for_activation, version)
    except ModelRegistryError as exc:
        raise HTTPException(409, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Rollback preparation failed: {str(exc)[:500]}") from exc


@app.delete("/management/models/{version}")
def management_delete_model(version: str, request: Request):
    require_model_management_token(request)
    try:
        return default_registry().delete_model(version)
    except ModelRegistryError as exc:
        raise HTTPException(409, str(exc)) from exc

@app.post("/anomaly/detect")
def detect_anomaly(req: AnomalyRequest):
    anomalies = detect_anomalies(req.readings)
    return {"anomalies": anomalies}
