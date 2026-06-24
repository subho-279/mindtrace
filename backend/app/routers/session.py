from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid, json
from datetime import datetime, timezone

from app.core.redis import get_redis

router = APIRouter()

class SessionCreate(BaseModel):
    label: str = ""
    modalities: list[str] = ["facial", "speech", "text", "micro"]

class SessionInfo(BaseModel):
    session_id: str
    label: str
    modalities: list[str]
    created_at: str
    status: str

@router.post("/create", response_model=SessionInfo)
async def create_session(body: SessionCreate):
    """Create a new analysis session."""
    session_id = str(uuid.uuid4())
    info = SessionInfo(
        session_id=session_id,
        label=body.label or f"Session {session_id[:8]}",
        modalities=body.modalities,
        created_at=datetime.now(timezone.utc).isoformat(),
        status="active",
    )
    redis = get_redis()
    await redis.set(f"session:{session_id}:info", info.model_dump_json(), ex=86400)
    await redis.lpush("sessions:list", session_id)
    await redis.ltrim("sessions:list", 0, 49)   # keep last 50 sessions
    return info


@router.get("/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    redis = get_redis()
    raw = await redis.get(f"session:{session_id}:info")
    if not raw:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionInfo(**json.loads(raw))


@router.get("/")
async def list_sessions():
    redis = get_redis()
    ids = await redis.lrange("sessions:list", 0, 49)
    sessions = []
    for sid in ids:
        raw = await redis.get(f"session:{sid}:info")
        if raw:
            sessions.append(json.loads(raw))
    return sessions


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    redis = get_redis()
    keys = await redis.keys(f"session:{session_id}:*")
    if keys:
        await redis.delete(*keys)
    await redis.lrem("sessions:list", 0, session_id)
    return {"deleted": session_id}
