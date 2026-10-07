import os
import json
import numpy as np
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from config import MODELS_DIR, DATASETS_DIR
from data_pipeline import prepare_datasets

def evaluate_best_model():
    csv_path = os.path.join(DATASETS_DIR, 'synthetic_telemetry.csv')
    _, _, (X_test, y_test) = prepare_datasets(csv_path)

    model_path = os.path.join(MODELS_DIR, 'lstm_model.keras')
    model = tf.keras.models.load_model(model_path)

    y_pred = model.predict(X_test).flatten()

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    def calculate_mape(y_true, y_pred):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        non_zero = y_true != 0
        if np.sum(non_zero) == 0: return 0.0
        return np.mean(np.abs((y_true[non_zero] - y_pred[non_zero]) / y_true[non_zero])) * 100

    mape = calculate_mape(y_test, y_pred)

    metrics = {
        'mae': float(mae),
        'rmse': float(rmse),
        'r2': float(r2),
        'mape': float(mape)
    }

    metrics_path = os.path.join(MODELS_DIR, 'metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)

    print(json.dumps(metrics))

if __name__ == "__main__":
    evaluate_best_model()
