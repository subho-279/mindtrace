import asyncio
import json

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings

router = APIRouter()

@router.websocket("/session/{session_id}")
async def session_stream(websocket: WebSocket, session_id: str):
    """
    Real-time WebSocket stream for a session.
    Subscribes to all modality channels and pushes updates to the client.
    """
    await websocket.accept()

    # Each WS connection gets its own Redis pub/sub client
    r = await aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()

    channels = [
        f"session:{session_id}:facial",
        f"session:{session_id}:speech",
        f"session:{session_id}:text",
        f"session:{session_id}:micro",
        f"session:{session_id}:fused",
    ]
    await pubsub.subscribe(*channels)

    async def redis_listener():
        async for message in pubsub.listen():
            if message["type"] == "message":
                channel: str = message["channel"]
                modality = channel.split(":")[-1]
                payload = {
                    "modality": modality,
                    "data": json.loads(message["data"]),
                }
                try:
                    await websocket.send_json(payload)
                except Exception:
                    break

    async def heartbeat():
        while True:
            try:
                await websocket.send_json({"type": "ping"})
                await asyncio.sleep(15)
            except Exception:
                break

    listener_task   = asyncio.create_task(redis_listener())
    heartbeat_task  = asyncio.create_task(heartbeat())

    try:
        while True:
            msg = await websocket.receive_text()
            # Client can send {"type":"ping"} to keep alive
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        heartbeat_task.cancel()
        await pubsub.unsubscribe(*channels)
        await r.aclose()
