import json
import uuid

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.redis import get_redis
from app.models.emotions import MicroExpressionEvent

router = APIRouter()

@router.post("/analyze", response_model=list[MicroExpressionEvent])
async def analyze_micro(
    file: UploadFile = File(...),
    session_id: str = Form(default_factory=lambda: str(uuid.uuid4())),
    fps: float = Form(default=30.0),
):
    """Detect micro-expressions in a video file or sequence of frames."""
    contents = await file.read()
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{settings.ml_micro_url}/predict",
                files={"file": (file.filename, contents, file.content_type)},
                data={"session_id": session_id, "fps": str(fps)},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=str(e))

    events = [MicroExpressionEvent(**e) for e in resp.json()]
    redis = get_redis()
    for event in events:
        await redis.publish(f"session:{session_id}:micro", event.model_dump_json())
        await redis.lpush(f"session:{session_id}:micro:history", event.model_dump_json())
    if events:
        await redis.expire(f"session:{session_id}:micro:history", 3600)
    return events


@router.get("/history/{session_id}")
async def get_micro_history(session_id: str):
    redis = get_redis()
    raw = await redis.lrange(f"session:{session_id}:micro:history", 0, -1)
    return [json.loads(r) for r in raw]
