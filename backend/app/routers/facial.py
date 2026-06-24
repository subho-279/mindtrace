import json
import time
import uuid

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.redis import get_redis
from app.models.emotions import FacialEmotionResult

router = APIRouter()

@router.post("/analyze", response_model=FacialEmotionResult)
async def analyze_facial(
    file: UploadFile = File(...),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4())),
):
    """Analyze facial emotion from an uploaded image or video frame."""
    contents = await file.read()
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{settings.ml_facial_url}/predict",
                files={"file": (file.filename, contents, file.content_type)},
                data={"session_id": session_id},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"ML service error: {e}")

    result = FacialEmotionResult(**resp.json())

    # Publish to Redis for real-time dashboard
    redis = get_redis()
    await redis.publish(
        f"session:{session_id}:facial",
        result.model_dump_json(),
    )
    await redis.lpush(f"session:{session_id}:facial:history", result.model_dump_json())
    await redis.expire(f"session:{session_id}:facial:history", 3600)

    return result


@router.post("/stream-frame")
async def stream_frame(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    frame_id: int = Form(...),
):
    """Process a single webcam frame and publish result to the session stream."""
    contents = await file.read()
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{settings.ml_facial_url}/predict-frame",
                files={"file": (file.filename, contents, file.content_type)},
                data={"session_id": session_id, "frame_id": str(frame_id)},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=str(e))

    result = resp.json()
    redis = get_redis()
    await redis.publish(f"session:{session_id}:facial", json.dumps(result))
    return result


@router.get("/history/{session_id}")
async def get_facial_history(session_id: str, limit: int = 100):
    """Return past facial emotion predictions for a session."""
    redis = get_redis()
    raw = await redis.lrange(f"session:{session_id}:facial:history", 0, limit - 1)
    return [json.loads(r) for r in raw]
