#!/bin/bash

# VoiceFlow Development Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🎙️ Starting VoiceFlow..."

cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    pkill -f "voiceflow_server" 2>/dev/null || true
    pkill -f "uvicorn" 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Python server in background
echo "📦 Starting Python server..."
cd "$PROJECT_ROOT/python"
uv sync --quiet
uv run python -m voiceflow_server.server &
PYTHON_PID=$!

# Wait for server
sleep 3
echo "✓ Python server running (PID: $PYTHON_PID)"

# Start Tauri app
echo "🚀 Starting Tauri app..."
cd "$PROJECT_ROOT/apps/desktop"
bun run tauri dev

# This will be reached when Tauri exits
cleanup
