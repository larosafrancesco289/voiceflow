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

## Requirements

- macOS with Apple Silicon (M1/M2/M3/M4)
- [Bun](https://bun.sh/) - `curl -fsSL https://bun.sh/install | bash`
- [uv](https://docs.astral.sh/uv/) - `curl -LsSf https://astral.sh/uv/install.sh | sh`
- [Rust](https://rustup.rs/) - `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## Installation

```bash
# Clone
git clone https://github.com/larosafrancesco289/voiceflow.git
cd voiceflow

# Install dependencies
bun install
cd python && uv sync && cd ..
```

## Running

```bash
./scripts/dev.sh
```

This starts both the Python transcription server and the Tauri app. The speech recognition model (~600MB) downloads automatically on first run.

Grant permissions when prompted:
- **Microphone**: Required for recording
- **Accessibility**: Required for auto-paste and global hotkey

### Quick Alias

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias voiceflow="cd ~/path/to/voiceflow && ./scripts/dev.sh"
```

## Usage

Hold **Option (⌥) + Space** to record. Release to transcribe and paste.

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
