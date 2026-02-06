import os
from pathlib import Path

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_DIR = Path(
    os.getenv("MODEL_DIR")
    or os.getenv("PIPELINE_MODEL_DIR")
    or DEFAULT_MODEL_DIR
)

MODEL_DIR.mkdir(parents=True, exist_ok=True)

__all__ = ["MODEL_DIR", "DEFAULT_MODEL_DIR"]
