import os
import hashlib
from datetime import datetime, timezone
import json
import numpy as np
import joblib
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from config import SEQUENCE_LENGTH, N_FEATURES, MODELS_DIR, DATASETS_DIR, FEATURE_COLUMNS, TARGET, SAMPLING_INTERVAL_SECONDS, SAMPLING_INTERVAL_MS, FORECAST_HORIZON_INTERVALS, MODEL_VERSION
from data_pipeline import prepare_datasets

def build_model(input_shape):
    model = Sequential([
        LSTM(128, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(64),
        Dropout(0.2),
        Dense(32, activation='relu'),
        # ReLU ensures non-negative predictions
        Dense(1, activation='relu')
    ])
    model.compile(loss='mse', optimizer='adam')
    return model

def calculate_wape(y_true, y_pred):
    # Weighted Absolute Percentage Error is zero-safe
    # WAPE = sum(|y_true - y_pred|) / sum(y_true)
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    sum_true = np.sum(y_true)
    if sum_true == 0:
        return 0.0
    return (np.sum(np.abs(y_true - y_pred)) / sum_true) * 100

def train_model():
    os.makedirs(MODELS_DIR, exist_ok=True)
    print("Loading and preparing datasets...")
    csv_path = os.path.join(DATASETS_DIR, 'canonical_simulation_telemetry.csv')
    (X_train, y_train), (X_val, y_val), (X_test, y_test) = prepare_datasets(csv_path)

    print(f"X_train shape: {X_train.shape}, y_train shape: {y_train.shape}")

    model = build_model((SEQUENCE_LENGTH, N_FEATURES))
    model_path = os.path.join(MODELS_DIR, 'lstm_model.keras')

    callbacks = [
        EarlyStopping(patience=5, restore_best_weights=True),
        ModelCheckpoint(model_path, save_best_only=True),
        ReduceLROnPlateau(patience=5, factor=0.5, min_lr=1e-5)
    ]

    print("Training model...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=32,
        callbacks=callbacks,
        verbose=1
    )

    print("Evaluating model...")
    target_scaler = joblib.load(os.path.join(MODELS_DIR, 'target_scaler.save'))

    # Predict on scaled test set
    y_pred_scaled = model.predict(X_test).flatten()

    # Inverse transform to original units (kWh)
    y_test_unscaled = target_scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()
    y_pred_unscaled = target_scaler.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

    # Strictly enforce non-negative physically (in case scaler introduces tiny negative floats)
    y_pred_unscaled = np.clip(y_pred_unscaled, a_min=0, a_max=None)

    mae = mean_absolute_error(y_test_unscaled, y_pred_unscaled)
    rmse = np.sqrt(mean_squared_error(y_test_unscaled, y_pred_unscaled))
    r2 = r2_score(y_test_unscaled, y_pred_unscaled)

    # Traditional MAPE is highly unstable when target contains zeros (or near zeros).
    # Appliances are frequently off (0 kWh). WAPE handles this safely.
    wape = calculate_wape(y_test_unscaled, y_pred_unscaled)

    # Also calculate ordinary MAPE for transparency
    def calc_mape(yt, yp):
        non_zero = yt != 0
        if np.sum(non_zero) == 0: return 0.0
        return np.mean(np.abs((yt[non_zero] - yp[non_zero]) / yt[non_zero])) * 100
    mape = calc_mape(y_test_unscaled, y_pred_unscaled)

    metrics = {
        'mae': float(mae),
        'rmse': float(rmse),
        'r2': float(r2),
        'mape': float(mape),
        'wape': float(wape),
        'min_pred': float(np.min(y_pred_unscaled)),
        'max_pred': float(np.max(y_pred_unscaled)),
        'negative_count': int(np.sum(y_pred_unscaled < 0)),
        'test_samples': int(len(y_test_unscaled)),
        'target': TARGET,
        'unit': 'kWh'
    }

    print("Evaluation Metrics (Original Units):")
    for k, v in metrics.items():
        print(f"{k.upper()}: {v}")

    metrics_path = os.path.join(MODELS_DIR, 'metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)

    with open(csv_path, 'rb') as dataset_file:
        dataset_version = hashlib.sha256(dataset_file.read()).hexdigest()[:16]
    metadata = {
        'model_version': MODEL_VERSION,
        'dataset_version': dataset_version,
        'training_timestamp': datetime.now(timezone.utc).isoformat(),
        'features': FEATURE_COLUMNS,
        'feature_order': FEATURE_COLUMNS,
        'sequence_length': SEQUENCE_LENGTH,
        'sampling_interval_seconds': SAMPLING_INTERVAL_SECONDS,
        'sampling_interval_ms': SAMPLING_INTERVAL_MS,
        'forecast_horizon_intervals': FORECAST_HORIZON_INTERVALS,
        'forecast_horizon_seconds': SAMPLING_INTERVAL_SECONDS * FORECAST_HORIZON_INTERVALS,
        'target': TARGET,
        'metrics': metrics,
        'appliance_scope': 'per-appliance sequence',
        'source': 'simulation',
        'epochs_completed': len(history.history.get('loss', [])),
        'batch_size': 32,
    }
    with open(os.path.join(MODELS_DIR, 'metadata.json'), 'w') as metadata_file:
        json.dump(metadata, metadata_file, indent=2)

    return metrics

if __name__ == "__main__":
    train_model()
