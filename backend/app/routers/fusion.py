from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json, time
from collections import defaultdict

from app.core.redis import get_redis
from app.models.emotions import (
    FusedEmotionResult, EmotionScore, Emotion, BehavioralReport
)
from app.services.fusion_engine import fuse_modalities
from app.services.report_generator import generate_report

router = APIRouter()

class FusionRequest(BaseModel):
    session_id: str
    strategy: str = "late"   # "early" | "late" | "attention"

@router.post("/analyze", response_model=FusedEmotionResult)
async def fuse_session(body: FusionRequest):
    """Fuse all available modality results for a session."""
    redis = get_redis()
    start = time.time()

    # Gather latest results from all modalities
    modalities = {}
    for mod in ["facial", "speech", "text", "micro"]:
        raw = await redis.lrange(f"session:{body.session_id}:{mod}:history", 0, 0)
        if raw:
            modalities[mod] = json.loads(raw[0])

    if not modalities:
        raise HTTPException(
            status_code=404,
            detail=f"No modality data found for session {body.session_id}"
        )

    result = fuse_modalities(
        modalities=modalities,
        session_id=body.session_id,
        strategy=body.strategy,
        elapsed_ms=(time.time() - start) * 1000,
    )

    await redis.set(
        f"session:{body.session_id}:fused",
        result.model_dump_json(),
        ex=3600,
    )
    await redis.publish(f"session:{body.session_id}:fused", result.model_dump_json())
    return result


@router.get("/result/{session_id}", response_model=FusedEmotionResult)
async def get_fused_result(session_id: str):
    redis = get_redis()
    raw = await redis.get(f"session:{session_id}:fused")
    if not raw:
        raise HTTPException(status_code=404, detail="No fused result for session")
    return FusedEmotionResult(**json.loads(raw))


@router.post("/report/{session_id}", response_model=BehavioralReport)
async def generate_behavioral_report(session_id: str):
    """Generate an AI-powered behavioral report for a session."""
    redis = get_redis()

    fused_raw = await redis.get(f"session:{session_id}:fused")
    if not fused_raw:
        raise HTTPException(status_code=404, detail="Run /fusion/analyze first")

    fused = FusedEmotionResult(**json.loads(fused_raw))

    # Pull full histories for richer context
    facial_hist  = [json.loads(r) for r in await redis.lrange(f"session:{session_id}:facial:history", 0, 20)]
    speech_hist  = [json.loads(r) for r in await redis.lrange(f"session:{session_id}:speech:history", 0, 10)]
    text_hist    = [json.loads(r) for r in await redis.lrange(f"session:{session_id}:text:history", 0, 20)]
    micro_events = [json.loads(r) for r in await redis.lrange(f"session:{session_id}:micro:history", 0, -1)]

    report = await generate_report(
        session_id=session_id,
        fused=fused,
        facial_history=facial_hist,
        speech_history=speech_hist,
        text_history=text_hist,
        micro_events=micro_events,
    )

    await redis.set(f"session:{session_id}:report", report.model_dump_json(), ex=7200)
    return report


@router.get("/report/{session_id}", response_model=BehavioralReport)
async def get_report(session_id: str):
    redis = get_redis()
    raw = await redis.get(f"session:{session_id}:report")
    if not raw:
        raise HTTPException(status_code=404, detail="No report generated yet")
    return BehavioralReport(**json.loads(raw))
