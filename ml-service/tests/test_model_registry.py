import io
import json
import io
import pickle
import multiprocessing
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from config import FEATURE_COLUMNS
from data_pipeline import preprocess_data
from model_registry import (
    CONTRACT_ID,
    LEGACY_VERSION,
    ModelRegistry,
    ModelRegistryError,
    PREPROCESSING_CONTRACT,
    SEQUENCE_LENGTH,
)


def _hold_registry_lock(store, events, label):
    registry = ModelRegistry(store)
    with registry._process_lock():
        events.put(("start", label))
        time.sleep(0.15)
        events.put(("end", label))


def make_model_archive(input_shape=None, output_units=1):
    input_shape = input_shape or [None, SEQUENCE_LENGTH, len(FEATURE_COLUMNS)]
    buffer = io.BytesIO()
    config = {
        "config": {
            "layers": [
                {"class_name": "InputLayer", "config": {"batch_shape": input_shape}},
                {"class_name": "Dense", "config": {"units": output_units}},
            ]
        }
    }
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("config.json", json.dumps(config))
        archive.writestr("model.weights.h5", b"fixture weights")
    return buffer.getvalue()


def valid_members():
    metadata = {
        "model_id": "fixture-lstm",
        "model_version": "1.0.0",
        "created_at_utc": "2026-10-10T17:40:45+00:00",
        "framework": "TensorFlow/Keras",
        "tensorflow_version": "2.18.1",
        "model_type": "LSTM",
        "training_data": "synthetic fixture data",
        "model_format": ".keras",
        "feature_columns_file": "feature_columns.json",
        "input_scaler_file": "input_scaler.pkl",
        "target_scaler_file": "target_scaler.pkl",
        "sequence_length": 60,
        "feature_count": 19,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": "interval_energy_kwh",
        "target_unit": "kWh",
        "contract_id": CONTRACT_ID,
        "sampling_interval_ms": 5000,
        "preprocessing": PREPROCESSING_CONTRACT,
        "scalers": {
            "input": {"class": "StandardScaler", "features": 19},
            "target": {"class": "MinMaxScaler", "features": 1},
        },
    }
    return {
        "model.keras": make_model_archive(),
        "input_scaler.pkl": b"never deserialized in this process",
        "target_scaler.pkl": b"never deserialized in this process",
        "feature_columns.json": json.dumps(FEATURE_COLUMNS).encode(),
        "metadata.json": json.dumps(metadata).encode(),
        "bias_corrections.json": b"{}",
        "selected_methods.json": b"{}",
        "README.md": b"fixture model package",
    }


def write_zip(path, members):
    with zipfile.ZipFile(path, "w") as archive:
        for name, contents in members.items():
            archive.writestr(name, contents)


def staging_result():
    return {
        "input_scaler": {"mean": [0.0] * 19, "scale": [1.0] * 19},
        "target_scaler": {"scale": [1.0], "min": [0.0]},
        "probe": {"input_shape": [1, 60, 19], "output_shape": [1, 1], "finite": True, "prediction": 0.25},
    }


