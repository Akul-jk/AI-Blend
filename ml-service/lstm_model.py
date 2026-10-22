"""App-contract candidate training entry point used by the ML API."""

import json
from pathlib import Path


def train_model():
    """Export fresh canonical simulated telemetry and train an isolated candidate."""
    from simulation import generate_dataset
    from train_app_compatible_candidate import train

    csv_path = Path(generate_dataset())
    candidate_dir = train(csv_path)
    metadata = json.loads((candidate_dir / "metadata.json").read_text(encoding="utf-8"))
    print(
        f"App-contract candidate saved to {candidate_dir}; active model unchanged; "
        f"deployment_eligible={metadata['deployment_eligible']}"
    )
    return metadata


if __name__ == "__main__":
    train_model()
