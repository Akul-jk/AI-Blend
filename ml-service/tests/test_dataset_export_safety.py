import hashlib
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from simulation import generate_dataset


class DatasetExportSafetyTests(unittest.TestCase):
    def test_exports_are_unique_and_leave_canonical_dataset_unchanged(self):
        repository = Path(__file__).resolve().parents[2]
        canonical = repository / "ml-service" / "datasets" / "simulation" / "canonical_simulation_telemetry.csv"
        before = hashlib.sha256(canonical.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = root / "telemetry.sqlite"
            connection = sqlite3.connect(database)
            connection.execute("""CREATE TABLE telemetry (
                timestamp TEXT, pzem_id TEXT, appliance_id INTEGER, voltage REAL,
                current REAL, power REAL, energy REAL, interval_energy_kwh REAL,
                frequency REAL, power_factor REAL, source TEXT, quality TEXT, id INTEGER
            )""")
            connection.execute("""INSERT INTO telemetry VALUES
                ('2026-10-15T00:00:00Z', 'PZEM-001', 1, 230, 1, 207, 1, 0.001,
                 50, 0.9, 'simulation', 'valid', 1)""")
            connection.commit()
            connection.close()
            with patch.dict(os.environ, {"DB_FILE": str(database)}), patch("simulation.DATASET_EXPORTS_DIR", str(root / "exports")):
                first = Path(generate_dataset())
                second = Path(generate_dataset())

            self.assertNotEqual(first, second)
            self.assertTrue(first.is_file())
            self.assertTrue(second.is_file())
            self.assertEqual(hashlib.sha256(canonical.read_bytes()).hexdigest(), before)


if __name__ == "__main__":
    unittest.main()
