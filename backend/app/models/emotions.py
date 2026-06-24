from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Emotion(str, Enum):
    angry    = "angry"
    disgust  = "disgust"
    fear     = "fear"
    happy    = "happy"
    sad      = "sad"
    surprise = "surprise"
    neutral  = "neutral"
    contempt = "contempt"

class EmotionScore(BaseModel):
    emotion: Emotion
    confidence: float = Field(..., ge=0.0, le=1.0)

class FacialEmotionResult(BaseModel):
    session_id: str
    frame_id: Optional[int] = None
    dominant: Emotion
    scores: list[EmotionScore]
    face_detected: bool
    landmarks_count: Optional[int] = None
    processing_ms: float

class SpeechEmotionResult(BaseModel):
    session_id: str
    dominant: Emotion
    scores: list[EmotionScore]
    valence: float = Field(..., ge=-1.0, le=1.0)
    arousal: float = Field(..., ge=0.0, le=1.0)
    duration_s: float
    processing_ms: float

class TextSentimentResult(BaseModel):
    session_id: str
    dominant: Emotion
    scores: list[EmotionScore]
    valence: float = Field(..., ge=-1.0, le=1.0)
    sentiment: str   # positive / negative / neutral
    processing_ms: float

class MicroExpressionEvent(BaseModel):
    session_id: str
    frame_id: int
    timestamp_ms: float
    suppressed_emotion: Emotion
    confidence: float
    duration_ms: float
    action_units: list[str]

class FusedEmotionResult(BaseModel):
    session_id: str
    dominant: Emotion
    scores: list[EmotionScore]
    modalities_used: list[str]
    fusion_strategy: str
    confidence: float
    micro_alerts: list[MicroExpressionEvent] = []
    processing_ms: float

class BehavioralReport(BaseModel):
    session_id: str
    summary: str
    dominant_emotion: Emotion
    emotional_arc: str
    key_moments: list[str]
    wellness_indicators: dict[str, str]
    recommendations: list[str]
    generated_at: str
