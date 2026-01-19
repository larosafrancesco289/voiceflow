# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceFlow is a local speech-to-text desktop application for macOS (Apple Silicon). Monorepo combining a Tauri desktop client (React + Rust) with a Python FastAPI server for offline voice transcription using parakeet-mlx.

## Build & Run Commands

**Development (both servers):**
```bash
./scripts/dev.sh  # Starts Python server + Tauri dev
```

**Individual services:**
```bash
# From root
bun run dev        # Full Tauri dev (includes frontend)
bun run desktop    # Frontend only (Vite on localhost:1420)

# Python server directly
cd python && uv run python -m voiceflow_server.server
```

**Build:**
```bash
bun run build  # Production Tauri build → apps/desktop/src-tauri/target/release/bundle/
```

## Architecture

```
voiceflow/
├── apps/desktop/           # Tauri desktop app
│   ├── src/                # React frontend (TypeScript)
│   │   ├── hooks/          # useTranscription, useWebSocket, useAudioCapture
│   │   └── stores/         # Zustand state (appStore.ts)
│   └── src-tauri/          # Rust backend
│       └── src/lib.rs      # Tauri commands, global shortcuts, tray
├── python/                 # FastAPI server
│   └── src/voiceflow_server/server.py  # WebSocket transcription endpoint
└── scripts/dev.sh          # Dev launcher
```

## Data Flow

1. Hold **Alt+Space** (global shortcut) to start recording
2. `useAudioCapture` captures microphone → 16kHz mono 16-bit PCM chunks
3. WebSocket sends binary audio chunks to Python server (`/ws`)
4. On key release, sends `{"type": "end"}` → server runs `parakeet-mlx` transcription
5. Server returns `{"type": "final", "text": "..."}` → optional auto-paste via Tauri

## WebSocket Protocol

- Client connects to `ws://127.0.0.1:8765/ws`
- Server sends `{"type": "ready"}` when model is loaded
- Client sends `{"type": "start"}` to begin recording session
- Client streams raw PCM audio as binary messages
- Client sends `{"type": "end"}` to trigger transcription
- Server responds with `{"type": "final", "text": "..."}` or `{"type": "error", "error": "..."}`

## Key Files

- **State management**: `apps/desktop/src/stores/appStore.ts` (Zustand, persisted to localStorage)
- **Transcription orchestration**: `apps/desktop/src/hooks/useTranscription.ts`
- **Tauri commands**: `apps/desktop/src-tauri/src/lib.rs` (show_bubble, hide_bubble, paste_from_clipboard)
- **Python server**: `python/src/voiceflow_server/server.py`

## Notes

- Requires macOS with Apple Silicon (M1/M2/M3) for parakeet-mlx
- The parakeet-mlx model (~600MB) auto-downloads to `~/.cache/huggingface/hub/` on first run
- WebSocket server: `ws://127.0.0.1:8765`, Vite dev server: `http://localhost:1420`
- Recording state machine: `idle` → `recording` → `processing` → `complete` → `idle`

## Testing as New User

To clear all app data and test fresh install experience:
```bash
# Clear model cache (~600MB, will re-download)
rm -rf ~/.cache/huggingface/hub/models--mlx-community--parakeet-tdt-0.6b-v3

# Clear app state (localStorage with onboarding, settings)
rm -rf ~/Library/WebKit/voiceflow ~/Library/Caches/voiceflow

# Clear app config
rm -rf ~/Library/Application\ Support/com.voiceflow.app
```

## macOS Fullscreen Overlay

The overlay bubble uses `tauri-nspanel` to appear over fullscreen apps (required since macOS Big Sur):
- `FloatingBubblePanel` defined in `lib.rs` - NSPanel that doesn't steal focus
- Window level 25 (above NSMainMenuWindowLevel)
- Collection behavior: `CanJoinAllSpaces`, `Stationary`, `FullScreenAuxiliary`

## Known Issues

**Bundled sidecar not working**: The Python server bundled as sidecar (`voiceflow-server`) has issues in production builds. Currently only works in dev mode with `./scripts/dev.sh`.

**Orphaned server process**: If app crashes or is force-quit, the Python server may keep running on port 8765. The app now attempts to kill orphaned processes on startup, but if issues persist:
```bash
lsof -ti:8765 | xargs kill -9
```

**Mic initialization delay**: ~500ms delay when starting recording (mic initializes fresh each time for privacy - no always-on mic).
