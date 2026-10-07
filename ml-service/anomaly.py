import numpy as np
import pandas as pd

def detect_anomalies(data, window=60):
    df = pd.DataFrame(data)

    target_col = 'power' if 'power' in df.columns else 'energy'

    df['rolling_mean'] = df[target_col].rolling(window=window, min_periods=1).mean()
    df['rolling_std'] = df[target_col].rolling(window=window, min_periods=1).std().fillna(0)

    df['upper_bound'] = df['rolling_mean'] + 2 * df['rolling_std']
    df['lower_bound'] = df['rolling_mean'] - 2 * df['rolling_std']

    anomalies = []

    for i, row in df.iterrows():
        val = row[target_col]
        mean = row['rolling_mean']
        std = row['rolling_std']

        is_anomaly = val > row['upper_bound'] or val < row['lower_bound']

        if is_anomaly and std > 0:
            if mean == 0:
                deviation = float('inf') if val > 0 else 0
            else:
                deviation = abs((val - mean) / mean) * 100

            if deviation > 100:
                severity = "CRITICAL"
            elif deviation >= 50:
                severity = "WARNING"
            else:
                severity = "INFO"

            anomalies.append({
                'timestamp': row.get('timestamp', i),
                'value': val,
                'mean': mean,
                'deviation_percent': deviation,
                'severity': severity
            })

    return anomalies
