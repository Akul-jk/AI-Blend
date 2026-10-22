"""Export the backend's canonical simulated telemetry for model training.

This module intentionally does not create a second synthetic data source.
"""
import os
import sqlite3
import uuid
from datetime import datetime, timezone
import pandas as pd
from config import DATASET_EXPORTS_DIR


def generate_dataset():
    db_path = os.environ.get("DB_FILE", os.path.join(os.path.dirname(__file__), "..", "backend", "database.sqlite"))
    db_path = os.path.abspath(db_path)
    if not os.path.isfile(db_path):
        raise FileNotFoundError(f"Telemetry database not found: {db_path}")
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        frame = pd.read_sql_query("""
            SELECT timestamp, pzem_id, appliance_id, voltage, current, power, energy,
                   interval_energy_kwh, frequency, power_factor, source, quality
            FROM telemetry
            WHERE source = 'simulation' AND quality = 'valid'
            ORDER BY appliance_id, timestamp, id
        """, connection)
    finally:
        connection.close()
    if frame.empty:
        raise ValueError("No valid simulated telemetry is available to export")
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    os.makedirs(DATASET_EXPORTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output_path = os.path.join(DATASET_EXPORTS_DIR, f"canonical_simulation_telemetry_{stamp}_{uuid.uuid4().hex[:8]}.csv")
    frame.to_csv(output_path, index=False, mode="x")
    print(f"Exported {len(frame)} canonical telemetry rows to {output_path}")
    return output_path


if __name__ == "__main__":
    generate_dataset()
