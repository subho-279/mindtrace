import anthropic, json
from datetime import datetime, timezone
from app.core.config import settings
from app.models.emotions import BehavioralReport, FusedEmotionResult

async def generate_report(
    session_id: str,
    fused: FusedEmotionResult,
    facial_history: list,
    speech_history: list,
    text_history: list,
    micro_events: list,
) -> BehavioralReport:

    context = {
        "dominant_emotion": fused.dominant,
        "fused_scores": [s.model_dump() for s in fused.scores],
        "modalities_used": fused.modalities_used,
        "micro_expression_events": len(micro_events),
        "facial_frames_analyzed": len(facial_history),
        "speech_segments": len(speech_history),
        "text_segments": len(text_history),
        "facial_emotions": [f.get("dominant") for f in facial_history[:10]],
        "speech_emotions": [s.get("dominant") for s in speech_history[:5]],
        "text_emotions": [t.get("dominant") for t in text_history[:10]],
        "suppressed_emotions": [e.get("suppressed_emotion") for e in micro_events],
    }

    prompt = f"""You are MindTrace++, an advanced behavioral intelligence system.
Analyze this multimodal emotion session and produce a structured behavioral report.

SESSION DATA:
{json.dumps(context, indent=2)}

Respond ONLY with a valid JSON object (no markdown, no backticks) with these exact keys:
{{
  "summary": "2-3 sentence plain-language overview of the emotional state",
  "emotional_arc": "description of how emotions shifted during the session",
  "key_moments": ["moment 1", "moment 2", "moment 3"],
  "wellness_indicators": {{
    "stress_level": "low|moderate|high",
    "emotional_regulation": "stable|fluctuating|dysregulated",
    "authenticity": "congruent|mixed|incongruent"
  }},
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}}"""

    if settings.anthropic_api_key:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = _fallback_report(fused)
    else:
        # Fallback when no API key configured
        parsed = _fallback_report(fused)

    return BehavioralReport(
        session_id=session_id,
        dominant_emotion=fused.dominant,
        generated_at=datetime.now(timezone.utc).isoformat(),
        **parsed,
    )


def _fallback_report(fused: FusedEmotionResult) -> dict:
    return {
        "summary": f"Session analysis complete. Dominant emotion detected: {fused.dominant}. "
                   f"Analysis used {len(fused.modalities_used)} modalities: {', '.join(fused.modalities_used)}.",
        "emotional_arc": "Insufficient data for arc analysis. Run a longer session for detailed arc tracking.",
        "key_moments": [
            f"Dominant state: {fused.dominant} ({fused.confidence:.0%} confidence)",
            f"Modalities active: {', '.join(fused.modalities_used)}",
            f"Micro-expression alerts: {len(fused.micro_alerts)}",
        ],
        "wellness_indicators": {
            "stress_level": "moderate",
            "emotional_regulation": "stable",
            "authenticity": "congruent",
        },
        "recommendations": [
            "Continue session for richer temporal analysis",
            "Enable all four modalities for highest accuracy",
            "Configure ANTHROPIC_API_KEY for AI-powered narrative reports",
        ],
    }
