import json
import uuid

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.redis import get_redis
from app.models.emotions import SpeechEmotionResult

router = APIRouter()

@router.post("/analyze", response_model=SpeechEmotionResult)
async def analyze_speech(
    file: UploadFile = File(...),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4())),
):
    """Analyze speech emotion from uploaded audio (wav/mp3/ogg)."""
    contents = await file.read()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{settings.ml_speech_url}/predict",
                files={"file": (file.filename, contents, file.content_type)},
                data={"session_id": session_id},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=str(e))

    result = SpeechEmotionResult(**resp.json())
    redis = get_redis()
    await redis.publish(f"session:{session_id}:speech", result.model_dump_json())
    await redis.lpush(f"session:{session_id}:speech:history", result.model_dump_json())
    await redis.expire(f"session:{session_id}:speech:history", 3600)
    return result


@router.get("/history/{session_id}")
async def get_speech_history(session_id: str, limit: int = 50):
    redis = get_redis()
    raw = await redis.lrange(f"session:{session_id}:speech:history", 0, limit - 1)
    return [json.loads(r) for r in raw]
