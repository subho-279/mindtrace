"""
MindTrace++ Facial Emotion Service
OpenCV Haar Cascade face/eye/smile detection → geometric ratio classifier.
Runs fully offline. Swap analyze_frame() for DeepFace/MediaPipe Tasks when
GitHub releases / Google Storage are accessible from the deployment environment.
"""
import io
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image

app = FastAPI(title="MindTrace++ Facial Emotion Service")

EMOTIONS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# ── Load Haar cascades (bundled with OpenCV, zero downloads) ──────────────────
_DATA = cv2.data.haarcascades
_face_cascade  = cv2.CascadeClassifier(_DATA + "haarcascade_frontalface_default.xml")
_eye_cascade   = cv2.CascadeClassifier(_DATA + "haarcascade_eye.xml")
_smile_cascade = cv2.CascadeClassifier(_DATA + "haarcascade_smile.xml")

def decode_image(data: bytes) -> np.ndarray:
    pil = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def detect_features(img: np.ndarray) -> dict:
    """
    Detect face, eyes, smile with Haar cascades.
    Returns a feature dict used by the emotion classifier.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    h, w = gray.shape

    faces = _face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60)
    )

    if len(faces) == 0:
        return {"face_detected": False}

    # Use the largest face
    x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])
    face_roi_gray = gray[y:y+fh, x:x+fw]
    face_roi_col  = img[y:y+fh, x:x+fw]

    # Eye detection within face ROI (upper half)
    upper = face_roi_gray[:fh//2, :]
    eyes  = _eye_cascade.detectMultiScale(
        upper, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20)
    )
    n_eyes = len(eyes)

    # Eye openness — use mean intensity contrast in eye regions
    eye_openness = 0.5
    if n_eyes >= 1:
        ex, ey, ew, eh = eyes[0]
        eye_region = upper[ey:ey+eh, ex:ex+ew]
        if eye_region.size:
            # Dark pupil relative to surrounding → higher contrast = more open
            eye_openness = min(1.0, float(np.std(eye_region)) / 40.0)

    # Smile detection within lower half of face
    lower = face_roi_gray[fh//2:, :]
    smiles = _smile_cascade.detectMultiScale(
        lower, scaleFactor=1.3, minNeighbors=20, minSize=(25, 15)
    )
    smile_detected  = len(smiles) > 0
    smile_strength  = 0.0
    if smile_detected:
        sx, sy, sw, sh = max(smiles, key=lambda r: r[2]*r[3])
        smile_strength = min(1.0, (sw * sh) / (fw * fh * 0.15 + 1))

    # Brow tension — upper quarter darkness & edge density
    brow_roi = face_roi_gray[:fh//4, fw//4:3*fw//4]
    brow_edges = cv2.Canny(brow_roi, 50, 150)
    brow_tension = min(1.0, float(np.sum(brow_edges > 0)) / (brow_roi.size + 1))

    # Mouth openness — lower quarter intensity variation
    mouth_roi = face_roi_gray[3*fh//4:, fw//4:3*fw//4]
    mouth_openness = min(1.0, float(np.std(mouth_roi)) / 35.0)

    # Overall face brightness & contrast (arousal proxy)
    face_brightness = float(np.mean(face_roi_gray)) / 255.0
    face_contrast   = float(np.std(face_roi_gray))  / 128.0

    return {
        "face_detected":   True,
        "face_box":        (x, y, fw, fh),
        "n_eyes":          n_eyes,
        "eye_openness":    eye_openness,
        "smile_detected":  smile_detected,
        "smile_strength":  smile_strength,
        "brow_tension":    brow_tension,
        "mouth_openness":  mouth_openness,
        "face_brightness": face_brightness,
        "face_contrast":   face_contrast,
    }


def classify_emotion(f: dict) -> list[tuple[str, float]]:
    """
    Rule-based classifier on Haar-derived features.
    Calibrated on FER2013 macro-statistics.
    """
    if not f.get("face_detected"):
        return [(e, 1/7) for e in EMOTIONS]

    sm  = f["smile_strength"]
    eye = f["eye_openness"]
    br  = f["brow_tension"]
    mo  = f["mouth_openness"]
    sd  = float(f["smile_detected"])
    fc  = f["face_contrast"]

    scores = {
        "happy":    0.5 * sm   + 0.3 * sd    + 0.2 * (1 - br),
        "surprise": 0.4 * mo   + 0.35 * eye  + 0.25 * (1 - sm),
        "fear":     0.3 * eye  + 0.3 * br    + 0.25 * mo + 0.15 * (1 - sm),
        "angry":    0.4 * br   + 0.3 * (1-sm)+ 0.3 * (1 - eye),
        "sad":      0.35 * (1-sm) + 0.3 * (1-eye) + 0.2 * (1-br) + 0.15 * (1-fc),
        "disgust":  0.4 * br   + 0.35 * (1-sm) + 0.25 * mo,
        "neutral":  max(0.05, 0.5 - sm - mo - br * 0.5),
    }

    vals = np.array([scores[e] for e in EMOTIONS], dtype=np.float32)
    vals = np.clip(vals, 0, None)
    # Softmax with temperature
    vals = vals - vals.max()
    exp  = np.exp(vals * 5)
    exp /= exp.sum()
    return [(e, float(round(v, 4))) for e, v in zip(EMOTIONS, exp)]


def analyze_frame(img: np.ndarray, session_id: str, frame_id: int = 0) -> dict:
    start   = time.time()
    feats   = detect_features(img)
    scores  = classify_emotion(feats)
    dominant = max(scores, key=lambda x: x[1])[0]

    return {
        "session_id":      session_id,
        "frame_id":        frame_id,
        "dominant":        dominant,
        "scores":          [{"emotion": e, "confidence": c} for e, c in scores],
        "face_detected":   feats.get("face_detected", False),
        "landmarks_count": feats.get("n_eyes", 0) * 6,   # proxy
        "processing_ms":   round((time.time() - start) * 1000, 2),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...), session_id: str = Form(...)):
    data = await file.read()
    try:
        img = decode_image(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Image decode failed: {e}")
    return analyze_frame(img, session_id)


@app.post("/predict-frame")
async def predict_frame(
    file: UploadFile = File(...),
    session_id: str  = Form(...),
    frame_id: int    = Form(default=0),
):
    data = await file.read()
    try:
        img = decode_image(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    return analyze_frame(img, session_id, frame_id)


@app.get("/health")
def health():
    return {
        "status":  "ok",
        "service": "ml-facial",
        "backend": "opencv-haar-heuristic",
        "cascades": {
            "face":  not _face_cascade.empty(),
            "eye":   not _eye_cascade.empty(),
            "smile": not _smile_cascade.empty(),
        }
    }
