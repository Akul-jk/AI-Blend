import pandas as pd
import numpy as np
import os
import json
from config import DATASETS_DIR, MODELS_DIR
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def report_stats():
    csv_path = os.path.join(DATASETS_DIR, 'synthetic_telemetry.csv')
    df = pd.read_csv(csv_path)

    # recreate y
    df = df.sort_values(by=['appliance_id', 'timestamp'])
    energy_intervals = []
    for _, group in df.groupby('appliance_id'):
        energy_intervals.extend(group['energy'].diff().fillna(0).tolist())

    y = np.array(energy_intervals)

    print("TARGET STATISTICS (energy increment per interval in kWh):")
    print(f"Target Min: {np.min(y):.6f}")
    print(f"Target Max: {np.max(y):.6f}")
    print(f"Target Mean: {np.mean(y):.6f}")
    print(f"Target Std: {np.std(y):.6f}")

    metrics_path = os.path.join(MODELS_DIR, 'metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        print("\nMODEL METRICS (original units):")
        print(f"MAE: {metrics.get('mae', 0):.6f} kWh")
        print(f"RMSE: {metrics.get('rmse', 0):.6f} kWh")
        print(f"R²: {metrics.get('r2', 0):.6f}")
        print(f"MAPE: {metrics.get('mape', 0):.2f}%")

if __name__ == "__main__":
    report_stats()
