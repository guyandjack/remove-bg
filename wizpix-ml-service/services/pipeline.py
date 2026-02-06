import logging
import os
import threading
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Dict, Optional, Tuple

import cv2
import numpy as np
import onnxruntime as ort
import requests
from PIL import Image
from rembg import new_session, remove as rembg_remove

from .settings import MODEL_DIR

LOGGER = logging.getLogger(__name__)

SUPPORTED_QUALITY = {"fast", "pro"}


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_name(name: str) -> str:
    return name.replace("_", "-").replace(" ", "-").lower()


PRO_MODEL_SPECS: Dict[str, Dict[str, object]] = {
    "inspyrenet": {
        "filename": os.getenv("INSPYRENET_MODEL_FILE", "isnet-general-use.onnx"),
        "url": "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
        "mean": (0.5, 0.5, 0.5),
        "std": (1.0, 1.0, 1.0),
        "size": (1024, 1024),
        "activation": "linear",
        "friendly_name": "InSPyReNet (isnet-general-use)",
    },
    "isnet-general-use": {"alias": "inspyrenet"},
    "inspyre-net": {"alias": "inspyrenet"},
    "birefnet-portrait": {
        "filename": os.getenv(
            "BIREFNET_MODEL_FILE", "BiRefNet-portrait-epoch_150.onnx"
        ),
        "url": "https://github.com/ZhengPeng7/BiRefNet/releases/download/v1.0/BiRefNet-portrait-epoch_150.onnx",
        "mean": (0.485, 0.456, 0.406),
        "std": (0.229, 0.224, 0.225),
        "size": (1024, 1024),
        "activation": "sigmoid",
        "friendly_name": "BiRefNet Portrait",
    },
    "birefnet_portrait": {"alias": "birefnet-portrait"},
    "birefnet": {"alias": "birefnet-portrait"},
    "mock": {
        "mock": True,
        "friendly_name": "Mock model (tests only)",
    },
}


def _select_providers(device_request: str) -> Tuple[str, ...]:
    available = ort.get_available_providers()
    device_request = device_request.lower()

    if device_request == "cpu":
        return ("CPUExecutionProvider",)

    if device_request == "cuda":
        if "CUDAExecutionProvider" in available:
            return ("CUDAExecutionProvider", "CPUExecutionProvider")
        LOGGER.warning("CUDA requested but not available; using CPUExecutionProvider.")
        return ("CPUExecutionProvider",)

    if "CUDAExecutionProvider" in available:
        return ("CUDAExecutionProvider", "CPUExecutionProvider")
    return ("CPUExecutionProvider",)


def _default_description(name: str) -> str:
    spec = PRO_MODEL_SPECS.get(name, {})
    friendly = spec.get("friendly_name")
    if isinstance(friendly, str):
        return friendly
    return name


@dataclass
class ModelStatus:
    state: str = "idle"
    ready: bool = False
    warming: bool = False
    message: Optional[str] = None
    path: Optional[str] = None
    device: Optional[str] = None


class OnnxMaskModel:
    """Loads a single ONNX model and predicts alpha masks."""

    def __init__(
        self,
        name: str,
        spec: Dict[str, object],
        device_request: str,
        allow_download: bool,
    ) -> None:
        self.name = name
        self.spec = spec
        self.device_request = device_request
        self.allow_download = allow_download
        filename_value = spec.get("filename")
        if filename_value is None:
            raise ValueError(f"No filename provided for model '{name}'")
        file_path = Path(filename_value)
        if file_path.is_absolute():
            self.model_path = file_path
        else:
            filename_str = cast_str(filename_value, "")
            if not filename_str:
                raise ValueError(f"Invalid filename for model '{name}'")
            self.model_path = MODEL_DIR / filename_str
        self.session: Optional[ort.InferenceSession] = None
        self.providers: Tuple[str, ...] = ()
        self.status = ModelStatus(
            state="idle",
            ready=False,
            warming=False,
            path=str(self.model_path),
        )

    def ensure_loaded(self) -> None:
        if self.session is not None:
            return

        if not self.model_path.exists():
            if not self.allow_download:
                raise FileNotFoundError(
                    f"Model '{self.name}' introuvable dans {self.model_path}. "
                    "Lancez scripts/fetch_models.py pour le telecharger."
                )
            self._download_model()

        self.status.state = "loading"
        self.status.warming = True
        providers = _select_providers(self.device_request)
        options = ort.SessionOptions()
        try:
            self.session = ort.InferenceSession(
                str(self.model_path),
                sess_options=options,
                providers=list(providers),
            )
        finally:
            self.status.warming = False
        self.providers = providers
        self.status.device = providers[0]
        self.status.state = "ready"
        self.status.ready = True

    def predict_mask(self, image: Image.Image) -> np.ndarray:
        if self.session is None:
            raise RuntimeError("Model not loaded")

        inputs = self._prepare_input(image)
        input_name = self.session.get_inputs()[0].name
        ort_outs = self.session.run(None, {input_name: inputs})

        values = ort_outs[0]
        if values.ndim == 4:
            values = values[:, 0, :, :]

        activation = self.spec.get("activation", "linear")
        values = values.astype(np.float32)
        if activation == "sigmoid":
            values = 1.0 / (1.0 + np.exp(-values))

        ma = float(np.max(values))
        mi = float(np.min(values))
        denom = ma - mi
        if denom > 1e-6:
            values = (values - mi) / denom
        else:
            values = np.zeros_like(values, dtype=np.float32)

        mask = np.squeeze(values).astype(np.float32)
        mask = cv2.resize(
            mask,
            (image.width, image.height),
            interpolation=cv2.INTER_CUBIC,
        )
        return np.clip(mask, 0.0, 1.0)

    def _prepare_input(self, image: Image.Image) -> np.ndarray:
        mean = self.spec.get("mean", (0.5, 0.5, 0.5))
        std = self.spec.get("std", (1.0, 1.0, 1.0))
        size = self.spec.get("size", (1024, 1024))

        pil = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
        arr = np.asarray(pil).astype(np.float32)
        arr = arr / max(float(np.max(arr)), 1e-6)

        tmp = np.zeros_like(arr, dtype=np.float32)
        for ch in range(3):
            tmp[:, :, ch] = (arr[:, :, ch] - mean[ch]) / std[ch]
        tmp = tmp.transpose(2, 0, 1)
        return np.expand_dims(tmp, 0).astype(np.float32)

    def _download_model(self) -> None:
        url = self.spec.get("url")
        if not isinstance(url, str):
            raise FileNotFoundError(
                f"Model '{self.name}' manquant et aucun URL n'est defini."
            )
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        LOGGER.info("Telechargement du modele %s depuis %s", self.name, url)
        response = requests.get(url, stream=True, timeout=180)
        response.raise_for_status()
        with self.model_path.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)
        LOGGER.info(
            "Modele %s telecharge (%.1f MB)",
            self.name,
            self.model_path.stat().st_size / (1024 * 1024),
        )


