import logging
import os
from io import BytesIO
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Optional, Tuple

import cv2
import numpy as np
import onnxruntime as ort
import requests
from PIL import Image
from rembg import new_session, remove as rembg_remove

LOGGER = logging.getLogger(__name__)

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
DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_DIR = Path(
    os.getenv("MODEL_DIR")
    or os.getenv("PIPELINE_MODEL_DIR")
    or DEFAULT_MODEL_DIR
)
SUPPORTED_QUALITY = {"fast", "pro"}


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class WarmupPendingError(RuntimeError):
    """Raised when pro quality is requested but models are still warming up."""


class ModelsUnavailableError(RuntimeError):
    """Raised when pro quality models are missing locally."""


class BackgroundRemovalPipeline:
    """Two-stage background removal pipeline with warmup + fast fallback."""

    def __init__(self, device: Optional[str] = None) -> None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.device_request = (device or os.getenv("PIPELINE_DEVICE") or "auto").lower()
        self.segmentation_session: Optional[ort.InferenceSession] = None
        self.matting_session: Optional[ort.InferenceSession] = None
        self._providers = self._select_providers()
        self.auto_fallback = _env_bool("AUTO_FALLBACK_FAST", True)
        self.allow_remote_download = _env_bool("ALLOW_REMOTE_DOWNLOAD", False)
        self.segmentation_state = self._initial_state(ISNET_FILENAME)
        self.matting_state = self._initial_state(MODNET_FILENAME)
        self.rembg_fast_session = new_session("u2net")
        self.rembg_hq_session = new_session("u2net_human_seg")
        self._warmup_lock = Lock()
        self._warmup_thread: Optional[Thread] = None
        self._warmup_event = Event()
        self._warmup_event.set()
        self._warmup_in_progress = False

    def _initial_state(self, filename: str) -> str:
        destination = MODEL_DIR / filename
        if not self.allow_remote_download and not destination.exists():
            return "missing"
        return "loading"

    def start_warmup(self, blocking: bool = False) -> None:
        with self._warmup_lock:
            if not (self._warmup_thread and self._warmup_thread.is_alive()):
                self._warmup_event.clear()
                self._warmup_in_progress = True

                def _run() -> None:
                    try:
                        try:
                            self._ensure_segmentation_session()
                        except FileNotFoundError:
                            LOGGER.warning(
                                "Warmup: segmentation model missing at %s",
                                MODEL_DIR / ISNET_FILENAME,
                            )
                        except Exception:  # noqa: BLE001
                            LOGGER.exception("Warmup: segmentation model failed to load.")
                        try:
                            self._ensure_matting_session()
                        except FileNotFoundError:
                            LOGGER.warning(
                                "Warmup: matting model missing at %s",
                                MODEL_DIR / MODNET_FILENAME,
                            )
                        except Exception:  # noqa: BLE001
                            LOGGER.exception("Warmup: matting model failed to load.")
                    finally:
                        self._warmup_in_progress = False
                        self._warmup_event.set()

                self._warmup_thread = Thread(target=_run, name="wizpix-warmup", daemon=True)
                self._warmup_thread.start()
        if blocking:
            self._warmup_event.wait()

    def ensure_ready(self) -> dict:
        try:
            self._ensure_segmentation_session()
        except Exception:  # noqa: BLE001
            LOGGER.exception("Unable to load segmentation model.")
        try:
            self._ensure_matting_session()
        except Exception:  # noqa: BLE001
            LOGGER.exception("Unable to load matting model.")
        return self.status_snapshot()

    def status_snapshot(self) -> dict:
        models = {
            "segmentation": self.segmentation_state,
            "matting": self.matting_state,
        }
        ready = all(state == "ready" for state in models.values())
        warming = self._warmup_in_progress or any(state == "loading" for state in models.values())
        missing_models = [name for name, state in models.items() if state == "missing"]
        status = "ok" if ready else ("warming_up" if warming else "degraded")
        return {
            "status": status,
            "ready": ready,
            "warming": warming,
            "models": models,
            "missing_models": missing_models,
            "device": "cuda"
            if any(provider.startswith("CUDA") for provider in self._providers)
            else "cpu",
            "model_dir": str(MODEL_DIR.resolve()),
            "allow_remote_download": self.allow_remote_download,
        }

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

        readiness = self.ensure_ready()
        if not readiness["ready"]:
            missing = readiness.get("missing_models", [])
            if readiness.get("warming"):
                if self.auto_fallback:
                    LOGGER.warning("Pro pipeline warming up, falling back to fast mode.")
                    return self._remove_fast(image_bytes), True
                raise WarmupPendingError("Models warming up")
            if missing:
                message = (
                    "Models missing: "
                    + ", ".join(missing)
                    + f". Place the files in {readiness.get('model_dir')} or enable ALLOW_REMOTE_DOWNLOAD."
                )
                if self.auto_fallback:
                    LOGGER.warning("%s Bascule sur fast.", message)
                    return self._remove_fast(image_bytes), True
                raise ModelsUnavailableError(message)
            if self.auto_fallback:
                LOGGER.warning("Pro pipeline degrade, falling back to fast mode.")
                return self._remove_fast(image_bytes), True
            raise RuntimeError("Pro pipeline indisponible")

        try:
            return self._remove_pro(image_bytes), False
        except Exception:  # noqa: BLE001
            LOGGER.exception("Pro pipeline failed.")
            if self.auto_fallback:
                return self._remove_fast(image_bytes), True
            raise

    def _remove_fast(self, image_bytes: bytes) -> bytes:
        return rembg_remove(image_bytes, session=self.rembg_fast_session)

    def _remove_pro(self, image_bytes: bytes) -> bytes:
        candidates = [
            self._run_rembg_variant(
                image_bytes,
                session=self.rembg_hq_session,
                label="human_hq",
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_structure_size=3,
                alpha_matting_base_size=1000,
                post_process_mask=True,
            ),
            self._run_rembg_variant(
                image_bytes,
                session=self.rembg_general_hq_session,
                label="general_hq",
                alpha_matting=True,
                alpha_matting_foreground_threshold=220,
                alpha_matting_background_threshold=20,
                alpha_matting_erode_structure_size=3,
                alpha_matting_base_size=800,
                post_process_mask=True,
            ),
        ]
        best = max(candidates, key=lambda item: item["score"])
        LOGGER.info(
            "Pro pipeline score comparison",
            extra={
                "scores": {c["label"]: round(c["score"], 4) for c in candidates},
                "chosen": best["label"],
            },
        )
        if best["score"] < 0.15:
            LOGGER.warning(
                "Pro pipeline low score (%.3f). Falling back to fast rendering.",
                best["score"],
            )
            return self._remove_fast(image_bytes)
        return best["bytes"]

    def _run_rembg_variant(
        self,
        image_bytes: bytes,
        *,
        session,
        label: str,
        **kwargs,
    ) -> dict:
        output = rembg_remove(image_bytes, session=session, **kwargs)
        alpha = self._extract_alpha(output)
        score = self._alpha_score(alpha)
        return {"label": label, "bytes": output, "alpha": alpha, "score": score}

    @staticmethod
    def _extract_alpha(image_bytes: bytes) -> np.ndarray:
        with Image.open(BytesIO(image_bytes)) as img:
            alpha = np.array(img.convert("RGBA").split()[-1], dtype=np.float32) / 255.0
        return alpha

    @staticmethod
    def _alpha_score(alpha: np.ndarray) -> float:
        mean = float(alpha.mean())
        std = float(alpha.std())
        coverage = 1.0 - abs(mean - 0.5) * 2  # proche de 0.5 favorise un mix fg/bg
        coverage = np.clip(coverage, 0.0, 1.0)
        score = 0.65 * coverage + 0.35 * std
        return float(np.clip(score, 0.0, 1.0))

    def _run_segmentation(self, image: Image.Image) -> np.ndarray:
        session = self._ensure_segmentation_session()

        arr = np.array(image, dtype=np.uint8)
        h, w = arr.shape[:2]
        resized = cv2.resize(arr, (1024, 1024), interpolation=cv2.INTER_LINEAR)
        normalized = resized.astype(np.float32) / 255.0
        normalized = (normalized - 0.5) / 0.5
        blob = np.transpose(normalized, (2, 0, 1))[None, ...]

        input_name = session.get_inputs()[0].name
        pred = session.run(None, {input_name: blob})[0].squeeze()
        mask = cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = (mask - mask.min()) / (mask.max() - mask.min() + 1e-6)
        return mask.astype(np.float32)

    def _run_modnet(self, image: Image.Image) -> np.ndarray:
        session = self._ensure_matting_session()

        arr = np.array(image, dtype=np.uint8)
        h, w = arr.shape[:2]
        ref_size = 512
        im_h, im_w = h, w
        scale = 1.0
        if max(im_h, im_w) > ref_size:
            scale = ref_size / max(im_h, im_w)
        new_w = max(int(im_w * scale), 32)
        new_h = max(int(im_h * scale), 32)
        new_w = new_w - new_w % 32 or 32
        new_h = new_h - new_h % 32 or 32
        resized = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        normalized = resized.astype(np.float32) / 255.0
        normalized = (normalized - 0.5) / 0.5
        blob = np.transpose(normalized, (2, 0, 1))[None, ...]

        pad_h = max(ref_size - new_h, 0)
        pad_w = max(ref_size - new_w, 0)
        padded = np.pad(
            blob,
            (
                (0, 0),
                (0, 0),
                (pad_h // 2, pad_h - pad_h // 2),
                (pad_w // 2, pad_w - pad_w // 2),
            ),
            mode="constant",
        )

        input_name = session.get_inputs()[0].name
        pred = session.run(None, {input_name: padded})[0]
        pred = pred[
            :,
            :,
            pad_h // 2 : pad_h // 2 + new_h,
            pad_w // 2 : pad_w // 2 + new_w,
        ]
        matte = pred.squeeze()
        matte = cv2.resize(matte, (w, h), interpolation=cv2.INTER_LINEAR)
        matte = np.clip(matte, 0.0, 1.0)
        return matte.astype(np.float32)

    @staticmethod
    def _refine_alpha(coarse: np.ndarray, matte: np.ndarray) -> np.ndarray:
        base = np.clip(matte * 0.9 + coarse * 0.1, 0.0, 1.0)
        sure_fg = cv2.erode(base, np.ones((3, 3), np.uint8), iterations=1)
        feather = cv2.GaussianBlur(base, (5, 5), 0.7)
        combined = np.maximum(sure_fg, feather * 0.98)
        combined = np.clip(combined ** 0.9, 0.0, 1.0)
        return combined

    @staticmethod
    def _composite(image: Image.Image, alpha: np.ndarray) -> bytes:
        rgb = np.array(image.convert("RGB"), dtype=np.float32)
        alpha_channel = np.clip(alpha, 0.0, 1.0)
        premultiplied = (rgb * alpha_channel[..., None]).astype(np.uint8)
        alpha_uint8 = (alpha_channel * 255).astype(np.uint8)
        rgba = np.dstack((premultiplied, alpha_uint8))
        buffer = BytesIO()
        Image.fromarray(rgba, mode="RGBA").save(buffer, format="PNG")
        buffer.seek(0)
        return buffer.getvalue()

    def _ensure_segmentation_session(self) -> ort.InferenceSession:
        if self.segmentation_session:
            self.segmentation_state = "ready"
            return self.segmentation_session
        destination = MODEL_DIR / ISNET_FILENAME
        if not destination.exists() and not self.allow_remote_download:
            self.segmentation_state = "missing"
            raise FileNotFoundError(
                f"Model {ISNET_FILENAME} not found in {destination.parent}"
            )
        self.segmentation_state = "loading"
        try:
            self.segmentation_session = self._create_session(
                ISNET_FILENAME,
                ISNET_URL,
            )
            self.segmentation_state = "ready"
        except FileNotFoundError:
            self.segmentation_state = "missing"
            raise
        except Exception:  # noqa: BLE001
            self.segmentation_state = "error"
            raise
        return self.segmentation_session

    def _ensure_matting_session(self) -> ort.InferenceSession:
        if self.matting_session:
            self.matting_state = "ready"
            return self.matting_session
        destination = MODEL_DIR / MODNET_FILENAME
        if not destination.exists() and not self.allow_remote_download:
            self.matting_state = "missing"
            raise FileNotFoundError(
                f"Model {MODNET_FILENAME} not found in {destination.parent}"
            )
        self.matting_state = "loading"
        try:
            self.matting_session = self._create_session(
                MODNET_FILENAME,
                MODNET_URL,
            )
            self.matting_state = "ready"
        except FileNotFoundError:
            self.matting_state = "missing"
            raise
        except Exception:  # noqa: BLE001
            self.matting_state = "error"
            raise
        return self.matting_session

    def _create_session(self, filename: str, url: str) -> ort.InferenceSession:
        model_path = self._resolve_model(filename, url)
        return ort.InferenceSession(str(model_path), providers=self._providers)

    def _resolve_model(self, filename: str, url: str) -> Path:
        destination = MODEL_DIR / filename
        if destination.exists():
            return destination
        if not self.allow_remote_download:
            raise FileNotFoundError(
                f"Model {filename} not found in {destination.parent}. "
                "Run `python scripts/fetch_models.py` or set ALLOW_REMOTE_DOWNLOAD=true."
            )
        LOGGER.info("Downloading model %s", filename)
        response = requests.get(url, timeout=120)
        try:
            response.raise_for_status()
        except requests.HTTPError:
            LOGGER.error(
                "Unable to download %s from %s (status %s)",
                filename,
                url,
                response.status_code,
            )
            raise
        destination.write_bytes(response.content)
        return destination

    def _select_providers(self) -> list[str]:
        available = ort.get_available_providers()
        if self.device_request == "cuda" and "CUDAExecutionProvider" in available:
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if self.device_request == "cpu":
            return ["CPUExecutionProvider"]
        if self.device_request == "auto" and "CUDAExecutionProvider" in available:
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        return ["CPUExecutionProvider"]

    def health(self) -> dict:
        return self.status_snapshot()


pipeline = BackgroundRemovalPipeline()
