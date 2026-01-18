# VoiceFlow

Local, offline speech-to-text for macOS. Hold a hotkey, speak, release.

## Features

- **100% Offline**: All transcription happens on your Mac. No data leaves your machine.
- **25 Languages**: Automatic language detection across European languages.
- **Fast**: Optimized for Apple Silicon with MLX acceleration.
- **Private**: No accounts, no cloud, no telemetry.
- **Auto-Paste**: Transcribed text is automatically pasted into your active application.

## Supported Languages

| | | | | |
|---|---|---|---|---|
| Bulgarian | Croatian | Czech | Danish | Dutch |
| English | Estonian | Finnish | French | German |
| Greek | Hungarian | Italian | Latvian | Lithuanian |
| Maltese | Polish | Portuguese | Romanian | Russian |
| Slovak | Slovenian | Spanish | Swedish | Ukrainian |

Language is detected automatically.

## Download & Install

### From GitHub Releases

1. Download the latest `.dmg` from [Releases](https://github.com/larosafrancesco289/voiceflow/releases)
2. Open the DMG and drag VoiceFlow to Applications
3. **First launch** (unsigned app):
   - Right-click VoiceFlow.app, then click **Open**
   - Click **Open** in the security dialog
4. Grant permissions when prompted:
   - **Microphone**: Required for recording
   - **Accessibility**: Required for auto-paste and global hotkey

The speech recognition model (~600MB) downloads automatically on first run.

## Usage

Hold **Option (⌥) + Space** to record. Release to transcribe and paste.

## Building from Source

Requires macOS with Apple Silicon (M1/M2/M3).

```bash
# Clone
git clone https://github.com/larosafrancesco289/voiceflow.git
cd voiceflow

# Install dependencies
bun install
cd python && uv sync && cd ..

# Run in development
./scripts/dev.sh

# Build for production
bun run build
# Output: apps/desktop/src-tauri/target/release/bundle/
```

## Tech Stack

- **Desktop**: Tauri 2, React, TypeScript
- **Transcription**: Python, FastAPI, parakeet-mlx
- **ML Runtime**: Apple MLX

## Credits

- [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- [parakeet-mlx](https://github.com/senstella/parakeet-mlx)
- [Apple MLX](https://github.com/ml-explore/mlx)
- [Tauri](https://tauri.app/)
- [FastAPI](https://fastapi.tiangolo.com/)

## License

MIT
