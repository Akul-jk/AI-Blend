"""Restricted child process for inspecting candidate model artifacts.

This file is launched only by staging_runner.py. Do not import it into the API
process: candidate pickle files are parsed only in the constrained child.
"""
from __future__ import annotations

import io
import json
import math
import pickle
import sys
import zipfile
from pathlib import Path


class ScalerUnpickler(pickle.Unpickler):
    """Permit only sklearn scaler state and NumPy array reconstruction."""
    _allowed = {
        ("sklearn.preprocessing._data", "StandardScaler"),
        ("sklearn.preprocessing._data", "MinMaxScaler"),
        ("numpy", "ndarray"), ("numpy", "dtype"),
        ("numpy.core.multiarray", "_reconstruct"),
        ("numpy.core.multiarray", "scalar"),
        ("numpy._core.multiarray", "_reconstruct"),
        ("numpy._core.multiarray", "scalar"),
        ("builtins", "slice"), ("builtins", "set"),
    }

    def find_class(self, module, name):
        if (module, name) not in self._allowed:
            raise pickle.UnpicklingError(f"forbidden pickle global: {module}.{name}")
        if module == "sklearn.preprocessing._data":
            from sklearn.preprocessing import StandardScaler, MinMaxScaler
            return {"StandardScaler": StandardScaler, "MinMaxScaler": MinMaxScaler}[name]
        if module in {"numpy.core.multiarray", "numpy._core.multiarray"}:
            import numpy as np
            return getattr(np.core.multiarray, name)
        if module == "numpy":
            import numpy as np
            return getattr(np, name)
        return getattr(__import__(module), name)


def read_scaler(path: Path, expected_type, feature_count: int) -> dict:
    raw = path.read_bytes()
    if not raw or len(raw) > 16 * 1024 * 1024:
        raise ValueError(f"{path.name} is empty or too large")
    scaler = ScalerUnpickler(io.BytesIO(raw)).load()
    if type(scaler).__name__ != expected_type or type(scaler).__module__ != "sklearn.preprocessing._data":
        raise ValueError(f"{path.name} is not the declared {expected_type}")
    if getattr(scaler, "n_features_in_", None) != feature_count:
        raise ValueError(f"{path.name} feature count is incompatible")
    import numpy as np
    if expected_type == "StandardScaler":
        mean = np.asarray(scaler.mean_, dtype=np.float64)
        scale = np.asarray(scaler.scale_, dtype=np.float64)
        if mean.shape != (feature_count,) or scale.shape != (feature_count,) or not np.isfinite(mean).all() or not np.isfinite(scale).all() or (scale <= 0).any():
            raise ValueError("input scaler contains malformed or non-finite parameters")
        return {"mean": mean.tolist(), "scale": scale.tolist()}
    scale = np.asarray(scaler.scale_, dtype=np.float64)
    minimum = np.asarray(scaler.min_, dtype=np.float64)
    if scale.shape != (feature_count,) or minimum.shape != (feature_count,) or not np.isfinite(scale).all() or not np.isfinite(minimum).all() or (scale <= 0).any():
        raise ValueError("target scaler contains malformed or non-finite parameters")
    return {"scale": scale.tolist(), "min": minimum.tolist()}


def main(root: Path):
    # Validate scaler artifacts before loading the model.
    input_scaler = read_scaler(root / "input_scaler.pkl", "StandardScaler", 19)
    target_full = read_scaler(root / "target_scaler.pkl", "MinMaxScaler", 1)
    model_path = root / "model.keras"
    with zipfile.ZipFile(model_path) as zf:
        config = json.loads(zf.read("config.json"))
    # safe_mode rejects unsafe Lambda deserialization; custom objects stay empty.
    import numpy as np
    import tensorflow as tf
    model = tf.keras.models.load_model(model_path, compile=False, safe_mode=True, custom_objects=None)
    shape = tuple(model.input_shape)
    if len(shape) != 3 or shape[0] not in (None, 1) or shape[1:] != (60, 19):
        raise ValueError(f"loaded model input shape is incompatible: {shape}")
    output_shape = tuple(model.output_shape)
    if len(output_shape) != 2 or output_shape[0] not in (None, 1) or output_shape[1] != 1:
        raise ValueError(f"loaded model output shape is incompatible: {output_shape}")
    probe_input = np.zeros((1, 60, 19), dtype=np.float32)
    output = model(probe_input, training=False)
    prediction = np.asarray(output, dtype=np.float64)
    if prediction.shape != (1, 1) or not np.isfinite(prediction).all():
        raise ValueError(f"probe output is non-finite or has incompatible shape: {prediction.shape}")
    # Registry's inference contract uses scalar MinMaxScaler params. Preserve
    # only the single output feature after checking the scaler was 1D.
    result = {
        "input_scaler": input_scaler,
        "target_scaler": {"scale": target_full["scale"], "min": target_full["min"]},
        "probe": {"input_shape": [1, 60, 19], "output_shape": list(prediction.shape),
                  "prediction": float(prediction[0, 0]), "finite": True},
        "runtime": {"tensorflow": tf.__version__, "keras": getattr(tf.keras, "__version__", "bundled")},
    }
    print(json.dumps(result, allow_nan=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main(Path(sys.argv[1]).resolve())
    except Exception as exc:
        print(f"staging worker rejected candidate: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(2)
