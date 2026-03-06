# VoiceFlow

VoiceFlow is a local macOS dictation app: hold a hotkey, speak, release, and paste the transcription into the app you were already using.

## Value Proposition

- 100% local speech-to-text with no cloud dependency
- Fast Apple Silicon transcription through `parakeet-mlx`
- A tiny always-on bubble UI instead of a full editor workflow
- Automatic paste back into the active app

## Stack

- Desktop shell: Tauri 2 + Rust
- UI: React + TypeScript + Zustand
- Transcription server: FastAPI + WebSocket + `parakeet-mlx`
- Packaging: Python sidecar bundled into the Tauri app

## Repository Layout

```text
apps/desktop/             Tauri app, React UI, Rust shell
apps/desktop/src-tauri/   Tauri commands, tray, shortcut handling, sidecar lifecycle
python/                   FastAPI transcription server and Python tests
scripts/                  Dev, build, and end-to-end helpers
```

## Requirements

- macOS on Apple Silicon
- [Bun](https://bun.sh/)
- [uv](https://docs.astral.sh/uv/)
- [Rust](https://rustup.rs/)

## Quick Start

```bash
git clone https://github.com/larosafrancesco289/voiceflow.git
cd voiceflow
bun install
cd python && uv sync && cd ..
./scripts/dev.sh
```

First launch downloads the speech model on demand (about 600MB).

## Permissions

VoiceFlow needs:

- Microphone access for recording
- Accessibility access for the global shortcut and auto-paste

## Daily Commands

```bash
# Run the desktop app in development
./scripts/dev.sh

# Run the full automated test suite
bun run test

# Build the React frontend only
bun run build:desktop

# Build the packaged Python sidecar binary
bun run build:server

# Run build + tests together
bun run check
```

## Testing

```bash
# React and hook tests
bun run test:desktop

# FastAPI / websocket regression tests
bun run test:python

# Packaged shortcut end-to-end check
bun run test:e2e:shortcut
```

The shortcut E2E test launches the packaged app, synthesizes `Option + Space`, and verifies the runtime event log in `.e2e/shortcut-events.log`.

## Hotkey Support

The shortcut picker currently supports:

- Letters `A-Z`
- Numbers `0-9`
- `Space`
- `F1-F12`

All shortcuts must include at least one modifier key.

## Troubleshooting

- If the Rust/Tauri build fails with an Xcode toolchain error, make sure Xcode Command Line Tools are installed and the Xcode license has been accepted.
- If auto-paste or the global shortcut does not work, re-check Accessibility permissions for the app or terminal running it.
- If the first model download fails, use the in-app retry action instead of restarting the whole app.

## Credits

- [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- [parakeet-mlx](https://github.com/senstella/parakeet-mlx)
- [Apple MLX](https://github.com/ml-explore/mlx)
- [Tauri](https://tauri.app/)
- [FastAPI](https://fastapi.tiangolo.com/)

## License

MIT
