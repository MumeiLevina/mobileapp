"""Bounded TTSInterface implementations and single-turn playback handshake.

Reuse upstream's output/audio payload format. Do not call its unbounded task
manager: clear() leaves synthesis tasks alive and its logging includes raw text.
"""

import asyncio
import base64
import io
import math
import re
import struct
import tempfile
import time
import wave
from pathlib import Path
from uuid import uuid4
from xml.sax.saxutils import escape

import httpx
from open_llm_vtuber.tts.tts_interface import TTSInterface

from .adapter import LiveError

MAX_SECONDS = 90
MAX_BYTES = 24000 * 2 * MAX_SECONDS + 4096


def validate_wav(data):
    if len(data) > MAX_BYTES:
        raise LiveError("AUDIO_TOO_LONG")
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            if (
                audio.getnchannels() != 1
                or audio.getsampwidth() != 2
                or audio.getframerate() != 24000
                or audio.getcomptype() != "NONE"
            ):
                raise LiveError("AUDIO_FORMAT")
            frames = audio.getnframes()
            if not 1 <= frames <= 24000 * MAX_SECONDS:
                raise LiveError("AUDIO_DURATION")
            samples = audio.readframes(frames)
            if len(samples) != frames * 2:
                raise LiveError("AUDIO_TRUNCATED")
            return frames / 24000
    except (wave.Error, EOFError):
        raise LiveError("AUDIO_FORMAT") from None


class PrivateTTS(TTSInterface):
    def __init__(self, cache):
        self.cache = Path(cache).resolve()
        self.cache.mkdir(parents=True, exist_ok=True)

    def save(self, data):
        validate_wav(data)
        with tempfile.NamedTemporaryFile(
            dir=self.cache, suffix=".wav", delete=False
        ) as file:
            file.write(data)
            return file.name

    def generate_audio(self, text, file_name_no_ext=None):
        return asyncio.run(self.async_generate_audio(text, file_name_no_ext))

    def remove_file(self, filepath, verbose=False):
        path = Path(filepath).resolve()
        if not path.is_relative_to(self.cache):
            raise LiveError("AUDIO_PATH")
        path.unlink(missing_ok=True)


class MockTTS(PrivateTTS):
    """Synthetic tone, explicitly NOT Vietnamese speech or a voice-quality test."""

    async def async_generate_audio(self, text, file_name_no_ext=None):
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(24000)
            audio.writeframes(
                b"".join(
                    struct.pack(
                        "<h", int(1600 * math.sin(2 * math.pi * 220 * i / 24000))
                    )
                    if 6000 <= i < 30000
                    else b"\x00\x00"
                    for i in range(36000)
                )
            )
        return self.save(output.getvalue())


class AzureVietnameseTTS(PrivateTTS):
    """Official HTTPS REST transport. XML-escaped text, no arbitrary SSML/URLs."""

    def __init__(
        self, cache, key, region, voice="vi-VN-HoaiMyNeural", *, transport=None
    ):
        super().__init__(cache)
        if not key or not re.fullmatch(r"[a-z0-9]{3,32}", region):
            raise ValueError("Azure key and region required")
        if voice not in ("vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"):
            raise ValueError("Voice not allowlisted")
        self.key, self.region, self.voice, self.transport = (
            key,
            region,
            voice,
            transport,
        )

    async def async_generate_audio(self, text, file_name_no_ext=None):
        if not text.strip() or len(text) > 1200:
            raise LiveError("TTS_TEXT_LIMIT")
        ssml = (
            f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="vi-VN"><voice name="{self.voice}">{escape(text)}</voice></speak>'
        )
        try:
            async with asyncio.timeout(30):
                async with httpx.AsyncClient(
                    timeout=30,
                    trust_env=False,
                    follow_redirects=False,
                    transport=self.transport,
                ) as client:
                    async with client.stream(
                        "POST",
                        f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1",
                        headers={
                            "Ocp-Apim-Subscription-Key": self.key,
                            "Content-Type": "application/ssml+xml",
                            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
                            "User-Agent": "MoriLive",
                        },
                        content=ssml.encode(),
                    ) as response:
                        if response.status_code != 200:
                            raise LiveError("TTS_PROVIDER_ERROR")
                        data = bytearray()
                        async for chunk in response.aiter_bytes():
                            data.extend(chunk)
                            if len(data) > MAX_BYTES:
                                raise LiveError("AUDIO_TOO_LONG")
            return self.save(bytes(data))
        except (TimeoutError, httpx.HTTPError):
            raise LiveError("TTS_UNAVAILABLE") from None


class SpeechDelivery:
    """One active item, no reconnect replay, bounded synthesis/playback waits."""

    def __init__(self, provider: TTSInterface, synthesis_timeout=30):
        self.provider = provider
        self.synthesis_timeout = synthesis_timeout
        self.current = None
        self.completion = None
        self.started = False
        self.position = 0.0
        self.duration = 0.0
        self.queued_at = 0.0
        self.started_at = 0.0

    async def deliver(self, turn_id, output, send):
        if self.current:
            raise LiveError("VOICE_BUSY")
        self.current = {"turnId": turn_id, "speechId": str(uuid4())}
        self.completion = asyncio.get_running_loop().create_future()
        self.started = False
        self.position = 0.0
        self.queued_at = time.monotonic()
        path = None
        try:
            await send({"type": "voice.speech.queued", **self.current})
            async with asyncio.timeout(self.synthesis_timeout):
                path = await self.provider.async_generate_audio(output.tts_text)
            data = Path(path).read_bytes()
            self.duration = validate_wav(data)
            # Same base64 WAV/display/actions fields as upstream prepare_audio_payload.
            # RMS is sampled from actual browser playback, not predicted chunk timing.
            await send(
                {
                    "type": "voice.audio",
                    **self.current,
                    "audio": base64.b64encode(data).decode(),
                    "duration": self.duration,
                    "display_text": output.display_text.to_dict(),
                    "actions": output.actions.to_dict(),
                    "mock": isinstance(self.provider, MockTTS),
                }
            )
            await asyncio.wait_for(self.completion, timeout=self.duration + 20)
        except asyncio.CancelledError:
            await send({"type": "voice.speech.cancelled", **self.current})
            raise
        except (LiveError, TimeoutError, OSError):
            await send(
                {"type": "voice.speech.error", **self.current, "code": "VOICE_FAILED"}
            )
        finally:
            if path:
                self.provider.remove_file(path)
            self.current = None
            self.completion = None

    def feedback(self, value):
        if not self.current or any(
            value[k] != self.current[k] for k in ("turnId", "speechId")
        ):
            raise LiveError("STALE_PLAYBACK")
        kind = value["type"]
        position = value["position"]
        if (
            not math.isfinite(position)
            or not self.position <= position <= self.duration + 0.25
        ):
            raise LiveError("INVALID_PLAYBACK")
        if kind == "voice.speech.started":
            if self.started or position > 0.25:
                raise LiveError("INVALID_PLAYBACK")
            self.started, self.started_at = True, time.monotonic()
        elif kind in ("voice.speech.progress", "voice.speech.finished"):
            if not self.started or position > time.monotonic() - self.started_at + 0.75:
                raise LiveError("INVALID_PLAYBACK")
            if kind == "voice.speech.finished" and position < self.duration - 0.1:
                raise LiveError("INCOMPLETE_PLAYBACK")
        self.position = position
        if kind in (
            "voice.speech.finished",
            "voice.speech.cancelled",
            "voice.speech.error",
        ):
            if not self.completion.done():
                self.completion.set_result(kind)
