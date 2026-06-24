from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.routers import facial, speech, text, micro, fusion, session, ws

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    yield
    await close_redis()

app = FastAPI(
    title="MindTrace++ API",
    description="Multimodal Emotion & Behavioral Intelligence System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facial.router,  prefix="/facial",  tags=["Facial Emotion"])
app.include_router(speech.router,  prefix="/speech",  tags=["Speech Emotion"])
app.include_router(text.router,    prefix="/text",    tags=["Text Sentiment"])
app.include_router(micro.router,   prefix="/micro",   tags=["Micro-Expression"])
app.include_router(fusion.router,  prefix="/fusion",  tags=["Multimodal Fusion"])
app.include_router(session.router, prefix="/session", tags=["Sessions"])
app.include_router(ws.router,      prefix="/ws",      tags=["WebSocket"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "mindtrace-api"}
