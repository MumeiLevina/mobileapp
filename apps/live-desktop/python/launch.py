"""Verify immutable pins before importing any upstream code."""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
UPSTREAM = REPO / ".mori-live" / "upstream"


def verify_pins():
    pin = json.loads((REPO / "apps/live-desktop/upstream.lock.json").read_text())
    if sys.version_info[:2] != (3, 11):
        raise RuntimeError("Python 3.11 required; run setup-mori-live.ps1 -SyncPython")
    for directory, expected in [
        (UPSTREAM, pin["commit"]),
        (UPSTREAM / "frontend", pin["frontendCommit"]),
    ]:
        actual = subprocess.check_output(
            ["git", "-C", str(directory), "rev-parse", "HEAD"], text=True
        ).strip()
        if actual != expected:
            raise RuntimeError("Upstream commit mismatch")
        if subprocess.check_output(
            ["git", "-C", str(directory), "status", "--porcelain"], text=True
        ).strip():
            raise RuntimeError("Upstream checkout must be clean")
    if (
        hashlib.sha256((UPSTREAM / "uv.lock").read_bytes()).hexdigest()
        != pin["uvLockSha256"]
    ):
        raise RuntimeError("Upstream dependency lock mismatch")
    sys.path.insert(0, str(UPSTREAM / "src"))


def main():
    verify_pins()
    import uvicorn
    from loguru import logger
    from mori_live.adapter import MoriLiveAgentAdapter
    from mori_live.model import validate_model
    from mori_live.server import create_app
    from mori_live.voice import AzureVietnameseTTS, MockTTS

    logger.remove()  # pinned upstream must not log raw conversations
    token = os.environ["MORI_LIVE_API_TOKEN"]
    operator = os.environ["MORI_LIVE_OPERATOR_TOKEN"]
    if token == operator:
        raise ValueError("Operator and backend credentials must be different")
    port = int(os.environ.get("MORI_LIVE_DESKTOP_PORT", "4320"))
    if not 1024 <= port <= 65535:
        raise ValueError("Invalid port")
    voice_mode = os.environ.get("MORI_TTS_PROVIDER", "azure")
    if voice_mode == "azure" and not (
        os.environ.get("MORI_TTS_KEY") and os.environ.get("MORI_TTS_REGION")
    ):
        voice_mode = "mock"
        print(
            '{"event":"tts_mock_fallback","reason":"azure_credentials_missing"}',
            flush=True,
        )
    root = (
        REPO / ".mori-live/renderer/dist"
        if voice_mode != "disabled"
        else REPO / "apps/mobile/.live2d-private/dist"
    )
    _, _, mapping = validate_model(root)
    adapter = MoriLiveAgentAdapter(
        os.environ.get("MORI_LIVE_API_URL", "http://127.0.0.1:4319/v1/live"),
        token,
        os.environ.get("MORI_LIVE_MODE", "MOCK"),
        mapping,
    )
    cache = REPO / ".mori-live/audio"
    tts = None
    if voice_mode == "mock":
        tts = MockTTS(cache)
    elif voice_mode == "azure":
        tts = AzureVietnameseTTS(
            cache,
            os.environ["MORI_TTS_KEY"],
            os.environ["MORI_TTS_REGION"],
            os.environ.get("MORI_TTS_VOICE", "vi-VN-HoaiMyNeural"),
        )
    elif voice_mode != "disabled":
        raise ValueError("TTS provider must be disabled, mock or azure")
    app = create_app(adapter, root, operator, port, tts)
    print(
        json.dumps(
            {"event": "mori_python_started", "mode": adapter.mode, "port": port}
        ),
        flush=True,
    )
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        access_log=False,
        log_level="critical",
        ws_max_size=12000,
        ws_max_queue=4,
        limit_concurrency=32,
        timeout_keep_alive=5,
    )


if __name__ == "__main__":
    main()
