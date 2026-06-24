"""
MindTrace++ Backend Tests
Run: pytest tests/ -v
"""
import json
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Fixtures ──────────────────────────────────────────────────────────────────

MOCK_FACIAL_RESULT = {
    "session_id": "test-session",
    "frame_id": 0,
    "dominant": "happy",
    "scores": [
        {"emotion": "happy",    "confidence": 0.72},
        {"emotion": "neutral",  "confidence": 0.13},
        {"emotion": "surprise", "confidence": 0.08},
        {"emotion": "sad",      "confidence": 0.03},
        {"emotion": "angry",    "confidence": 0.02},
        {"emotion": "fear",     "confidence": 0.01},
        {"emotion": "disgust",  "confidence": 0.01},
    ],
    "face_detected": True,
    "landmarks_count": 12,
    "processing_ms": 22.5,
}

MOCK_TEXT_RESULT = {
    "session_id": "test-session",
    "dominant": "happy",
    "scores": [
        {"emotion": "happy",   "confidence": 0.81},
        {"emotion": "neutral", "confidence": 0.10},
        {"emotion": "surprise","confidence": 0.05},
        {"emotion": "sad",     "confidence": 0.02},
        {"emotion": "angry",   "confidence": 0.01},
        {"emotion": "fear",    "confidence": 0.005},
        {"emotion": "disgust", "confidence": 0.005},
    ],
    "valence": 0.75,
    "sentiment": "positive",
    "processing_ms": 5.1,
}

MOCK_SPEECH_RESULT = {
    "session_id": "test-session",
    "dominant": "happy",
    "scores": [
        {"emotion": "happy",   "confidence": 0.60},
        {"emotion": "neutral", "confidence": 0.20},
        {"emotion": "surprise","confidence": 0.10},
        {"emotion": "sad",     "confidence": 0.05},
        {"emotion": "angry",   "confidence": 0.02},
        {"emotion": "fear",    "confidence": 0.02},
        {"emotion": "disgust", "confidence": 0.01},
    ],
    "valence": 0.8,
    "arousal": 0.6,
    "duration_s": 2.0,
    "processing_ms": 350.0,
}

MOCK_FUSED_RESULT = {
    "session_id": "test-session",
    "dominant": "happy",
    "scores": [
        {"emotion": "happy",   "confidence": 0.71},
        {"emotion": "neutral", "confidence": 0.14},
        {"emotion": "surprise","confidence": 0.07},
        {"emotion": "sad",     "confidence": 0.04},
        {"emotion": "angry",   "confidence": 0.02},
        {"emotion": "fear",    "confidence": 0.01},
        {"emotion": "disgust", "confidence": 0.01},
    ],
    "modalities_used": ["facial", "text", "speech"],
    "fusion_strategy": "late",
    "confidence": 0.71,
    "micro_alerts": [],
    "processing_ms": 8.2,
}


# ── App client setup ─────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """FastAPI test client with Redis and ML services mocked."""
    # Mock Redis before app import
    mock_redis = AsyncMock()
    mock_redis.publish  = AsyncMock(return_value=1)
    mock_redis.lpush    = AsyncMock(return_value=1)
    mock_redis.expire   = AsyncMock(return_value=True)
    mock_redis.set      = AsyncMock(return_value=True)
    mock_redis.get      = AsyncMock(return_value=None)
    mock_redis.lrange   = AsyncMock(return_value=[])
    mock_redis.keys     = AsyncMock(return_value=[])
    mock_redis.delete   = AsyncMock(return_value=1)
    mock_redis.lrem     = AsyncMock(return_value=1)
    mock_redis.ltrim    = AsyncMock(return_value=True)
    mock_redis.ping     = AsyncMock(return_value=True)

    with patch("app.core.redis._redis", mock_redis), \
         patch("app.core.redis.init_redis", AsyncMock()), \
         patch("app.core.redis.close_redis", AsyncMock()):
        from app.main import app
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Session ───────────────────────────────────────────────────────────────────

