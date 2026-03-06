import asyncio
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from voiceflow_server import server


class BootstrapTranscriber:
    def __init__(self):
        self.model = object()
        self._loading = False
        self._loaded = asyncio.Event()
        self._loaded.set()
        self.load_error = None
        self.loading_stage = "ready"
        self.loading_progress = 1.0
        self.loading_message = "ready"

    def ensure_loading(self, force=False):
        task = asyncio.get_running_loop().create_task(self.load_model())
        return task

    async def load_model(self):
        self._loaded.set()

    async def wait_until_ready(self):
        await self._loaded.wait()

    async def transcribe(self, _audio_data, sample_rate=16000):
        return f"sample_rate={sample_rate}"

    def health_snapshot(self):
        return {
            "status": "ready",
            "model_loaded": True,
            "loading": False,
            "stage": self.loading_stage,
            "progress": self.loading_progress,
            "message": self.loading_message,
            "error": self.load_error,
        }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server, "Transcriber", BootstrapTranscriber)
    server.connected_clients.clear()
    server.transcriber = None
    with TestClient(server.app) as test_client:
        yield test_client
    server.connected_clients.clear()
    server.transcriber = None


def test_websocket_roundtrip_transcription(client):
    class ReadyTranscriber:
        _loading = False
        load_error = None
        model = object()
        loading_stage = "ready"
        loading_progress = 1.0
        loading_message = "ready"

        async def wait_until_ready(self):
            return None

        async def transcribe(self, _audio_data, sample_rate=16000):
            return f"transcribed@{sample_rate}"

    server.transcriber = ReadyTranscriber()

    with client.websocket_connect("/ws") as ws:
        assert ws.receive_json() == {"type": "ready"}
        ws.send_text(json.dumps({"type": "start"}))
        ws.send_bytes(np.array([0, 500, -500, 0], dtype=np.int16).tobytes())
        ws.send_text(json.dumps({"type": "end"}))
        assert ws.receive_json() == {"type": "final", "text": "transcribed@16000"}


def test_websocket_reports_transcription_errors(client):
    class FailingTranscriber:
        _loading = False
        load_error = None
        model = object()
        loading_stage = "ready"
        loading_progress = 1.0
        loading_message = "ready"

        async def wait_until_ready(self):
            return None

        async def transcribe(self, _audio_data, sample_rate=16000):
            raise RuntimeError(f"failed@{sample_rate}")

    server.transcriber = FailingTranscriber()

    with client.websocket_connect("/ws") as ws:
        assert ws.receive_json() == {"type": "ready"}
        ws.send_text(json.dumps({"type": "start"}))
        ws.send_bytes(np.array([100, -100], dtype=np.int16).tobytes())
        ws.send_text(json.dumps({"type": "end"}))
        message = ws.receive_json()
        assert message["type"] == "error"
        assert "failed@16000" in message["error"]
        assert message.get("affectsReadiness") is not True


def test_websocket_returns_model_load_error(client):
    class LoadErrorTranscriber:
        _loading = False
        load_error = "model failed to initialize"
        model = None
        loading_stage = "error"
        loading_progress = 0.0
        loading_message = "error"

        async def wait_until_ready(self):
            return None

    server.transcriber = LoadErrorTranscriber()

    with client.websocket_connect("/ws") as ws:
        message = ws.receive_json()
        assert message["type"] == "error"
        assert message["error"] == "model failed to initialize"
        assert message["affectsReadiness"] is True


def test_health_endpoint_reports_transcriber_state(client):
    class HealthTranscriber:
        def health_snapshot(self):
            return {
                "status": "loading",
                "model_loaded": False,
                "loading": True,
                "stage": "warmup",
                "progress": 0.9,
                "message": "Warming up model...",
                "error": None,
            }

    server.transcriber = HealthTranscriber()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "loading",
        "model_loaded": False,
        "loading": True,
        "stage": "warmup",
        "progress": 0.9,
        "message": "Warming up model...",
        "error": None,
    }


def test_reload_endpoint_requests_forced_reload(client):
    calls = []

    class ReloadableTranscriber:
        def ensure_loading(self, force=False):
            calls.append(force)
            return None

        def health_snapshot(self):
            return {
                "status": "error",
                "model_loaded": False,
                "loading": False,
                "stage": "error",
                "progress": 0.0,
                "message": "Failed",
                "error": "Failed",
            }

    server.transcriber = ReloadableTranscriber()

    response = client.post("/model/reload")

    assert response.status_code == 202
    assert response.json() == {
        "status": "reloading",
        "message": "Model reload requested",
    }
    assert calls == [True]
