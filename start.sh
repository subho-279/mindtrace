#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  MindTrace++ — Native Local Startup Script
#  Starts all services without Docker: Redis + 4 ML services + API + Frontend
#
#  Usage:
#    chmod +x start.sh
#    ./start.sh              # start all services
#    ./start.sh --stop       # stop all services
#    ./start.sh --status     # show running services
#    ./start.sh --logs api   # tail logs for a service
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.logs"
PIDS="$ROOT/.pids"

mkdir -p "$LOGS" "$PIDS"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Load .env if present ──────────────────────────────────────────────────────
if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
    info "Loaded .env"
fi

export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export ML_FACIAL_URL="${ML_FACIAL_URL:-http://localhost:8001}"
export ML_SPEECH_URL="${ML_SPEECH_URL:-http://localhost:8002}"
export ML_TEXT_URL="${ML_TEXT_URL:-http://localhost:8003}"
export ML_MICRO_URL="${ML_MICRO_URL:-http://localhost:8004}"
export SECRET_KEY="${SECRET_KEY:-mindtrace-dev-secret}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export TF_CPP_MIN_LOG_LEVEL=3
export TF_ENABLE_ONEDNN_OPTS=0
export PYTHONPATH="$ROOT/backend"

# ── Helpers ───────────────────────────────────────────────────────────────────
save_pid() { echo "$2" > "$PIDS/$1.pid"; }
get_pid()  { [[ -f "$PIDS/$1.pid" ]] && cat "$PIDS/$1.pid" || echo ""; }

is_running() {
    local pid; pid=$(get_pid "$1")
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

wait_for_port() {
    local name=$1 port=$2 retries=${3:-30}
    for i in $(seq 1 "$retries"); do
        if python3 -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('127.0.0.1',$port)); s.close()" 2>/dev/null; then
            success "$name  →  http://localhost:$port"
            return 0
        fi
        sleep 0.5
    done
    error "$name failed to start on port $port (check .logs/$name.log)"
    return 1
}

start_service() {
    local name=$1 port=$2 cmd=$3 workdir=$4
    if is_running "$name"; then
        warn "$name already running (pid $(get_pid "$name"))"
        return
    fi
    info "Starting $name…"
    pushd "$workdir" > /dev/null
    # shellcheck disable=SC2086
    eval "$cmd" >> "$LOGS/$name.log" 2>&1 &
    save_pid "$name" $!
    popd > /dev/null
    wait_for_port "$name" "$port"
}

# ── Stop ──────────────────────────────────────────────────────────────────────
stop_all() {
    header "Stopping MindTrace++ services…"
    for svc in frontend api ml-facial ml-speech ml-text ml-micro redis; do
        local pid; pid=$(get_pid "$svc")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null && success "Stopped $svc (pid $pid)" || warn "Could not stop $svc"
        fi
        rm -f "$PIDS/$svc.pid"
    done
    # Also kill redis if we started it
    pkill -f "redis-server.*6379" 2>/dev/null || true
    success "All services stopped"
}

# ── Status ────────────────────────────────────────────────────────────────────
show_status() {
    header "MindTrace++ Service Status"
    printf "%-14s %-8s %-6s %s\n" "SERVICE" "STATUS" "PID" "PORT"
    printf "%-14s %-8s %-6s %s\n" "-------" "------" "---" "----"
    declare -A PORTS=(
        [redis]=6379 [ml-facial]=8001 [ml-speech]=8002
        [ml-text]=8003 [ml-micro]=8004 [api]=8000 [frontend]=3000
    )
    for svc in redis ml-facial ml-speech ml-text ml-micro api frontend; do
        local pid port status
        pid=$(get_pid "$svc")
        port="${PORTS[$svc]}"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            status="${GREEN}RUNNING${RESET}"
        else
            status="${RED}STOPPED${RESET}"
            pid="-"
        fi
        printf "%-14s ${status}%-0s %-6s :%s\n" "$svc" "" "$pid" "$port"
    done
}

# ── Logs ──────────────────────────────────────────────────────────────────────
tail_logs() {
    local svc=$1
    [[ -f "$LOGS/$svc.log" ]] || { error "No log for $svc"; exit 1; }
    tail -f "$LOGS/$svc.log"
}