def test_create_session(client):
    with patch("app.core.redis._redis") as mock_r:
        mock_r.set   = AsyncMock(return_value=True)
        mock_r.lpush = AsyncMock(return_value=1)
        mock_r.ltrim = AsyncMock(return_value=True)

        r = client.post("/session/create", json={
            "label": "Test Session",
            "modalities": ["facial", "speech", "text"],
        })
    assert r.status_code == 200
    data = r.json()
    assert "session_id" in data
    assert data["label"] == "Test Session"
    assert data["status"] == "active"


# ── Fusion engine unit tests (no HTTP) ───────────────────────────────────────

def test_late_fusion_happy_dominant():
    from app.services.fusion_engine import fuse_modalities

    modalities = {
        "facial": MOCK_FACIAL_RESULT,
        "text":   MOCK_TEXT_RESULT,
        "speech": MOCK_SPEECH_RESULT,
    }
    result = fuse_modalities(
        modalities=modalities,
        session_id="unit-test",
        strategy="late",
        elapsed_ms=5.0,
    )
    assert result.dominant == "happy"
    assert result.confidence > 0.5
    assert "facial" in result.modalities_used
    assert result.fusion_strategy == "late"


def test_early_fusion():
    from app.services.fusion_engine import fuse_modalities

    modalities = {
        "facial": MOCK_FACIAL_RESULT,
        "text":   MOCK_TEXT_RESULT,
    }
    result = fuse_modalities(
        modalities=modalities,
        session_id="unit-test",
        strategy="early",
        elapsed_ms=3.0,
    )
    assert result.dominant in ["happy", "neutral"]
    assert len(result.scores) > 0


def test_fusion_single_modality():
    from app.services.fusion_engine import fuse_modalities

    result = fuse_modalities(
        modalities={"text": MOCK_TEXT_RESULT},
        session_id="unit-test",
        strategy="late",
        elapsed_ms=1.0,
    )
    assert result.dominant == "happy"
    assert result.modalities_used == ["text"]


def test_fusion_missing_modality_graceful():
    """Fusion should handle missing modalities without crashing."""
    from app.services.fusion_engine import fuse_modalities

    # Only micro events present — no scoring modalities
    result = fuse_modalities(
        modalities={"micro": []},
        session_id="unit-test",
        strategy="late",
        elapsed_ms=1.0,
    )
    assert result.dominant is not None


# ── Emotion model validation ──────────────────────────────────────────────────

def test_emotion_scores_sum_to_one():
    """All emotion confidence scores must sum to ~1.0."""
    from app.services.fusion_engine import fuse_modalities

    result = fuse_modalities(
        modalities={"facial": MOCK_FACIAL_RESULT, "text": MOCK_TEXT_RESULT},
        session_id="unit-test",
        strategy="late",
        elapsed_ms=2.0,
    )
    total = sum(s.confidence for s in result.scores)
    assert abs(total - 1.0) < 0.05, f"Scores sum to {total}, expected ~1.0"


def test_confidence_bounds():
    """All confidence values must be between 0 and 1."""
    from app.services.fusion_engine import fuse_modalities

    result = fuse_modalities(
        modalities={"facial": MOCK_FACIAL_RESULT},
        session_id="unit-test",
        strategy="late",
        elapsed_ms=1.0,
    )
    for score in result.scores:
        assert 0.0 <= score.confidence <= 1.0, f"{score.emotion}: {score.confidence}"


# ── Pydantic model validation ─────────────────────────────────────────────────

def test_fused_result_model():
    from app.models.emotions import FusedEmotionResult
    r = FusedEmotionResult(**MOCK_FUSED_RESULT)
    assert r.dominant == "happy"
    assert r.fusion_strategy == "late"
    assert len(r.scores) == 7


def test_invalid_emotion_rejected():
    from app.models.emotions import EmotionScore
    with pytest.raises(Exception):
        EmotionScore(emotion="confused", confidence=0.5)


def test_confidence_out_of_range_rejected():
    from app.models.emotions import EmotionScore
    with pytest.raises(Exception):
        EmotionScore(emotion="happy", confidence=1.5)
