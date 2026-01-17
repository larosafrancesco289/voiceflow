# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceFlow is a local speech-to-text desktop application. Monorepo combining a Tauri desktop client (React + Rust) with a Python FastAPI server for offline voice transcription using parakeet-mlx.

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
bun run python     # Python server only (ws://127.0.0.1:8765)

# Or directly
cd apps/desktop && bun run tauri dev
cd python && uv run python -m voiceflow_server.server
```

**Build:**
```bash
bun run build  # Production Tauri build
```

## Architecture

```
voiceflow/
├── apps/desktop/           # Tauri desktop app
│   ├── src/                # React frontend (TypeScript)
│   │   ├── components/     # UI components (PulsingOrb, AudioWaveform, Settings)
│   │   ├── hooks/          # useTranscription, useWebSocket, useAudioCapture
│   │   └── stores/         # Zustand state (appStore.ts)
│   └── src-tauri/          # Rust backend
│       └── src/lib.rs      # Tauri commands, global shortcuts, tray
├── python/                 # FastAPI server
│   └── src/voiceflow_server/server.py  # WebSocket transcription endpoint
└── scripts/dev.sh          # Dev launcher
```

## Data Flow

1. Global shortcut (Cmd+Shift+Space) or UI triggers recording
2. `useAudioCapture` captures microphone → 16kHz mono PCM chunks
3. WebSocket sends chunks to Python server (`/ws`)
4. `parakeet-mlx` transcribes, returns partial/final results
5. Optional auto-paste to active application via Tauri clipboard

## Key Files

- **Frontend entry**: `apps/desktop/src/main.tsx`
- **State management**: `apps/desktop/src/stores/appStore.ts` (Zustand, persisted to localStorage)
- **Transcription orchestration**: `apps/desktop/src/hooks/useTranscription.ts`
- **Tauri commands**: `apps/desktop/src-tauri/src/lib.rs`
- **Python server**: `python/src/voiceflow_server/server.py`

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand
- **Desktop**: Tauri 2 (Rust)
- **Backend**: Python 3.10+, FastAPI, parakeet-mlx
- **Package managers**: Bun (JS), uv (Python), Cargo (Rust)

## Notes

- The parakeet-mlx model (~600MB) auto-downloads to `~/.cache/huggingface/hub/` on first run
- WebSocket server runs on `ws://127.0.0.1:8765`
- Vite dev server runs on `http://localhost:1420`
