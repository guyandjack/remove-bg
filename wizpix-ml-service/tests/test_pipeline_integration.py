import os
from io import BytesIO

import numpy as np
from PIL import Image

os.environ["WIZPIX_SKIP_PIPELINE_INIT"] = "1"

from services.pipeline import BackgroundRemovalPipeline


def _solid_image_bytes(color=(128, 64, 32), size=(16, 16)) -> bytes:
    img = Image.new("RGB", size, color)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def _coarse_rgba_bytes(size=(16, 16)) -> bytes:
    arr = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    arr[..., :3] = 255
    arr[3:-3, 3:-3, 3] = 255
    image = Image.fromarray(arr, mode="RGBA")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_remove_background_pro_returns_png_rgba(monkeypatch):
    os.environ["PRO_MODEL_NAME"] = "mock"

    monkeypatch.setattr(
        "services.pipeline.new_session",
        lambda *_args, **_kwargs: object(),
    )
    monkeypatch.setattr(
        "services.pipeline.rembg_remove",
        lambda data, session=None: data,
    )

    pipeline = BackgroundRemovalPipeline()

    monkeypatch.setattr(
        pipeline,
        "_remove_fast",
        lambda _: _coarse_rgba_bytes(),
    )

    result, used_fallback = pipeline.remove_background(
        _solid_image_bytes(),
        quality="pro",
    )

    assert used_fallback is False
    with Image.open(BytesIO(result)) as img:
        assert img.mode == "RGBA"
        assert img.size == (16, 16)
