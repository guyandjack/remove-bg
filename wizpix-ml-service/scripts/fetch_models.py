import os
from pathlib import Path
from typing import Iterable, Tuple

import requests

ISNET_FILENAME = "isnet-general-use.onnx"
MODNET_FILENAME = "modnet_webcam_portrait_matting.onnx"
ISNET_URL = os.getenv(
    "ISNET_MODEL_URL",
    "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
)
MODNET_URL = os.getenv(
    "MODNET_MODEL_URL",
    "https://huggingface.co/onnx-community/modnet-webnn/resolve/main/onnx/model.onnx",
)
ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = Path(
    os.getenv("MODEL_DIR")
    or os.getenv("PIPELINE_MODEL_DIR")
    or ROOT_DIR / "models"
)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
REQUIRED_MODELS: Iterable[Tuple[str, str]] = (
    (ISNET_FILENAME, ISNET_URL),
    (MODNET_FILENAME, MODNET_URL),
)


def download_model(filename: str, url: str) -> None:
    destination = MODEL_DIR / filename
    if destination.exists():
        print(f"[skip] {filename} deja present dans {destination}")
        return

    print(f"[download] {filename} -> {destination}")
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()

    with destination.open("wb") as fh:
        for chunk in response.iter_content(chunk_size=1024 * 256):
            if chunk:
                fh.write(chunk)
    size_mb = destination.stat().st_size / (1024 * 1024)
    print(f"[ok] {filename} sauvegarde ({size_mb:.1f} MB)")


def main() -> None:
    print(f"Model directory: {MODEL_DIR}")
    for filename, url in REQUIRED_MODELS:
        try:
            download_model(filename, url)
        except Exception as exc:  # noqa: BLE001
            print(f"[error] Impossible de telecharger {filename}: {exc}")
            raise
    print("Tous les modeles sont disponibles.")


if __name__ == "__main__":
    main()
