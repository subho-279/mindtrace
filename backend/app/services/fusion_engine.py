from collections import defaultdict

from app.models.emotions import Emotion, EmotionScore, FusedEmotionResult, MicroExpressionEvent

# Confidence weights per modality (tunable)
MODALITY_WEIGHTS = {
    "facial": 0.35,
    "speech": 0.30,
    "text":   0.25,
    "micro":  0.10,
}

def fuse_modalities(
    modalities: dict,
    session_id: str,
    strategy: str,
    elapsed_ms: float,
) -> FusedEmotionResult:
    used = list(modalities.keys())
    micro_events = []

    if strategy in ("late", "attention"):
        scores = _late_fusion(modalities, used)
    else:
        scores = _early_fusion(modalities, used)

    # Extract micro events if present
    if "micro" in modalities:
        for evt in (modalities["micro"] if isinstance(modalities["micro"], list) else []):
            try:
                micro_events.append(MicroExpressionEvent(**evt))
            except Exception:
                pass

    dominant = max(scores, key=lambda s: s.confidence)

    return FusedEmotionResult(
        session_id=session_id,
        dominant=dominant.emotion,
        scores=sorted(scores, key=lambda s: s.confidence, reverse=True),
        modalities_used=used,
        fusion_strategy=strategy,
        confidence=dominant.confidence,
        micro_alerts=micro_events,
        processing_ms=elapsed_ms,
    )


def _late_fusion(modalities: dict, used: list) -> list[EmotionScore]:
    """Confidence-weighted voting across modality predictions."""
    accumulated: dict[str, float] = defaultdict(float)
    total_weight = 0.0

    for mod, result in modalities.items():
        if mod == "micro":
            continue
        weight = MODALITY_WEIGHTS.get(mod, 0.2)
        total_weight += weight
        scores = result.get("scores", [])
        for s in scores:
            emotion = s["emotion"] if isinstance(s, dict) else s.emotion
            conf    = s["confidence"] if isinstance(s, dict) else s.confidence
            accumulated[emotion] += conf * weight

    if total_weight == 0:
        return [EmotionScore(emotion=Emotion.neutral, confidence=1.0)]

    return [
        EmotionScore(emotion=Emotion(k), confidence=round(v / total_weight, 4))
        for k, v in accumulated.items()
    ]


def _early_fusion(modalities: dict, used: list) -> list[EmotionScore]:
    """Simple averaging across available modality scores (placeholder for feature concat)."""
    accumulated: dict[str, list[float]] = defaultdict(list)

    for mod, result in modalities.items():
        if mod == "micro":
            continue
        for s in result.get("scores", []):
            emotion = s["emotion"] if isinstance(s, dict) else s.emotion
            conf    = s["confidence"] if isinstance(s, dict) else s.confidence
            accumulated[emotion].append(conf)

    return [
        EmotionScore(emotion=Emotion(k), confidence=round(sum(v) / len(v), 4))
        for k, v in accumulated.items()
    ]
