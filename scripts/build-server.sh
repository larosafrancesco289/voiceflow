#!/bin/bash
# Build the Python server as a standalone binary using PyInstaller

set -e

cd "$(dirname "$0")/../python"

echo "Building VoiceFlow server binary..."

# Install dependencies including pyinstaller
uv sync --dev

# Build with PyInstaller
uv run python -m PyInstaller voiceflow-server.spec --clean --noconfirm

# Get the target triple for Tauri sidecar naming
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64-apple-darwin"
elif [ "$ARCH" = "x86_64" ]; then
    TARGET="x86_64-apple-darwin"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# Create binaries directory in src-tauri if it doesn't exist
BINARIES_DIR="../apps/desktop/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# Copy and rename binary with target triple (required by Tauri sidecar)
cp dist/voiceflow-server "$BINARIES_DIR/voiceflow-server-$TARGET"

echo "Server binary built: $BINARIES_DIR/voiceflow-server-$TARGET"
