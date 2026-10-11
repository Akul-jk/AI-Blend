"""Versioned artifact registry for the ML inference service.

Package validation is deliberately fail-closed. In particular, scaler pickle
files are never deserialized by the archive validator. A deployment must supply
an isolated staging-inference callback before a candidate can be marked validated.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import threading
from datetime import datetime, timezone
import zipfile
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
from typing import Callable, Mapping

from config import FEATURE_COLUMNS, MODEL_STORE_DIR, MODELS_DIR, SAMPLING_INTERVAL_MS, SEQUENCE_LENGTH
from staging_runner import IsolatedStagingRunner

MAX_PACKAGE_BYTES = 128 * 1024 * 1024
MAX_EXPANDED_BYTES = 256 * 1024 * 1024
MAX_ARCHIVE_MEMBERS = 16
MAX_COMPRESSION_RATIO = 200
REGISTRY_SCHEMA_VERSION = 1
CONTRACT_ID = "smart-energy-19f-v1"
PREPROCESSING_CONTRACT = {
    "timestamps": "UTC; hour/day/month from timestamp",
    "time_features": "hour sin/cos period 23; weekday sin/cos period 6; month sin/cos period 12; weekend day>=5",
    "missing_values": "forward-fill per appliance, then zero",
    "interval_energy": "canonical interval_energy_kwh; cumulative energy is a separate input feature",
    "lags": "energy_interval and power at offsets 1, 2, 3 within one appliance",
    "sequence_boundary": "one appliance; no windows across sampling gaps",
}
LEGACY_VERSION = "legacy-energy-lstm-sim-v1"

PACKAGE_FILES = {
    "model.keras",
    "input_scaler.pkl",
    "target_scaler.pkl",
    "feature_columns.json",
    "metadata.json",
    "bias_corrections.json",
    "selected_methods.json",
    "README.md",
}


class ModelRegistryError(ValueError):
    """Invalid registry state or model package."""


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _atomic_json(path: Path, data: Mapping) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(data, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


class ModelRegistry:
    """Persistent registry whose active pointer is switched with atomic replace."""

    def __init__(self, store_dir: str | Path, legacy_dir: str | Path = MODELS_DIR):
        self.store_dir = Path(store_dir).resolve()
        self.versions_dir = self.store_dir / "versions"
        self.staging_dir = self.store_dir / ".staging"
        self.registry_path = self.store_dir / "registry.json"
        self.legacy_dir = Path(legacy_dir).resolve()
        self._lock = threading.RLock()
        self._process_lock_state = threading.local()

    @contextmanager
    def _process_lock(self):
        """Serialize registry mutations across worker processes on local disks."""
        depth = getattr(self._process_lock_state, "depth", 0)
        if depth:
            self._process_lock_state.depth = depth + 1
            try:
                yield
            finally:
                self._process_lock_state.depth -= 1
            return
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._assert_local_storage()
        lock_path = self.store_dir / ".registry.lock"
        with open(lock_path, "a+b") as lock_file:
            self._process_lock_state.depth = 1
            try:
                if os.name == "nt":
                    import msvcrt
                    lock_file.seek(0, os.SEEK_END)
                    if lock_file.tell() == 0:
                        lock_file.write(b"0")
                        lock_file.flush()
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
                else:
                    import fcntl
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                yield
            finally:
                try:
                    if os.name == "nt":
                        import msvcrt
                        lock_file.seek(0)
                        msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
                finally:
                    self._process_lock_state.depth = 0

    def _assert_local_storage(self) -> None:
        """Reject filesystems where lock/rename guarantees are not established."""
        if os.name == "nt":
            import ctypes
            drive = str(self.store_dir.drive) + "\\"
            # DRIVE_FIXED only. Network, removable and unknown drives cannot be
            # assumed to honor the registry lock and atomic replacement rules.
            if ctypes.windll.kernel32.GetDriveTypeW(drive) != 3:
                raise ModelRegistryError("Model registry requires a local fixed filesystem; activation is disabled here")
            return
        if os.name == "posix" and Path("/proc/mounts").is_file():
            resolved = str(self.store_dir)
            best = None
            for line in Path("/proc/mounts").read_text(encoding="utf-8").splitlines():
                fields = line.split()
                if len(fields) < 3:
                    continue
                mount = fields[1].replace("\\040", " ")
                if (resolved == mount or resolved.startswith(mount.rstrip("/") + "/")) and (best is None or len(mount) > len(best[0])):
                    best = (mount, fields[2])
            local_types = {"ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "apfs", "overlay", "tmpfs"}
            if best is None or best[1] not in local_types:
                raise ModelRegistryError("Model registry filesystem is not an approved local type; activation is disabled here")

    def initialize(self) -> dict:
        with self._lock, self._process_lock():
            if self.registry_path.exists():
                return self._read()
            if not (self.legacy_dir / "lstm_model.keras").is_file():
                raise ModelRegistryError(f"Legacy active model is missing: {self.legacy_dir}")
            legacy_files = {
                "model": "lstm_model.keras",
                "input_scaler": "scaler.save",
                "target_scaler": "target_scaler.save",
                "metadata": "metadata.json",
                "metrics": "metrics.json",
            }
            files = {}
            for key, name in legacy_files.items():
                file_path = self.legacy_dir / name
                if file_path.is_file():
                    files[key] = {"name": name, "sha256": _sha256(file_path.read_bytes())}
            data = {
                "schema_version": REGISTRY_SCHEMA_VERSION,
                "active_version": LEGACY_VERSION,
                "activation_history": [],
                "rejected_candidates": [],
                "versions": {
                    LEGACY_VERSION: {
                        "model_id": "energy_lstm_sim_v1",
                        "model_version": "energy_lstm_sim_v1",
                        "status": "active",
                        "source": "legacy",
                        "path": str(self.legacy_dir),
                        "files": files,
                    }
                },
            }
            _atomic_json(self.registry_path, data)
            return data

    def _read(self) -> dict:
        try:
            data = json.loads(self.registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ModelRegistryError(f"Cannot read model registry: {exc}") from exc
        if data.get("schema_version") != REGISTRY_SCHEMA_VERSION:
            raise ModelRegistryError("Unsupported model registry schema version")
        active = data.get("active_version")
        versions = data.get("versions")
        if not isinstance(versions, dict) or active not in versions:
            raise ModelRegistryError("Registry active version does not identify a registered model")
        if versions[active].get("status") != "active":
            raise ModelRegistryError("Registry active version is not marked active")
        data.setdefault("activation_history", [])
        data.setdefault("rejected_candidates", [])
        return data

    def state(self) -> dict:
        with self._lock, self._process_lock():
            if not self.registry_path.exists():
                return self.initialize()
            return self._read()

    def active_artifacts(self) -> dict:
        """Return a consistent path snapshot for a single inference request."""
        state = self.state()
        version = state["active_version"]
        record = state["versions"][version]
        directory = Path(record["path"]).resolve()
        files = record["files"]
        result = {"version": version, "record": record, "directory": directory}
        for key in ("model", "input_scaler", "target_scaler", "metadata"):
            if key not in files:
                raise ModelRegistryError(f"Active model is missing the {key} artifact record")
            artifact = (directory / files[key]["name"]).resolve()
            if directory not in artifact.parents or not artifact.is_file():
                raise ModelRegistryError(f"Active model artifact is missing or outside its version directory: {key}")
            expected = files[key].get("sha256")
            # The legacy trainer still writes its original directory in place.
            # Managed package versions are immutable and must always match hashes.
            expected = expected if record.get("source") != "legacy" else None
            if expected and _sha256(artifact.read_bytes()) != expected:
                raise ModelRegistryError(f"Active model artifact checksum mismatch: {key}")
            result[key] = artifact
        return result

    @staticmethod
    def _read_source(source: str | Path) -> dict[str, bytes]:
        source = Path(source)
        if not source.exists():
            raise ModelRegistryError("Candidate package does not exist")
        if source.is_dir():
            members = {}
            entries = list(source.iterdir())
            if len(entries) > MAX_ARCHIVE_MEMBERS:
                raise ModelRegistryError("Candidate package has too many files")
            total = 0
            for item in entries:
                if item.is_symlink() or not item.is_file() or item.name not in PACKAGE_FILES:
                    raise ModelRegistryError(f"Unexpected or unsafe package member: {item.name}")
                size = item.stat().st_size
                if size > MAX_PACKAGE_BYTES:
                    raise ModelRegistryError("Candidate package exceeds the size limit")
                total += size
                if total > MAX_EXPANDED_BYTES:
                    raise ModelRegistryError("Expanded candidate package exceeds the size limit")
                members[item.name] = item.read_bytes()
        else:
            if source.stat().st_size > MAX_PACKAGE_BYTES:
                raise ModelRegistryError("Candidate archive exceeds the size limit")
            try:
                with zipfile.ZipFile(source) as archive:
                    infos = archive.infolist()
                    if not 1 <= len(infos) <= MAX_ARCHIVE_MEMBERS:
                        raise ModelRegistryError("Candidate archive has an invalid member count")
                    members = {}
                    expanded = 0
                    for info in infos:
                        raw_name = info.filename
                        path = PurePosixPath(raw_name)
                        if (not raw_name or "\\" in raw_name or path.is_absolute()
                                or len(path.parts) != 1 or path.parts[0] in {"", ".", ".."}
                                or info.is_dir() or (info.external_attr >> 16) & 0o170000 == 0o120000):
                            raise ModelRegistryError(f"Unsafe archive member: {raw_name}")
                        name = path.name
                        if name not in PACKAGE_FILES or name in members:
                            raise ModelRegistryError(f"Unexpected or duplicate package member: {name}")
                        expanded += info.file_size
                        if expanded > MAX_EXPANDED_BYTES:
                            raise ModelRegistryError("Expanded candidate package exceeds the size limit")
                        if info.file_size and info.compress_size == 0:
                            raise ModelRegistryError("Invalid archive compression metadata")
                        if info.compress_size and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                            raise ModelRegistryError("Candidate archive compression ratio exceeds the limit")
                        members[name] = archive.read(info)
            except zipfile.BadZipFile as exc:
                raise ModelRegistryError("Candidate is not a valid ZIP archive") from exc
        if set(members) != PACKAGE_FILES:
            missing = sorted(PACKAGE_FILES - set(members))
            raise ModelRegistryError(f"Candidate package is missing required files: {', '.join(missing)}")
        return members

    @staticmethod
    def _validate_package(members: dict[str, bytes]) -> dict:
        try:
            metadata = json.loads(members["metadata.json"])
            features = json.loads(members["feature_columns.json"])
            json.loads(members["bias_corrections.json"])
            json.loads(members["selected_methods.json"])
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ModelRegistryError(f"Package contains malformed JSON: {exc}") from exc
        if not isinstance(metadata, dict) or not isinstance(features, list):
            raise ModelRegistryError("Metadata must be an object and feature_columns.json must be an array")
        if features != FEATURE_COLUMNS:
            raise ModelRegistryError("Candidate feature order does not match the inference contract")
        if metadata.get("sequence_length") != SEQUENCE_LENGTH or metadata.get("feature_count") != len(FEATURE_COLUMNS):
            raise ModelRegistryError("Candidate sequence length or feature count is incompatible")
        if metadata.get("feature_columns") != FEATURE_COLUMNS:
            raise ModelRegistryError("Metadata feature order does not match feature_columns.json")
        if metadata.get("target_column") != "interval_energy_kwh" or metadata.get("target_unit") != "kWh":
            raise ModelRegistryError("Candidate target must be next-interval energy in kWh")
        if metadata.get("contract_id") != CONTRACT_ID:
            raise ModelRegistryError(f"Candidate must declare preprocessing contract {CONTRACT_ID}")
        if metadata.get("preprocessing") != PREPROCESSING_CONTRACT:
            raise ModelRegistryError("Candidate preprocessing declaration does not match the inference contract")
        if metadata.get("sampling_interval_ms") != SAMPLING_INTERVAL_MS:
            raise ModelRegistryError(
                f"Candidate sampling_interval_ms must match service configuration ({SAMPLING_INTERVAL_MS})"
            )
        scaler_spec = metadata.get("scalers")
        if scaler_spec != {
            "input": {"class": "StandardScaler", "features": len(FEATURE_COLUMNS)},
            "target": {"class": "MinMaxScaler", "features": 1},
        }:
            raise ModelRegistryError("Candidate scaler metadata does not match the required scaler contract")
        model_bytes = members["model.keras"]
        try:
            import io
            with zipfile.ZipFile(io.BytesIO(model_bytes)) as model_zip:
                config = json.loads(model_zip.read("config.json"))
        except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
            raise ModelRegistryError("Candidate Keras archive is malformed") from exc
        layers = config.get("config", {}).get("layers", [])
        input_shapes = [layer.get("config", {}).get("batch_shape") for layer in layers
                        if layer.get("class_name") == "InputLayer"]
        if [None, SEQUENCE_LENGTH, len(FEATURE_COLUMNS)] not in input_shapes:
            raise ModelRegistryError("Candidate Keras input shape must be (None, 60, 19)")
        output_units = [layer.get("config", {}).get("units") for layer in layers
                        if layer.get("class_name") == "Dense"]
        if not output_units or output_units[-1] != 1:
            raise ModelRegistryError("Candidate Keras model must have one scalar output")
        if metadata.get("model_format") != ".keras" or not metadata.get("model_id") or not metadata.get("model_version"):
            raise ModelRegistryError("Candidate model identity or format is missing")
        if metadata.get("framework") != "TensorFlow/Keras":
            raise ModelRegistryError("Candidate framework must be declared as TensorFlow/Keras")
        for field, limit in (("model_type", 80), ("training_data", 256), ("tensorflow_version", 32)):
            value = metadata.get(field)
            if not isinstance(value, str) or not value or len(value) > limit:
                raise ModelRegistryError(f"Candidate {field} must be a non-empty string of at most {limit} characters")
        if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", metadata["tensorflow_version"]):
            raise ModelRegistryError("Candidate tensorflow_version must be a numeric version")
        created = metadata.get("created_at_utc")
        if not isinstance(created, str) or len(created) > 64:
            raise ModelRegistryError("Candidate created_at_utc is missing or malformed")
        try:
            datetime.fromisoformat(created.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ModelRegistryError("Candidate created_at_utc is not a valid ISO timestamp") from exc
        for key in ("model_id", "model_version"):
            value = metadata[key]
            if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", value):
                raise ModelRegistryError(f"Candidate {key} must be a short, path-safe identifier")
        expected_refs = {
            "feature_columns_file": "feature_columns.json",
            "input_scaler_file": "input_scaler.pkl",
            "target_scaler_file": "target_scaler.pkl",
        }
        if any(metadata.get(key) != expected for key, expected in expected_refs.items()):
            raise ModelRegistryError("Candidate metadata artifact references do not match package contents")
        return metadata

    @staticmethod
    def _validate_runner_result(staged_result: object) -> dict:
        if not isinstance(staged_result, dict):
            raise ModelRegistryError("Staging runner returned no validation result")
        input_scaler = staged_result.get("input_scaler")
        target_scaler = staged_result.get("target_scaler")
        probe = staged_result.get("probe")
        if not isinstance(input_scaler, dict) or not isinstance(target_scaler, dict) or not isinstance(probe, dict):
            raise ModelRegistryError("Staging runner returned an incomplete validation result")
        if (len(input_scaler.get("mean", [])) != len(FEATURE_COLUMNS)
                or len(input_scaler.get("scale", [])) != len(FEATURE_COLUMNS)
                or len(target_scaler.get("scale", [])) != 1
                or len(target_scaler.get("min", [])) != 1
                or probe.get("input_shape") != [1, SEQUENCE_LENGTH, len(FEATURE_COLUMNS)]
                or probe.get("output_shape") != [1, 1]
                or probe.get("finite") is not True):
            raise ModelRegistryError("Staging runner reported incompatible scaler or inference dimensions")
        numeric_values = (input_scaler["mean"] + input_scaler["scale"]
                          + target_scaler["scale"] + target_scaler["min"]
                          + [probe.get("prediction")])
        if any(not isinstance(value, (int, float)) or not __import__("math").isfinite(value)
               for value in numeric_values):
            raise ModelRegistryError("Staging runner returned non-finite scaler or prediction values")
        if any(value <= 0 for value in input_scaler["scale"] + target_scaler["scale"]):
            raise ModelRegistryError("Scaler scale values must be positive")
        return staged_result

    @staticmethod
    def _write_members(staging: Path, members: dict[str, bytes]) -> dict[str, str]:
        hashes = {}
        for name, data in members.items():
            target = staging / name
            target.write_bytes(data)
            hashes[name] = _sha256(data)
        return hashes

    @staticmethod
    def _public_validation_report(metadata: dict, runner_result: dict) -> dict:
        return {
            "status": "validated",
            "checks": {
                "archive_contents": "passed",
                "package_contract": "passed",
                "scaler_artifacts": "passed",
                "model_load": "passed",
                "probe_inference": "passed",
            },
            "contract": {
                "sequence_length": SEQUENCE_LENGTH,
                "feature_count": len(FEATURE_COLUMNS),
                "feature_columns": FEATURE_COLUMNS,
                "sampling_interval_ms": metadata["sampling_interval_ms"],
                "target_column": metadata["target_column"],
                "target_unit": metadata["target_unit"],
            },
            "scalers": {"input": "StandardScaler (19 features)", "target": "MinMaxScaler (1 feature)"},
            "probe": {key: runner_result["probe"][key] for key in ("input_shape", "output_shape", "prediction", "finite")},
            "runtime": runner_result.get("runtime", {}),
        }

    def validate_candidate(self, source: str | Path) -> dict:
        """Run full static and isolated checks without publishing a model version."""
        with self._lock, self._process_lock():
            self.state()
            members = self._read_source(source)
            metadata = self._validate_package(members)
            self.staging_dir.mkdir(parents=True, exist_ok=True)
            staging = Path(tempfile.mkdtemp(prefix="validate-", dir=self.staging_dir))
            try:
                self._write_members(staging, members)
                result = self._validate_runner_result(IsolatedStagingRunner()(staging, metadata))
                return self._public_validation_report(metadata, result)
            finally:
                shutil.rmtree(staging, ignore_errors=True)

    def active_version(self) -> str:
        return self.state()["active_version"]

    def version_history(self) -> dict:
        state = self.state()
        rollback_target = next((item.get("from") for item in reversed(state["activation_history"])
                                if item.get("from") in state["versions"]
                                and state["versions"][item["from"]].get("status") in {"validated", "active"}), None)
        return {
            "active_version": state["active_version"],
            "rollback_version": rollback_target,
            "activation_history": state["activation_history"],
            "rejected_candidates": state["rejected_candidates"],
        }

    def record_rejection(self, package_sha256: str, reason: str) -> dict:
        """Persist a sanitized rejected-candidate report without touching active state."""
        with self._lock, self._process_lock():
            state = self.state()
            record = {
                "id": f"rejected-{package_sha256[:16]}",
                "package_sha256": package_sha256,
                "status": "rejected",
                "reason": str(reason)[:1000],
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
            }
            state["rejected_candidates"].insert(0, record)
            state["rejected_candidates"] = state["rejected_candidates"][:100]
            _atomic_json(self.registry_path, state)
            return record

    def list_models(self) -> list[dict]:
        state = self.state()
        active = state["active_version"]
        result = []
        for version, record in state["versions"].items():
            activated_before = any(entry.get("to") == version for entry in state["activation_history"])
            metadata = {}
            try:
                if "metadata" in record.get("files", {}):
                    p = Path(record["path"]).resolve() / record["files"]["metadata"]["name"]
                    metadata = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError, KeyError):
                metadata = {}
            metrics = record.get("evaluation_metrics")
            if metrics is None and record.get("source") == "legacy" and "metrics" in record.get("files", {}):
                try:
                    metrics_path = Path(record["path"]).resolve() / record["files"]["metrics"]["name"]
                    metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.is_file() else None
                except (OSError, json.JSONDecodeError, KeyError):
                    metrics = None
            result.append({
                "version": version,
                "model_id": record.get("model_id"),
                "model_version": record.get("model_version"),
                "status": "active" if version == active else (
                    "staged" if record.get("status") == "validated" and not activated_before else
                    "inactive" if record.get("status") == "validated" else record.get("status", "inactive")
                ),
                "source": record.get("source"),
                "model_type": metadata.get("model_type"),
                "framework": metadata.get("framework"),
                "framework_version": metadata.get("tensorflow_version"),
                "dataset_provenance": metadata.get("training_data") if isinstance(metadata.get("training_data"), str) else metadata.get("source"),
                "created_at_utc": metadata.get("created_at_utc"),
                "validation_report": record.get("validation_report"),
                "metrics": metrics,
            })
        result.extend(state["rejected_candidates"])
        return sorted(result, key=lambda item: item.get("created_at_utc") or "", reverse=True)

    def get_model(self, version: str) -> dict:
        state = self.state()
        record = state["versions"].get(version)
        if not record:
            rejected = next((r for r in state["rejected_candidates"] if r.get("id") == version), None)
            if rejected:
                return rejected
            raise ModelRegistryError("Model version was not found")
        details = next(item for item in self.list_models() if item.get("version") == version)
        metadata_path = Path(record["path"]).resolve() / record["files"]["metadata"]["name"]
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, KeyError):
            metadata = {}
        details.update({
            "active": state["active_version"] == version,
            "sequence_length": metadata.get("sequence_length", SEQUENCE_LENGTH),
            "feature_count": metadata.get("feature_count", len(FEATURE_COLUMNS)),
            "feature_columns": metadata.get("feature_columns", metadata.get("feature_order", FEATURE_COLUMNS)),
            "sampling_interval_ms": metadata.get("sampling_interval_ms", SAMPLING_INTERVAL_MS if record.get("source") == "legacy" else None),
            "target_column": metadata.get("target_column", metadata.get("target", "interval_energy_kwh")),
            "target_unit": metadata.get("target_unit", "kWh"),
            "tensorflow_version": metadata.get("tensorflow_version"),
            "validation_report": record.get("validation_report"),
            "activation_history": [h for h in state["activation_history"] if version in (h.get("from"), h.get("to"))],
        })
        return details

    def delete_model(self, version: str) -> dict:
        with self._lock, self._process_lock():
            state = self.state()
            record = state["versions"].get(version)
            if not record:
                raise ModelRegistryError("Model version was not found")
            if version == state["active_version"] or record.get("status") == "active":
                raise ModelRegistryError("The active model cannot be deleted")
            if record.get("source") != "package" or record.get("status") not in {"validated", "inactive"}:
                raise ModelRegistryError("Only inactive managed model versions can be deleted")
            directory = Path(record["path"]).resolve()
            if directory.parent != self.versions_dir.resolve():
                raise ModelRegistryError("Managed model directory is outside versioned storage")
            del state["versions"][version]
            _atomic_json(self.registry_path, state)
            shutil.rmtree(directory, ignore_errors=True)
            return {"deleted_version": version}

    def stage_candidate(
        self,
        source: str | Path,
    ) -> dict:
        """Copy, validate and test a candidate without changing the active pointer.

        The concrete isolated runner is constructed here. Pickles are copied
        and checksummed but never deserialized by the registry process.
        """
        with self._lock, self._process_lock():
            self.state()
            members = self._read_source(source)
            metadata = self._validate_package(members)
            # Do not accept arbitrary callbacks here: the runner type owns the
            # subprocess boundary and refuses unsupported operating systems.
            staging_inference = IsolatedStagingRunner()
            digest = _sha256(b"".join(name.encode() + b"\0" + members[name] for name in sorted(members)))
            safe_model_id = re.sub(r"[^A-Za-z0-9._-]", "_", metadata["model_id"])
            safe_version = re.sub(r"[^A-Za-z0-9._-]", "_", metadata["model_version"])
            version = f"{safe_model_id}-{safe_version}-{digest[:12]}"
            if version == LEGACY_VERSION:
                raise ModelRegistryError("Candidate version conflicts with the legacy model")
            state = self._read()
            existing = state["versions"].get(version)
            if existing and existing.get("package_sha256") == digest:
                return {"version": version, "status": existing["status"], "package_sha256": digest, "existing": True}
            self.store_dir.mkdir(parents=True, exist_ok=True)
            self.versions_dir.mkdir(parents=True, exist_ok=True)
            self.staging_dir.mkdir(parents=True, exist_ok=True)
            staging = Path(tempfile.mkdtemp(prefix="candidate-", dir=self.staging_dir))
            destination = self.versions_dir / version
            published = False
            try:
                file_hashes = self._write_members(staging, members)
                staged_result = staging_inference(staging, metadata)
                staged_result = self._validate_runner_result(staged_result)
                input_scaler = staged_result.get("input_scaler")
                target_scaler = staged_result.get("target_scaler")
                probe = staged_result.get("probe")
                (staging / "input_scaler.json").write_text(json.dumps(input_scaler), encoding="utf-8")
                (staging / "target_scaler.json").write_text(json.dumps(target_scaler), encoding="utf-8")
                file_hashes["input_scaler.json"] = _sha256((staging / "input_scaler.json").read_bytes())
                file_hashes["target_scaler.json"] = _sha256((staging / "target_scaler.json").read_bytes())
                if destination.exists():
                    raise ModelRegistryError("Version destination already exists")
                os.replace(staging, destination)
                published = True
                files = {
                    "model": {"name": "model.keras", "sha256": file_hashes["model.keras"]},
                    "input_scaler": {"name": "input_scaler.json", "sha256": file_hashes["input_scaler.json"]},
                    "target_scaler": {"name": "target_scaler.json", "sha256": file_hashes["target_scaler.json"]},
                    "metadata": {"name": "metadata.json", "sha256": file_hashes["metadata.json"]},
                }
                state["versions"][version] = {
                    "model_id": metadata["model_id"],
                    "model_version": metadata["model_version"],
                    "status": "validated",
                    "source": "package",
                    "path": str(destination.resolve()),
                    "package_sha256": digest,
                    "validation_report": self._public_validation_report(metadata, staged_result),
                    "evaluation_metrics": None,
                    "files": files,
                }
                _atomic_json(self.registry_path, state)
                return {"version": version, "status": "validated", "package_sha256": digest, "existing": False}
            except Exception:
                if published:
                    shutil.rmtree(destination, ignore_errors=True)
                raise
            finally:
                if staging.exists():
                    shutil.rmtree(staging, ignore_errors=True)

    def activate(self, version: str, prepare_inference: Callable[[Path, dict], object]) -> dict:
        """Prepare a complete inference bundle, then atomically switch the registry."""
        with self._lock, self._process_lock():
            state = self.state()
            record = state["versions"].get(version)
            if not record or record.get("status") not in {"validated", "active"}:
                raise ModelRegistryError("Only a validated model version can be activated")
            directory = Path(record["path"]).resolve()
            if record.get("source") == "package" and directory.parent != self.versions_dir.resolve():
                raise ModelRegistryError("Managed model directory is outside versioned storage")
            for key in ("model", "input_scaler", "target_scaler", "metadata"):
                descriptor = record.get("files", {}).get(key)
                if not descriptor or Path(descriptor.get("name", "")).name != descriptor.get("name"):
                    raise ModelRegistryError(f"Validated model record is missing a safe {key} artifact")
                artifact = directory / descriptor["name"]
                expected_hash = descriptor.get("sha256")
                if record.get("source") == "legacy":
                    expected_hash = None
                if not artifact.is_file() or (expected_hash and _sha256(artifact.read_bytes()) != expected_hash):
                    raise ModelRegistryError(f"Validated model artifact is missing or has changed: {key}")
            # Loading must finish before the active pointer changes.
            prepare_inference(directory, record)
            previous = state["active_version"]
            if previous != version:
                state["versions"][previous]["status"] = "validated"
                record["status"] = "active"
                record["activated_from"] = previous
                state["activation_history"].append({
                    "from": previous, "to": version,
                    "created_at_utc": datetime.now(timezone.utc).isoformat(),
                })
                state["active_version"] = version
                _atomic_json(self.registry_path, state)
            return {"active_version": version, "previous_version": previous}

    def rollback(self, prepare_inference: Callable[[Path, dict], object], version: str | None = None) -> dict:
        state = self.state()
        if version is None:
            version = next((item.get("from") for item in reversed(state["activation_history"])
                            if item.get("from") in state["versions"]
                            and state["versions"][item["from"]].get("status") in {"validated", "active"}), None)
            if version is None:
                raise ModelRegistryError("No prior activation is available for rollback")
        return self.activate(version, prepare_inference)


_DEFAULT_REGISTRY: ModelRegistry | None = None
_DEFAULT_REGISTRY_LOCK = threading.Lock()


def default_registry() -> ModelRegistry:
    global _DEFAULT_REGISTRY
    store = os.environ.get("MODEL_STORE_DIR") or MODEL_STORE_DIR
    resolved = Path(store).resolve()
    with _DEFAULT_REGISTRY_LOCK:
        if _DEFAULT_REGISTRY is None or _DEFAULT_REGISTRY.store_dir != resolved:
            _DEFAULT_REGISTRY = ModelRegistry(resolved)
        return _DEFAULT_REGISTRY
