import os
import tempfile
from types import SimpleNamespace
import unittest
from pathlib import Path
from unittest.mock import patch

import main
from model_registry import LEGACY_VERSION, ModelRegistry


class ModelManagementApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / ".tmp")
        root = Path(self.temp.name)
        legacy = root / "legacy"
        legacy.mkdir()
        (legacy / "lstm_model.keras").write_bytes(b"legacy model")
        (legacy / "scaler.save").write_bytes(b"legacy scaler")
        (legacy / "target_scaler.save").write_bytes(b"legacy target scaler")
        (legacy / "metadata.json").write_text("{}", encoding="utf-8")
        self.registry = ModelRegistry(root / "managed", legacy)
        self.registry.initialize()
        self.headers = {"x-ml-internal-token": "t" * 40}
        self.env_patch = patch.dict(os.environ, {"ML_INTERNAL_TOKEN": "t" * 40})
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()
        self.temp.cleanup()

    def test_management_token_required_and_constant_time_checked(self):
        with self.assertRaises(main.HTTPException) as missing:
            main.require_model_management_token(SimpleNamespace(headers={}))
        self.assertEqual(missing.exception.status_code, 401)
        with patch.dict(os.environ, {"ML_INTERNAL_TOKEN": ""}):
            with self.assertRaises(main.HTTPException) as disabled:
                main.require_model_management_token(SimpleNamespace(headers=self.headers))
        self.assertEqual(disabled.exception.status_code, 503)

    def test_upload_content_type_and_declared_size_are_enforced(self):
        with self.assertRaises(main.HTTPException) as wrong_type:
            main.validate_model_upload_headers({"content-type": "text/plain"})
        self.assertEqual(wrong_type.exception.status_code, 415)
        with self.assertRaises(main.HTTPException) as too_large:
            main.validate_model_upload_headers({
                "content-type": "application/zip", "content-length": str(128 * 1024 * 1024 + 1),
            })
        self.assertEqual(too_large.exception.status_code, 413)

    def test_invalid_archive_is_rejected_without_changing_active(self):
        archive = Path(self.temp.name) / "invalid.zip"
        archive.write_bytes(b"not a zip")
        with self.assertRaisesRegex(ValueError, "valid ZIP"):
            self.registry.validate_candidate(archive)
        self.assertEqual(self.registry.active_version(), LEGACY_VERSION)


if __name__ == "__main__":
    unittest.main()
