import json
import uuid

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.redis import get_redis
from app.models.emotions import TextSentimentResult

router = APIRouter()

class TextAnalysisRequest(BaseModel):
    text: str
    session_id: str = ""

    def model_post_init(self, __context):
        if not self.session_id:
            self.session_id = str(uuid.uuid4())

@router.post("/analyze", response_model=TextSentimentResult)
async def analyze_text(body: TextAnalysisRequest):
    """Analyze emotion and sentiment from free text."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{settings.ml_text_url}/predict",
                json={"text": body.text, "session_id": body.session_id},
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=str(e))

    result = TextSentimentResult(**resp.json())
    redis = get_redis()
    await redis.publish(f"session:{body.session_id}:text", result.model_dump_json())
    await redis.lpush(f"session:{body.session_id}:text:history", result.model_dump_json())
    await redis.expire(f"session:{body.session_id}:text:history", 3600)
    return result


@router.get("/history/{session_id}")
async def get_text_history(session_id: str, limit: int = 100):
    redis = get_redis()
    raw = await redis.lrange(f"session:{session_id}:text:history", 0, limit - 1)
    return [json.loads(r) for r in raw]
