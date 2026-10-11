import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_VERSION = "energy_lstm_sim_v1"
MODELS_DIR = os.path.join(BASE_DIR, "models", "simulation", MODEL_VERSION)
MODEL_STORE_DIR = os.path.abspath(os.environ.get("MODEL_STORE_DIR", os.path.join(BASE_DIR, "models", "managed")))
DATASETS_DIR = os.path.join(BASE_DIR, "datasets", "simulation")


SEQUENCE_LENGTH = 60
SAMPLING_INTERVAL_MS = int(os.environ.get("SIMULATION_INTERVAL_MS", "5000"))
SAMPLING_INTERVAL_SECONDS = SAMPLING_INTERVAL_MS / 1000.0
FORECAST_HORIZON_INTERVALS = 1
N_FEATURES = 19
TARGET = 'energy_interval'
RANDOM_SEED = 42

FEATURE_COLUMNS = [
    'voltage', 'current', 'power', 'energy', 'frequency', 'power_factor',
    'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'month_sin', 'month_cos',
    'is_weekend',
    'energy_lag_1', 'energy_lag_2', 'energy_lag_3',
    'power_lag_1', 'power_lag_2', 'power_lag_3'
]

DEFAULT_APPLIANCES = {
    'APP-001': {'pzem_id': 'PZEM-001', 'name': 'Refrigerator'},
    'APP-002': {'pzem_id': 'PZEM-002', 'name': 'Laptop'},
    'APP-003': {'pzem_id': 'PZEM-003', 'name': 'Fan'},
    'APP-004': {'pzem_id': 'PZEM-004', 'name': 'Lighting'},
    'APP-005': {'pzem_id': 'PZEM-005', 'name': 'TV'},
    'APP-006': {'pzem_id': 'PZEM-006', 'name': 'Phone Charger'}
}