# ── Preflight checks ──────────────────────────────────────────────────────────
preflight() {
    header "Preflight checks"
    local ok=true

    command -v python3 &>/dev/null && success "python3 $(python3 --version 2>&1 | cut -d' ' -f2)" || { error "python3 not found"; ok=false; }
    command -v uvicorn &>/dev/null && success "uvicorn $(uvicorn --version 2>&1)" \
        || python3 -m uvicorn --version &>/dev/null && success "uvicorn (via python -m)" \
        || { error "uvicorn not found — pip install uvicorn[standard]"; ok=false; }
    command -v node &>/dev/null && success "node $(node --version)" || { error "node not found"; ok=false; }
    command -v npm  &>/dev/null && success "npm $(npm --version)"  || { error "npm not found";  ok=false; }

    for pkg in fastapi redis httpx mediapipe librosa sklearn cv2; do
        python3 -c "import $pkg" 2>/dev/null \
            && success "python: $pkg" \
            || { error "python: $pkg missing — check requirements"; ok=false; }
    done

    [[ -d "$ROOT/frontend/node_modules" ]] && success "node_modules present" \
        || { warn "node_modules missing — running npm install…"
             cd "$ROOT/frontend" && npm install --silent; }

    $ok || { error "Preflight failed — fix the above then retry"; exit 1; }
    echo ""
}

# ── Main start ────────────────────────────────────────────────────────────────
start_all() {
    header "🧠  MindTrace++ Local Startup"
    echo "    All logs → $LOGS/"
    echo ""

    preflight

    # Clear old logs
    rm -f "$LOGS"/*.log

    # 1. Redis ─────────────────────────────────────────────────────────────────
    if python3 -c "import redis; r=redis.Redis(); r.ping()" 2>/dev/null; then
        success "redis already running on :6379"
    else
        info "Starting Redis…"
        redis-server --daemonize yes --port 6379 \
            --logfile "$LOGS/redis.log" --loglevel notice
        sleep 1
        python3 -c "import redis; redis.Redis().ping()" \
            && success "redis  →  localhost:6379" \
            || { error "Redis failed to start"; exit 1; }
    fi
    save_pid "redis" "$(pgrep -f 'redis-server.*6379' | head -1)"

    # 2. ML Services ───────────────────────────────────────────────────────────
    UVICORN="python3 -m uvicorn main:app --host 0.0.0.0"

    start_service "ml-facial" 8001 \
        "$UVICORN --port 8001 --log-level warning" \
        "$ROOT/services/ml-facial"

    start_service "ml-speech" 8002 \
        "$UVICORN --port 8002 --log-level warning" \
        "$ROOT/services/ml-speech"

    start_service "ml-text" 8003 \
        "$UVICORN --port 8003 --log-level warning" \
        "$ROOT/services/ml-text"

    start_service "ml-micro" 8004 \
        "$UVICORN --port 8004 --log-level warning" \
        "$ROOT/services/ml-micro"

    # 3. API Gateway ───────────────────────────────────────────────────────────
    start_service "api" 8000 \
        "python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning" \
        "$ROOT/backend"

    # 4. React Frontend ────────────────────────────────────────────────────────
    start_service "frontend" 3000 \
        "npm run dev -- --host 0.0.0.0 --port 3000" \
        "$ROOT/frontend"

    # ── Summary ───────────────────────────────────────────────────────────────
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${GREEN}${BOLD}  MindTrace++ is running!${RESET}"
    echo ""
    echo -e "  ${BOLD}Frontend${RESET}    →  ${CYAN}http://localhost:3000${RESET}"
    echo -e "  ${BOLD}API${RESET}         →  ${CYAN}http://localhost:8000${RESET}"
    echo -e "  ${BOLD}API Docs${RESET}    →  ${CYAN}http://localhost:8000/docs${RESET}"
    echo -e "  ${BOLD}WebSocket${RESET}   →  ${CYAN}ws://localhost:8000/ws/session/{id}${RESET}"
    echo ""
    echo -e "  ML Services:"
    echo -e "  Facial :8001  Speech :8002  Text :8003  Micro :8004"
    echo ""
    echo -e "  Logs:  ${YELLOW}./start.sh --logs <service>${RESET}"
    echo -e "  Stop:  ${YELLOW}./start.sh --stop${RESET}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

# ── Entry point ───────────────────────────────────────────────────────────────
case "${1:-}" in
    --stop)   stop_all   ;;
    --status) show_status ;;
    --logs)   tail_logs "${2:-api}" ;;
    "")       start_all  ;;
    *)        echo "Usage: $0 [--stop | --status | --logs <service>]"; exit 1 ;;
esac
