import os
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from services.pipeline import (
    ModelsUnavailableError,
    WarmupPendingError,
    pipeline,
)

ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app = FastAPI(
    title="WizPix Background API",
    version="1.0.0",
    description="Microservice FastAPI pour supprimer les arriere-plans (fast rembg ou pipeline pro)",
)


def _str_to_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@app.on_event("startup")
async def warmup_on_startup() -> None:
    if _str_to_bool(os.getenv("WARMUP_ON_STARTUP", "true"), True):
        pipeline.start_warmup(
            blocking=_str_to_bool(os.getenv("WARMUP_BLOCKING", "false"), False)
        )


@app.get("/health")
async def health_check():
    return pipeline.health()


@app.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
    quality: str = Query("pro", regex="^(?i)(fast|pro)$"),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Format non supporte (autorise: PNG, JPEG, WEBP).",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Fichier trop volumineux (10 MB max).",
        )

    try:
        output_bytes, used_fallback = pipeline.remove_background(data, quality=quality)
    except WarmupPendingError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ModelsUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Erreur pendant le traitement de l'image: {exc}",
        ) from exc

    original_name = Path(file.filename or "image").stem or "image"
    safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in original_name)
    output_name = f"{safe_name}-bg-removed.png"

    stream = BytesIO(output_bytes)
    stream.seek(0)

    response = StreamingResponse(
        stream,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{output_name}"'},
    )
    if used_fallback:
        response.headers["X-Wizpix-Fallback"] = "fast"
    return response
