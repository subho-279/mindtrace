import io
import os
import tempfile
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image

app = FastAPI(title="MindTrace++ Micro-Expression Service")

# Action Unit → suppressed emotion mapping (FACS-based)
AU_EMOTION_MAP = {
    frozenset(["AU1", "AU4"]): "sad",
    frozenset(["AU2", "AU5", "AU26"]): "surprise",
    frozenset(["AU6", "AU12"]): "happy",
    frozenset(["AU4", "AU7", "AU23"]): "angry",
    frozenset(["AU1", "AU2", "AU5", "AU26"]): "fear",
    frozenset(["AU9", "AU15", "AU16"]): "disgust",
    frozenset(["AU12", "AU14"]): "contempt",
}

def detect_action_units(flow_magnitude: np.ndarray, regions: dict) -> list[str]:
    """Heuristic AU detection from optical flow magnitude in facial regions."""
    aus = []
    thresholds = {
        "AU1": (regions.get("inner_brow", 0), 0.5),
        "AU2": (regions.get("outer_brow", 0), 0.5),
        "AU4": (regions.get("brow_lowerer", 0), 0.6),
        "AU5": (regions.get("upper_lid", 0), 0.7),
        "AU6": (regions.get("cheek", 0), 0.4),
        "AU7": (regions.get("lid_tightener", 0), 0.5),
        "AU9": (regions.get("nose_wrinkle", 0), 0.6),
        "AU12": (regions.get("lip_corner_pull", 0), 0.5),
        "AU14": (regions.get("dimpler", 0), 0.4),
        "AU15": (regions.get("lip_corner_dep", 0), 0.5),
        "AU16": (regions.get("lower_lip_dep", 0), 0.4),
        "AU23": (regions.get("lip_tightener", 0), 0.5),
        "AU26": (regions.get("jaw_drop", 0), 0.6),
    }
    for au, (val, thresh) in thresholds.items():
        if val > thresh:
            aus.append(au)
    return aus


def extract_face_regions(frame: np.ndarray) -> dict[str, float]:
    """Extract region-level flow magnitudes using a simple grid over face bbox."""
    h, w = frame.shape[:2]
    regions = {
        "inner_brow": float(np.mean(frame[int(h*0.1):int(h*0.25), int(w*0.35):int(w*0.65)])),
        "outer_brow": float(np.mean(frame[int(h*0.1):int(h*0.25), :])),
        "brow_lowerer": float(np.mean(frame[int(h*0.2):int(h*0.35), int(w*0.2):int(w*0.8)])),
        "upper_lid": float(np.mean(frame[int(h*0.3):int(h*0.45), int(w*0.15):int(w*0.85)])),
        "cheek": float(np.mean(frame[int(h*0.45):int(h*0.65), :])),
        "lid_tightener": float(np.mean(frame[int(h*0.35):int(h*0.5), int(w*0.2):int(w*0.8)])),
        "nose_wrinkle": float(np.mean(frame[int(h*0.4):int(h*0.55), int(w*0.3):int(w*0.7)])),
        "lip_corner_pull": float(np.mean(frame[int(h*0.6):int(h*0.75), :])),
        "dimpler": float(np.mean(frame[int(h*0.65):int(h*0.78), int(w*0.25):int(w*0.75)])),
        "lip_corner_dep": float(np.mean(frame[int(h*0.7):int(h*0.82), :])),
        "lower_lip_dep": float(np.mean(frame[int(h*0.75):int(h*0.9), int(w*0.3):int(w*0.7)])),
        "lip_tightener": float(np.mean(frame[int(h*0.6):int(h*0.8), int(w*0.3):int(w*0.7)])),
        "jaw_drop": float(np.mean(frame[int(h*0.8):, :])),
    }
    # Normalize
    max_val = max(regions.values()) or 1.0
    return {k: v / max_val for k, v in regions.items()}


def map_aus_to_emotion(aus: list[str]) -> tuple[str, float]:
    if not aus:
        return "neutral", 0.0
    aus_set = frozenset(aus)
    best_match = "neutral"
    best_score = 0.0
    for au_combo, emotion in AU_EMOTION_MAP.items():
        overlap = len(aus_set & au_combo) / len(au_combo)
        if overlap > best_score:
            best_score = overlap
            best_match = emotion
    return best_match, round(best_score, 4)


def detect_micro_expressions(frames: list[np.ndarray], fps: float) -> list[dict]:
    """
    Detect micro-expressions using dense optical flow between consecutive frames.
    Micro-expressions: 1/25 – 1/5 second (40ms – 200ms at typical fps).
    """
    events = []
    if len(frames) < 2:
        return events

    min_frames = max(1, int(fps * 0.04))   # ~40ms
    max_frames = max(2, int(fps * 0.5))    # ~500ms

    # Convert to grayscale
    gray_frames = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]

    # Background flow (used to detect "unexpected" spikes)
    flow_magnitudes = []
    for i in range(len(gray_frames) - 1):
        flow = cv2.calcOpticalFlowFarneback(
            gray_frames[i], gray_frames[i + 1],
            None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        flow_magnitudes.append(float(np.mean(mag)))

    if not flow_magnitudes:
        return events

    mean_flow = np.mean(flow_magnitudes)
    std_flow  = np.std(flow_magnitudes)
    threshold = mean_flow + 2.0 * std_flow   # 2-sigma spike

    # Find onset frames (local maxima above threshold)
    i = 0
    while i < len(flow_magnitudes):
        if flow_magnitudes[i] > threshold:
            onset = i
            peak  = i
            peak_val = flow_magnitudes[i]

            # Find extent of this motion event
            j = i + 1
            while j < len(flow_magnitudes) and flow_magnitudes[j] > mean_flow:
                if flow_magnitudes[j] > peak_val:
                    peak_val = flow_magnitudes[j]
                    peak = j
                j += 1

            duration_frames = j - onset
            if min_frames <= duration_frames <= max_frames:
                # Analyze flow in apex frame
                apex_flow = cv2.calcOpticalFlowFarneback(
                    gray_frames[peak], gray_frames[min(peak + 1, len(gray_frames) - 1)],
                    None, 0.5, 3, 15, 3, 5, 1.2, 0
                )
                mag, _ = cv2.cartToPolar(apex_flow[..., 0], apex_flow[..., 1])
                regions = extract_face_regions(mag)
                aus = detect_action_units(mag, regions)
                emotion, confidence = map_aus_to_emotion(aus)

                if confidence > 0.2:
                    events.append({
                        "frame_id": peak,
                        "timestamp_ms": round((peak / fps) * 1000, 1),
                        "suppressed_emotion": emotion,
                        "confidence": confidence,
                        "duration_ms": round((duration_frames / fps) * 1000, 1),
                        "action_units": aus,
                    })
            i = j
        else:
            i += 1

    return events


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    fps: float = Form(default=30.0),
):
    #start = time.time()
    data = await file.read()

    suffix = os.path.splitext(file.filename or ".mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    frames = []
    try:
        cap = cv2.VideoCapture(tmp_path)
        detected_fps = cap.get(cv2.CAP_PROP_FPS)
        if detected_fps > 0:
            fps = detected_fps
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Video decode error: {e}")
    finally:
        os.unlink(tmp_path)

    if len(frames) < 2:
        return []

    events = detect_micro_expressions(frames, fps)
    result = [{"session_id": session_id, **e} for e in events]

    return result


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-micro"}
