from io import BytesIO
import os

import numpy as np
from PIL import Image

os.environ["WIZPIX_SKIP_PIPELINE_INIT"] = "1"

from services.pipeline import composite_straight_alpha


def test_composite_straight_alpha():
    rgb = np.array(
        [
            [[255, 0, 0], [0, 255, 0]],
            [[0, 0, 255], [255, 255, 0]],
        ],
        dtype=np.uint8,
    )
    alpha = np.array(
        [
            [1.0, 0.5],
            [0.0, 1.0],
        ],
        dtype=np.float32,
    )
    data = composite_straight_alpha(rgb, alpha)
    with Image.open(BytesIO(data)) as img:
        assert img.mode == "RGBA"
        arr = np.array(img)
    np.testing.assert_array_equal(arr[..., :3], rgb)
    expected_alpha = (alpha * 255).astype(np.uint8)
    np.testing.assert_array_equal(arr[..., 3], expected_alpha)
