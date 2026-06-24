# MindTrace++ 🧠

**Multimodal Emotion & Behavioral Intelligence System**

MindTrace++ analyzes human emotions through four simultaneous modalities — facial expressions, speech, text, and micro-expressions — fusing them into unified behavioral intelligence with AI-generated reports.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)              :3000        │
│  Live dashboard · Webcam · Audio · Text · Reports          │
└────────────────────┬────────────────────────────────────────┘
                     │ REST + WebSocket
┌────────────────────▼────────────────────────────────────────┐
│  FastAPI Gateway                               :8000        │
│  Session mgmt · Fusion engine · Report gen                 │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
Redis    ml-facial   ml-speech  ml-text   ml-micro
:6379      :8001       :8002      :8003     :8004
Pub/Sub  DeepFace   Wav2Vec2  RoBERTa   OpenCV
         MediaPipe   Librosa  GoEmotions Opt.Flow
```

---

## Quick Start

### Prerequisites
- Docker Desktop with Compose v2
- 8GB RAM minimum (16GB recommended for all ML models)
- Webcam and microphone for live modalities

### 1. Clone and configure

```bash
git clone https://github.com/yourname/mindtrace-plus-plus.git
cd mindtrace-plus-plus
cp .env.example .env
```

Edit `.env` and add your `ANTHROPIC_API_KEY` (optional — enables AI reports).

### 2. Build and start

```bash
docker compose up --build
```

First run downloads ML model weights (~2–4 GB). Subsequent starts are fast.

### 3. Open the app

```
http://localhost:3000
```

---

## Services

| Service     | Port | Technology                          | Dataset             |
|-------------|------|-------------------------------------|---------------------|
| Frontend    | 3000 | React + Vite + Tailwind + Recharts  | —                   |
| API Gateway | 8000 | FastAPI + WebSocket + Redis         | —                   |
| ml-facial   | 8001 | DeepFace + MediaPipe + OpenCV       | FER2013 · AffectNet |
| ml-speech   | 8002 | Wav2Vec2 + Librosa                  | RAVDESS · CREMA-D   |
| ml-text     | 8003 | RoBERTa (GoEmotions fine-tune)      | GoEmotions          |
| ml-micro    | 8004 | OpenCV optical flow + FACS AUs      | CASME II · SAMM     |
| Redis       | 6379 | Pub/Sub + session cache             | —                   |

---

## Usage Flow

1. **Create a Session** — click "New Session" in the top bar
2. **Run Modalities** — use the sidebar tabs to analyze:
   - **Facial**: live webcam stream or image upload
   - **Speech**: browser mic recording or audio file
   - **Text**: type or paste any text
   - **Micro-Expression**: upload a video file
3. **Fuse** — go to Multimodal Fusion, choose a strategy, click Run
4. **Report** — generate an AI behavioral narrative
5. **Dashboard** — live timeline and modality overview

---

## Fusion Strategies

| Strategy  | How it works                                    | Best for                       |
|-----------|-------------------------------------------------|--------------------------------|
| `late`    | Confidence-weighted voting across modalities    | Mixed/missing modalities       |
| `early`   | Feature averaging before classification         | All modalities present         |
| `attention` | Cross-modal transformer (placeholder)         | Large datasets, GPU training   |

---

## API Reference

Full OpenAPI docs: `http://localhost:8000/docs`

```
POST /facial/analyze          Upload image → facial emotion
POST /facial/stream-frame     Webcam frame → publish to WS
POST /speech/analyze          Upload audio → speech emotion
POST /text/analyze            JSON text → sentiment + emotion
POST /micro/analyze           Upload video → micro-expression events
POST /fusion/analyze          Fuse session modalities
POST /fusion/report/{id}      Generate AI behavioral report
GET  /fusion/report/{id}      Retrieve report
POST /session/create          Create analysis session
GET  /session/                List sessions
WS   /ws/session/{id}         Real-time emotion stream
```

---

## Development

### Run services individually

```bash
# Backend only
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend only
cd frontend && npm install && npm run dev

# Redis
docker run -p 6379:6379 redis:7-alpine
```

### Disable GPU (CPU-only)

Remove the `deploy.resources.reservations` block from the `ml-facial` service in `docker-compose.yml`.

---

## Extending MindTrace++

### Add a real trained model (e.g. RAVDESS CNN)

Replace the HuggingFace pipeline in `services/ml-speech/main.py` with your model:

```python
import torch
model = torch.load("your_ravdess_model.pt")
model.eval()
```

### Add CASME II trained weights for micro-expressions

In `services/ml-micro/main.py`, replace the heuristic AU detector with a real CNN:

```python
model = torch.load("casme2_cnn.pt")
# Feed apex frame ROIs through the model
```

---

## Roadmap

- [ ] Trained RAVDESS + CREMA-D speech model
- [ ] Fine-tuned micro-expression CNN (CASME II + SAMM)
- [ ] Real attention-based fusion (cross-modal transformer)
- [ ] PDF report export
- [ ] Session comparison view
- [ ] Multi-face tracking
- [ ] WebRTC for ultra-low latency streaming

---

## Tech Stack

Python · FastAPI · Redis · OpenCV · MediaPipe · DeepFace · PyTorch · HuggingFace Transformers · Librosa · React · Vite · Tailwind CSS · Recharts · Zustand · Docker Compose
