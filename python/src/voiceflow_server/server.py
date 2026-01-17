"""WebSocket server for real-time speech-to-text transcription."""

import asyncio
import json
import logging
import signal
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("voiceflow")

# Global transcriber instance
transcriber: Optional["Transcriber"] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize transcriber on startup."""
    global transcriber
    transcriber = Transcriber()
    asyncio.create_task(transcriber.load_model())
    yield
    # Cleanup on shutdown (if needed)


app = FastAPI(title="VoiceFlow Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Transcriber:
    """Wrapper for parakeet-mlx transcription."""

    def __init__(self):
        self.model = None
        self._loading = False
        self._loaded = asyncio.Event()

    async def load_model(self):
        """Load the parakeet model asynchronously."""
        if self.model is not None:
            self._loaded.set()
            return

        if self._loading:
            await self._loaded.wait()
            return

        self._loading = True
        logger.info("Loading parakeet model...")

        try:
            # Import and load in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(None, self._load_model_sync)
            logger.info("Parakeet model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.model = None
        finally:
            self._loading = False
            self._loaded.set()

    def _warmup(self, model):
        """Run warmup inference to avoid cold start latency on first transcription.

        Creates 0.5s of silent audio and runs inference to warm up the model's
        computational graph. This prevents missing initial words on first use.
        """
        logger.info("Warming up model...")
        try:
            # Create 0.5 seconds of silent audio at 16kHz
            silent_audio = np.zeros(8000, dtype=np.float32)

            # Write to temp file and run inference
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_path = Path(f.name)

            try:
                sf.write(temp_path, silent_audio, 16000)
                _ = model.transcribe(temp_path)  # Discard result
            finally:
                temp_path.unlink(missing_ok=True)

            logger.info("Warmup complete - model ready for fast transcription")
        except Exception as e:
            logger.warning(f"Warmup failed (non-critical): {e}")

    def _load_model_sync(self):
        """Synchronous model loading.

        The model (mlx-community/parakeet-tdt-0.6b-v3, ~600MB) will be downloaded
        automatically from Hugging Face on first run and cached locally at:
        ~/.cache/huggingface/hub/
        """
        try:
            from parakeet_mlx import from_pretrained

            # Load the MLX-converted parakeet model from mlx-community
            # First run will download ~600MB from Hugging Face
            logger.info("Loading mlx-community/parakeet-tdt-0.6b-v3 (downloads ~600MB on first run)...")
            model = from_pretrained("mlx-community/parakeet-tdt-0.6b-v3")

            # Warmup the model to avoid cold start latency
            self._warmup(model)

            return model
        except ImportError:
            logger.warning("parakeet-mlx not available, using mock transcription")
            return None
        except Exception as e:
            logger.error(f"Error loading parakeet model: {e}")
            return None

    async def transcribe(self, audio_data: np.ndarray, sample_rate: int = 16000) -> str:
        """Transcribe audio data to text."""
        await self._loaded.wait()

        if self.model is None:
            # Mock transcription for development/testing
            await asyncio.sleep(0.5)
            return "[Transcription would appear here]"

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: self._transcribe_sync(audio_data, sample_rate)
            )
            return result
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""

    def _transcribe_sync(self, audio_data: np.ndarray, sample_rate: int) -> str:
        """Synchronous transcription using temp file."""
        # Save audio to temp file (parakeet-mlx expects file path)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = Path(f.name)

        try:
            # Write audio data to temp file
            sf.write(temp_path, audio_data, sample_rate)

            # Transcribe
            result = self.model.transcribe(temp_path)
            return result.text.strip() if hasattr(result, 'text') else str(result).strip()
        finally:
            # Clean up temp file
            temp_path.unlink(missing_ok=True)


class AudioBuffer:
    """Buffer for accumulating audio chunks."""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.chunks: list[np.ndarray] = []
        self.total_samples = 0

    def add_chunk(self, data: bytes):
        """Add a chunk of 16-bit PCM audio."""
        audio = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        self.chunks.append(audio)
        self.total_samples += len(audio)

    def get_audio(self) -> np.ndarray:
        """Get accumulated audio as a single array."""
        if not self.chunks:
            return np.array([], dtype=np.float32)
        return np.concatenate(self.chunks)

    def clear(self):
        """Clear the buffer."""
        self.chunks = []
        self.total_samples = 0

    @property
    def duration(self) -> float:
        """Get duration in seconds."""
        return self.total_samples / self.sample_rate




@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": transcriber is not None and transcriber.model is not None,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for audio streaming and transcription."""
    await websocket.accept()
    logger.info("WebSocket connection established")

    audio_buffer = AudioBuffer()
    is_recording = False

    try:
        # Send ready signal once model is loaded
        if transcriber:
            await transcriber._loaded.wait()
        await websocket.send_json({"type": "ready"})

        while True:
            message = await websocket.receive()

            # Check for disconnect
            if message.get("type") == "websocket.disconnect":
                logger.info("Client disconnected")
                break

            if "bytes" in message:
                # Binary audio data
                if is_recording:
                    audio_buffer.add_chunk(message["bytes"])
                    if audio_buffer.total_samples % 16000 == 0:  # Log every second
                        logger.info(f"Received audio: {audio_buffer.duration:.1f}s")

                    # Send partial updates periodically
                    if audio_buffer.duration >= 1.0 and transcriber:
                        audio = audio_buffer.get_audio()
                        if len(audio) > 0:
                            text = await transcriber.transcribe(audio)
                            if text:
                                await websocket.send_json({"type": "partial", "text": text})

            elif "text" in message:
                # JSON control message
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "start":
                        is_recording = True
                        audio_buffer.clear()
                        logger.info("Recording started")

                    elif msg_type == "end":
                        is_recording = False
                        logger.info(f"Recording ended, duration: {audio_buffer.duration:.2f}s")

                        # Final transcription
                        audio = audio_buffer.get_audio()
                        logger.info(f"Processing {len(audio)} samples...")
                        if len(audio) > 0 and transcriber:
                            text = await transcriber.transcribe(audio)
                            logger.info(f"Transcription: {text}")
                            await websocket.send_json({"type": "final", "text": text})
                        else:
                            logger.info("No audio or transcriber not available")
                            await websocket.send_json({"type": "final", "text": ""})

                        audio_buffer.clear()

                except json.JSONDecodeError:
                    logger.warning("Invalid JSON message received")

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception:
            pass


def main():
    """Main entry point."""

    def signal_handler(sig, frame):
        logger.info("Shutting down...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("Starting VoiceFlow server on ws://127.0.0.1:8765")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info",
        ws_ping_interval=20,
        ws_ping_timeout=20,
    )


if __name__ == "__main__":
    main()
