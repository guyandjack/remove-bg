from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from rembg import remove

ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

app = FastAPI(
    title="WizPix Background API",
    version="1.0.0",
    description="Microservice FastAPI pour supprimer les arriere-plans via rembg",
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Format non supporte (autorise: PNG, JPEG, WEBP).",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (10 MB max).")

    try:
        output_bytes = remove(data)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur pendant le traitement de l'image: {exc}",
        ) from exc

    original_name = Path(file.filename or "image").stem or "image"
    safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in original_name)
    output_name = f"{safe_name}-bg-removed.png"

    stream = BytesIO(output_bytes)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{output_name}"'},
    )
