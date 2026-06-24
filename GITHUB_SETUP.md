# GitHub Setup Guide for MindTrace++

## 1. Create GitHub Repository

```bash
# On your machine (after extracting the archive):
cd mindtrace-plus-plus

git init
git add .
git commit -m "feat: initial MindTrace++ multimodal emotion system"

# Create repo on GitHub (requires gh CLI):
gh repo create mindtrace-plus-plus --public --source=. --remote=origin --push

# OR manually: create repo at github.com, then:
# git remote add origin https://github.com/YOUR_USERNAME/mindtrace-plus-plus.git
# git push -u origin main
```

---

## 2. Configure Repository Secrets

Go to **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

### Required for CI/CD:

| Secret | Description | Example |
|--------|-------------|---------|
| `ANTHROPIC_API_KEY` | Enables AI behavioral reports | `sk-ant-api03-...` |
| `SECRET_KEY` | FastAPI JWT secret | Any long random string |

### Required for auto-deploy (optional):

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username (e.g. `ubuntu`) |
| `DEPLOY_SSH_KEY` | Full private SSH key (-----BEGIN...) |
| `DEPLOY_PORT` | SSH port (default: `22`) |
| `DEPLOY_PATH` | Path on server (e.g. `/opt/mindtrace`) |

---

## 3. CI/CD Pipeline

After every `git push origin main`:

```
Push → CI (lint + test + build images) → CD (deploy to server)
```

**CI stages** (`.github/workflows/ci.yml`):
1. `lint-python` — ruff + AST syntax check on all Python files
2. `lint-frontend` — `npm run build` (type + bundle validation)
3. `test-backend` — 11 pytest tests with mocked Redis & ML services
4. `test-ml-services` — boots ml-text and ml-micro, hits `/health`
5. `build-images` — builds all 6 Docker images, pushes to GHCR

**CD stage** (`.github/workflows/cd.yml`):
- Triggers only after CI passes on `main`
- SSH into server, `git pull`, inject `.env` from secrets, `docker compose up -d`

---

## 4. Deploy on a Fresh Server

### Prerequisites
```bash
# On your Ubuntu 22.04+ server:
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
newgrp docker
```

### First-time setup
```bash
git clone https://github.com/YOUR_USERNAME/mindtrace-plus-plus.git /opt/mindtrace
cd /opt/mindtrace
cp .env.example .env
nano .env  # fill in ANTHROPIC_API_KEY and SECRET_KEY
docker compose up -d --build
```

### After that, CD handles deployments automatically.

---

## 5. Local Development (without Docker)

```bash
# Install system deps (Ubuntu/Debian):
sudo apt install -y python3 python3-pip nodejs npm redis-server
redis-server --daemonize yes --port 6379

# Install Python deps:
pip3 install -r backend/requirements.txt
pip3 install -r services/ml-facial/requirements.txt
pip3 install -r services/ml-speech/requirements.txt
pip3 install -r services/ml-text/requirements.txt
pip3 install -r services/ml-micro/requirements.txt

# Install frontend:
cd frontend && npm install && cd ..

# Copy and fill .env:
cp .env.example .env

# Start everything:
chmod +x start.sh
./start.sh

# Check status:
./start.sh --status

# Tail a service log:
./start.sh --logs api

# Stop all:
./start.sh --stop
```

---

## 6. Container Registry (GHCR)

After CI builds images they're available at:

```
ghcr.io/YOUR_USERNAME/mindtrace-api:latest
ghcr.io/YOUR_USERNAME/mindtrace-ml-facial:latest
ghcr.io/YOUR_USERNAME/mindtrace-ml-speech:latest
ghcr.io/YOUR_USERNAME/mindtrace-ml-text:latest
ghcr.io/YOUR_USERNAME/mindtrace-ml-micro:latest
ghcr.io/YOUR_USERNAME/mindtrace-frontend:latest
```

Pull pre-built images on your server instead of building locally:
```bash
# Update docker-compose.yml image: fields to point to GHCR, then:
docker compose pull && docker compose up -d
```

---

## 7. Swap in Real ML Models

When HuggingFace Hub / GitHub Releases are accessible:

**Facial** (`services/ml-facial/main.py`):
```python
# Replace analyze_frame() with:
from deepface import DeepFace
result = DeepFace.analyze(img, actions=["emotion"], enforce_detection=False)
```

**Speech** (`services/ml-speech/main.py`):
```python
# Replace SVM with:
from transformers import pipeline
classifier = pipeline("audio-classification",
    model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
```

**Text** (`services/ml-text/main.py`):
```python
# Replace TF-IDF with:
from transformers import pipeline
classifier = pipeline("text-classification",
    model="SamLowe/roberta-base-go_emotions", top_k=None)
```

No other code changes needed — the API contracts stay identical.

---

## 8. Useful Commands

```bash
# View live logs
docker compose logs -f api
docker compose logs -f ml-facial

# Restart single service
docker compose restart ml-text

# Run tests locally
cd backend && pytest tests/ -v

# Rebuild after code changes
docker compose up -d --build ml-text

# Open a shell in a container
docker compose exec api bash
```