class MockMaskModel:
    """Small helper used in unit tests – always returns a centered square."""

    def __init__(self) -> None:
        self.status = ModelStatus(state="ready", ready=True, path="mock", device="cpu")

    def ensure_loaded(self) -> None:
        return

    def predict_mask(self, image: Image.Image) -> np.ndarray:
        arr = np.zeros((image.height, image.width), dtype=np.float32)
        h_slice = slice(image.height // 4, image.height - image.height // 4)
        w_slice = slice(image.width // 4, image.width - image.width // 4)
        arr[h_slice, w_slice] = 1.0
        return arr


def cast_str(value: object, default: str) -> str:
    return value if isinstance(value, str) else default


class WarmupPendingError(RuntimeError):
    """Raised when pro quality is requested but the model is still warming up."""


class ModelsUnavailableError(RuntimeError):
    """Raised when mandatory models are missing and no fallback is allowed."""


def composite_straight_alpha(rgb: np.ndarray, alpha: np.ndarray) -> bytes:
    alpha_clamped = np.clip(alpha, 0.0, 1.0)
    alpha_uint8 = (alpha_clamped * 255).astype(np.uint8)
    rgba = np.dstack((rgb.astype(np.uint8), alpha_uint8))
    buffer = BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


class BackgroundRemovalPipeline:
    """Background removal pipeline with rembg fast mode and ONNX-based pro mode."""

    def __init__(self, device: Optional[str] = None) -> None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("U2NET_HOME", str(MODEL_DIR))

        self.device_request = (device or os.getenv("PIPELINE_DEVICE") or "auto").lower()
        self.auto_fallback = _env_bool("AUTO_FALLBACK_FAST", True)
        self.allow_remote_download = _env_bool("ALLOW_REMOTE_DOWNLOAD", False)

        fast_model_name = os.getenv("FAST_MODEL_NAME", "u2net")
        self.fast_model_name = fast_model_name
        self.rembg_fast_session = new_session(fast_model_name)

        pro_name_raw = os.getenv("PRO_MODEL_NAME", "inspyrenet")
        pro_name = _normalize_name(pro_name_raw)
        resolved = self._resolve_pro_name(pro_name)
        self.pro_requested_name = pro_name_raw
        self.pro_canonical_name = resolved
        self.pro_label = _default_description(resolved)
        spec = PRO_MODEL_SPECS.get(resolved)
        if spec is None:
            raise ModelsUnavailableError(f"Modele pro inconnu: {pro_name}")

        if spec.get("mock"):
            self.pro_model = MockMaskModel()
        else:
            self.pro_model = OnnxMaskModel(
                name=resolved,
                spec=spec,
                device_request=self.device_request,
                allow_download=self.allow_remote_download,
            )
        self.pro_status = (
            self.pro_model.status
            if hasattr(self.pro_model, "status")
            else ModelStatus(state="ready", ready=True)
        )

        self._warmup_thread: Optional[threading.Thread] = None
        self._warmup_running = False

    def _resolve_pro_name(self, name: str) -> str:
        spec = PRO_MODEL_SPECS.get(name)
        if spec and "alias" in spec:
            alias = spec["alias"]
            if isinstance(alias, str):
                return alias
        if spec is None and name in {"mock"}:
            return name
        if spec is None and name not in PRO_MODEL_SPECS:
            raise ModelsUnavailableError(
                f"Modele pro '{name}' non supporte. "
                f"Options: {', '.join(sorted({k for k in PRO_MODEL_SPECS if 'alias' not in PRO_MODEL_SPECS[k]}))}"
            )
        return name

    def start_warmup(self, blocking: bool = False) -> None:
        def _run() -> None:
            LOGGER.info("Demarrage du warmup des modeles pro.")
            self._warmup_running = True
            self.pro_status.warming = True
            try:
                self._ensure_pro_ready()
            except Exception:  # noqa: BLE001
                LOGGER.exception("Warmup pro echoue")
            finally:
                self.pro_status.warming = False
                self._warmup_running = False

        if blocking:
            _run()
            return

        if self._warmup_thread and self._warmup_thread.is_alive():
            return

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        self._warmup_thread = thread

    def _ensure_pro_ready(self) -> None:
        if isinstance(self.pro_model, MockMaskModel):
            self.pro_status.state = "ready"
            self.pro_status.ready = True
            return

        if getattr(self.pro_model, "session", None) is not None:
            self.pro_status.state = "ready"
            self.pro_status.ready = True
            return

        if self.pro_status.state == "loading":
            raise WarmupPendingError("Le modele pro est en cours de chargement.")

        try:
            self.pro_model.ensure_loaded()
        except FileNotFoundError as exc:
            message = str(exc)
            self.pro_status.state = "missing"
            self.pro_status.ready = False
            self.pro_status.message = message
            raise ModelsUnavailableError(message) from exc
        except Exception as exc:  # noqa: BLE001
            self.pro_status.state = "error"
            self.pro_status.ready = False
            self.pro_status.message = str(exc)
            raise ModelsUnavailableError(
                f"Echec chargement modele pro: {exc}"
            ) from exc

    def status_snapshot(self) -> dict:
        pro_ready = bool(self.pro_status.ready)
        state = self.pro_status.state or "idle"
        if pro_ready:
            status = "ok"
        elif state in {"loading", "idle"}:
            status = "warming_up"
        else:
            status = "degraded"

        return {
            "status": status,
            "models": {
                "fast": {"model": self.fast_model_name},
                "pro": {
                    "model": self.pro_label,
                    "slug": self.pro_canonical_name,
                    "state": state,
                    "ready": pro_ready,
                    "warming": bool(self.pro_status.warming or self._warmup_running),
                    "message": self.pro_status.message,
                    "path": self.pro_status.path,
                    "device": self.pro_status.device,
                },
            },
            "model_dir": str(MODEL_DIR.resolve()),
        }

    def health(self) -> dict:
        return self.status_snapshot()

    def ensure_ready(self) -> dict:
        try:
            self._ensure_pro_ready()
        except Exception:  # noqa: BLE001
            LOGGER.exception("ensure_ready a echoue")
        return self.status_snapshot()

    def remove_background(
        self,
        image_bytes: bytes,
        quality: str = "pro",
    ) -> Tuple[bytes, bool]:
        quality = (quality or "pro").lower()
        if quality not in SUPPORTED_QUALITY:
            quality = "pro"

        if quality == "fast":
            return self._remove_fast(image_bytes), False

        try:
            self._ensure_pro_ready()
        except WarmupPendingError as exc:
            if self.auto_fallback:
                LOGGER.warning("Modele pro en warmup: fallback fast.")
                return self._remove_fast(image_bytes), True
            raise
        except ModelsUnavailableError as exc:
            if self.auto_fallback:
                LOGGER.warning("Modele pro indisponible: %s. Fallback fast.", exc)
                return self._remove_fast(image_bytes), True
            raise

        try:
            return self._remove_pro(image_bytes), False
        except ModelsUnavailableError:
            raise
        except Exception:  # noqa: BLE001
            LOGGER.exception("Echec pipeline pro; fallback fast.")
            if self.auto_fallback:
                return self._remove_fast(image_bytes), True
            raise

    def _remove_fast(self, image_bytes: bytes) -> bytes:
        return rembg_remove(image_bytes, session=self.rembg_fast_session)

    def _remove_pro(self, image_bytes: bytes) -> bytes:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        rgb = np.array(image, dtype=np.uint8)

        start = time.perf_counter()
        mask = self.pro_model.predict_mask(image)
        duration = (time.perf_counter() - start) * 1000
        LOGGER.info(
            "pro.inference",
            extra={
                "model": self.pro_canonical_name,
                "duration_ms": round(duration, 2),
                "size": [image.width, image.height],
            },
        )
        mask = cv2.GaussianBlur(mask, (3, 3), 0.5)
        return composite_straight_alpha(rgb, mask)


if _env_bool("WIZPIX_SKIP_PIPELINE_INIT", False):
    pipeline = None  # type: ignore[assignment]
else:
    pipeline = BackgroundRemovalPipeline()

__all__ = [
    "BackgroundRemovalPipeline",
    "WarmupPendingError",
    "ModelsUnavailableError",
    "pipeline",
    "composite_straight_alpha",
]
