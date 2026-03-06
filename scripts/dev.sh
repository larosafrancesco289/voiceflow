#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_DIR="$PROJECT_ROOT/python"
DESKTOP_DIR="$PROJECT_ROOT/apps/desktop"
SERVER_HEALTH_URL="http://127.0.0.1:8765/health"
PYTHON_PID=""

echo "🎙️ Starting VoiceFlow..."

cleanup() {
    if [[ -n "${PYTHON_PID}" ]] && kill -0 "${PYTHON_PID}" >/dev/null 2>&1; then
        echo ""
        echo "🛑 Stopping Python server (PID: ${PYTHON_PID})..."
        kill "${PYTHON_PID}" >/dev/null 2>&1 || true
        wait "${PYTHON_PID}" >/dev/null 2>&1 || true
    fi
}

wait_for_server() {
    local attempts=30

    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if curl --silent --fail "${SERVER_HEALTH_URL}" >/dev/null 2>&1; then
            return 0
        fi

        sleep 1
    done

    return 1
}

trap cleanup EXIT

# Start Python server in background
echo "📦 Starting Python server..."
cd "$PYTHON_DIR"
uv sync --quiet
uv run python -m voiceflow_server.server &
PYTHON_PID=$!

# Wait for server readiness
echo "⏳ Waiting for Python server to become healthy..."
if ! wait_for_server; then
    echo "❌ Python server did not become healthy in time."
    exit 1
fi

echo "✓ Python server running (PID: $PYTHON_PID)"

# Start Tauri app
echo "🚀 Starting Tauri app..."
cd "$DESKTOP_DIR"
bun run tauri dev