class ModelRegistryTests(unittest.TestCase):
    def setUp(self):
        test_tmp = Path(__file__).resolve().parents[1] / ".tmp"
        test_tmp.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=test_tmp)
        root = Path(self.temp.name)
        self.legacy = root / "legacy"
        self.legacy.mkdir()
        (self.legacy / "lstm_model.keras").write_bytes(b"legacy model")
        (self.legacy / "scaler.save").write_bytes(b"legacy input scaler")
        (self.legacy / "target_scaler.save").write_bytes(b"legacy target scaler")
        (self.legacy / "metadata.json").write_text(json.dumps({
            "model_version": "energy_lstm_sim_v1",
            "feature_order": FEATURE_COLUMNS,
            "sequence_length": 60,
            "sampling_interval_ms": 5000,
        }), encoding="utf-8")
        (self.legacy / "metrics.json").write_text("{}", encoding="utf-8")
        self.store = root / "managed"
        self.registry = ModelRegistry(self.store, self.legacy)
        self.registry.initialize()

    def tearDown(self):
        self.temp.cleanup()

    def candidate_zip(self, members=None):
        path = Path(self.temp.name) / "candidate.zip"
        write_zip(path, members or valid_members())
        return path

    def stage_with_test_worker(self, path, result=None, failure=None):
        from unittest.mock import patch
        class TestWorker:
            def __call__(_self, *_args):
                if failure:
                    raise failure
                return result if result is not None else staging_result()
        with patch("model_registry.IsolatedStagingRunner", return_value=TestWorker()):
            return self.registry.stage_candidate(path)

    def test_initialization_and_restart_keep_legacy_active(self):
        restarted = ModelRegistry(self.store, self.legacy)
        self.assertEqual(restarted.state()["active_version"], LEGACY_VERSION)
        self.assertEqual(restarted.active_artifacts()["model"], self.legacy / "lstm_model.keras")

    def test_package_can_be_staged_and_persists_across_registry_restart(self):
        path = self.candidate_zip()
        before = path.read_bytes()
        result = self.stage_with_test_worker(path)
        self.assertEqual(path.read_bytes(), before)
        self.assertEqual(result["status"], "validated")
        restarted = ModelRegistry(self.store, self.legacy)
        self.assertIn(result["version"], restarted.state()["versions"])
        self.assertEqual(restarted.state()["active_version"], LEGACY_VERSION)

    def test_staging_runner_cannot_be_replaced_by_callback_and_failure_preserves_active(self):
        with self.assertRaises(TypeError):
            self.registry.stage_candidate(self.candidate_zip(), lambda *_: staging_result())
        with self.assertRaisesRegex(RuntimeError, "probe failed"):
            self.stage_with_test_worker(self.candidate_zip(), failure=RuntimeError("probe failed"))
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)
        self.assertFalse(any(self.registry.staging_dir.glob("candidate-*")))

    def test_failed_validation_does_not_publish_or_change_active(self):
        members = valid_members()
        members["feature_columns.json"] = json.dumps(list(reversed(FEATURE_COLUMNS))).encode()
        with self.assertRaisesRegex(ModelRegistryError, "feature order"):
            self.registry.stage_candidate(self.candidate_zip(members))
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)
        self.assertEqual(list(self.registry.versions_dir.glob("*")) if self.registry.versions_dir.exists() else [], [])

    def test_bad_model_shape_is_rejected(self):
        members = valid_members()
        members["model.keras"] = make_model_archive([None, 59, 19])
        with self.assertRaisesRegex(ModelRegistryError, "input shape"):
            self.registry.stage_candidate(self.candidate_zip(members))

    def test_incompatible_scaler_dimensions_are_rejected_by_staging_result(self):
        invalid = staging_result()
        invalid["input_scaler"]["mean"] = [0.0] * 18
        with self.assertRaisesRegex(ModelRegistryError, "scaler or inference dimensions"):
            self.stage_with_test_worker(self.candidate_zip(), result=invalid)
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)

    def test_nonfinite_probe_is_rejected_without_changing_active(self):
        invalid = staging_result()
        invalid["probe"]["prediction"] = float("nan")
        with self.assertRaisesRegex(ModelRegistryError, "non-finite"):
            self.stage_with_test_worker(self.candidate_zip(), result=invalid)
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)

    def test_scaler_unpickler_rejects_unapproved_globals(self):
        from staging_worker import ScalerUnpickler
        import os
        payload = pickle.dumps(os.system)
        with self.assertRaisesRegex(pickle.UnpicklingError, "forbidden pickle global"):
            ScalerUnpickler(io.BytesIO(payload)).load()

    def test_scaler_unpickler_rejects_malformed_artifact(self):
        from staging_worker import read_scaler
        path = Path(self.temp.name) / "malformed.pkl"
        path.write_bytes(b"not a pickle")
        with self.assertRaises(pickle.UnpicklingError):
            read_scaler(path, "StandardScaler", 19)

    def test_registry_file_lock_serializes_separate_worker_processes(self):
        context = multiprocessing.get_context("spawn")
        events = context.Queue()
        first = context.Process(target=_hold_registry_lock, args=(str(self.store), events, "one"))
        second = context.Process(target=_hold_registry_lock, args=(str(self.store), events, "two"))
        first.start(); second.start()
        observed = [events.get(timeout=10) for _ in range(4)]
        first.join(10); second.join(10)
        self.assertEqual(first.exitcode, 0)
        self.assertEqual(second.exitcode, 0)
        self.assertIn(observed, [
            [("start", "one"), ("end", "one"), ("start", "two"), ("end", "two")],
            [("start", "two"), ("end", "two"), ("start", "one"), ("end", "one")],
        ])

    def test_staging_runner_reports_worker_failure(self):
        from staging_runner import IsolatedStagingRunner, StagingRunnerError
        class FakeProcess:
            _handle = 1
            stdout = io.BytesIO(b"")
            stderr = io.BytesIO(b"bad candidate")
            def wait(self, timeout=None): return 2
            def poll(self): return 2
        class FakeJob:
            def __init__(self, _): pass
            def resume(self, _): pass
            def close(self): pass
            def terminate(self): pass
        with patch("staging_runner.subprocess.Popen", return_value=FakeProcess()), patch("staging_runner._WindowsJob", FakeJob):
            with self.assertRaisesRegex(StagingRunnerError, "bad candidate"):
                IsolatedStagingRunner()(Path(self.temp.name), {})

    def test_staging_runner_timeout_terminates_worker(self):
        from staging_runner import IsolatedStagingRunner, StagingRunnerError
        class FakeProcess:
            _handle = 1
            stdout = io.BytesIO(b"")
            stderr = io.BytesIO(b"")
            def __init__(self): self.waits = 0; self.terminated = False
            def wait(self, timeout=None):
                self.waits += 1
                if self.waits == 1: raise __import__("subprocess").TimeoutExpired("worker", timeout)
                return -1
            def poll(self): return None if self.waits < 2 else -1
        process = FakeProcess()
        class FakeJob:
            def __init__(self, _): pass
            def resume(self, _): pass
            def close(self): pass
            def terminate(self): process.terminated = True
        with patch("staging_runner.subprocess.Popen", return_value=process), patch("staging_runner._WindowsJob", FakeJob):
            with self.assertRaisesRegex(StagingRunnerError, "wall-clock limit"):
                IsolatedStagingRunner(timeout_seconds=1)(Path(self.temp.name), {})
        self.assertTrue(process.terminated)

    def test_sampling_cadence_mismatch_is_rejected(self):
        members = valid_members()
        metadata = json.loads(members["metadata.json"])
        metadata["sampling_interval_ms"] = 1000
        members["metadata.json"] = json.dumps(metadata).encode()
        with self.assertRaisesRegex(ModelRegistryError, "sampling_interval_ms"):
            self.registry.stage_candidate(self.candidate_zip(members))

    def test_malformed_missing_oversized_and_traversal_archives_are_rejected(self):
        malformed = Path(self.temp.name) / "malformed.zip"
        malformed.write_bytes(b"not a zip")
        with self.assertRaisesRegex(ModelRegistryError, "not a valid ZIP"):
            self.registry.stage_candidate(malformed)
        missing = valid_members()
        del missing["README.md"]
        with self.assertRaisesRegex(ModelRegistryError, "missing required"):
            self.registry.stage_candidate(self.candidate_zip(missing))
        traversal = valid_members()
        traversal["../model.keras"] = traversal.pop("model.keras")
        with self.assertRaisesRegex(ModelRegistryError, "Unsafe archive member"):
            self.registry.stage_candidate(self.candidate_zip(traversal))
        large = Path(self.temp.name) / "oversized.zip"
        large.write_bytes(b"x" * 32)
        from unittest.mock import patch
        with patch("model_registry.MAX_PACKAGE_BYTES", 16):
            with self.assertRaisesRegex(ModelRegistryError, "exceeds the size limit"):
                self.registry.stage_candidate(large)

    def test_activation_failure_does_not_switch_active_model(self):
        result = self.stage_with_test_worker(self.candidate_zip())
        with self.assertRaisesRegex(RuntimeError, "load failed"):
            self.registry.activate(result["version"], lambda *_: (_ for _ in ()).throw(RuntimeError("load failed")))
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)

    def test_activation_is_atomic_and_rollback_restores_prior_version(self):
        result = self.stage_with_test_worker(self.candidate_zip())
        prepared = []
        self.registry.activate(result["version"], lambda directory, record: prepared.append((directory, record)))
        self.assertEqual(self.registry.state()["active_version"], result["version"])
        self.assertEqual(len(prepared), 1)
        artifacts = self.registry.active_artifacts()
        self.assertEqual(artifacts["input_scaler"].name, "input_scaler.json")
        self.assertEqual(artifacts["target_scaler"].name, "target_scaler.json")
        self.assertEqual(self.registry.rollback(lambda *_: object())["active_version"], LEGACY_VERSION)
        self.assertEqual(self.registry.state()["active_version"], LEGACY_VERSION)

    def test_rollback_requires_prior_activation(self):
        with self.assertRaisesRegex(ModelRegistryError, "No prior activation"):
            self.registry.rollback(lambda *_: object())

    def test_normalized_scaler_json_uses_standard_and_minmax_formulas(self):
        root = Path(self.temp.name)
        input_path = root / "input_scaler.json"
        target_path = root / "target_scaler.json"
        input_path.write_text(json.dumps({"mean": [0.0] * 19, "scale": [1.0] * 19}), encoding="utf-8")
        target_path.write_text(json.dumps({"scale": [2.0], "min": [0.1]}), encoding="utf-8")
        frame = __import__("pandas").DataFrame({
            "timestamp": ["2026-01-01T00:00:00Z"],
            "appliance_id": ["fixture"],
            "voltage": [230.0], "current": [1.0], "power": [230.0],
            "energy": [1.0], "interval_energy_kwh": [0.25],
            "frequency": [50.0], "power_factor": [1.0],
        })
        features, target, _ = preprocess_data(
            frame, is_training=False, scaler_path=str(input_path), target_scaler_path=str(target_path)
        )
        self.assertEqual(features.shape, (1, 19))
        self.assertAlmostEqual(float(target[0]), 0.6)


if __name__ == "__main__":
    unittest.main()
