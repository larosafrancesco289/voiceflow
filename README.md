# VoiceFlow

Local speech-to-text desktop application for macOS. Records audio via a global hotkey, transcribes it offline using parakeet-mlx, and optionally pastes the result into your active application.

## Features

- Global shortcut (Cmd+Shift+Space) to start/stop recording
- Offline transcription using parakeet-mlx (no data leaves your machine)
- Auto-paste transcribed text to the active application
- Minimal UI that stays out of your way

## Requirements

- macOS with Apple Silicon (M1/M2/M3)
- Python 3.10+
- Bun
- Rust (for Tauri)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/voiceflow.git
cd voiceflow

# Install JS dependencies
bun install

# Install Python dependencies
cd python
uv sync
cd ..
```

The parakeet-mlx model (~600MB) downloads automatically on first run.

## Usage

Start both the transcription server and desktop app:

```bash
./scripts/dev.sh
```

Or run them separately:

```bash
# Terminal 1: Python server
cd python && uv run python -m voiceflow_server.server

# Terminal 2: Tauri app
bun run dev
```

Once running, press **Cmd+Shift+Space** to start recording. Press again (or release if using hold-to-record) to stop and transcribe.

## Project Structure

```
voiceflow/
├── apps/desktop/           # Tauri desktop app
│   ├── src/                # React frontend
│   └── src-tauri/          # Rust backend
├── python/                 # Transcription server
│   └── src/voiceflow_server/
└── scripts/
    └── dev.sh              # Development launcher
```

## Building

Create a production build:

```bash
bun run build
```

The built application will be in `apps/desktop/src-tauri/target/release/bundle/`.

## Tech Stack

- **Desktop**: Tauri 2, React, TypeScript, Tailwind CSS
- **Transcription**: Python, FastAPI, parakeet-mlx
- **State**: Zustand

## License

MIT
