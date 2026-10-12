# ruff: noqa: E402 -- upstream pin verification before imports
import asyncio
import io
import sys
import tempfile
import time
import unittest
import wave
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from launch import verify_pins

verify_pins()

import httpx
from open_llm_vtuber.agent.output_types import Actions, DisplayText, SentenceOutput
from mori_live.adapter import LiveError
from mori_live.voice import AzureVietnameseTTS, MockTTS, SpeechDelivery, validate_wav


def wav(seconds=0.1):
    data = io.BytesIO()
    with wave.open(data, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(b"\x00\x00" * int(seconds * 24000))
    return data.getvalue()


class VoiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.provider = MockTTS(self.directory.name)
        self.delivery = SpeechDelivery(self.provider)
        self.events = []
        self.audio_ready = asyncio.Event()
        self.output = SentenceOutput(
            DisplayText("Xin chào"), "Xin chào", Actions(expressions=[])
        )

    async def asyncTearDown(self):
        self.directory.cleanup()

    async def send(self, event):
        self.events.append(event)
        if event["type"] == "voice.audio":
            self.audio_ready.set()

    async def begin(self):
        task = asyncio.create_task(
            self.delivery.deliver(str(uuid4()), self.output, self.send)
        )
        await self.audio_ready.wait()
        return task

    def feedback(self, kind, position=0):
        self.delivery.feedback(
            {
                **self.delivery.current,
                "type": f"voice.speech.{kind}",
                "position": position,
            }
        )

    def test_audio_validation_silent_short_long_corrupt(self):
        self.assertEqual(validate_wav(wav(0.1)), 0.1)
        self.assertGreater(validate_wav(wav(0.001)), 0)
        for data in [wav(91), wav(0), b"mp3", wav(0.1)[:-20]]:
            with self.assertRaises(LiveError):
                validate_wav(data)

    async def test_queue_playback_completion_cleanup(self):
        task = await self.begin()
        self.feedback("started")
        self.delivery.started_at = time.monotonic() - 2
        self.feedback("progress", 0.5)
        self.feedback("finished", 1.5)
        await task
        self.assertIsNone(self.delivery.current)
        self.assertEqual(list(Path(self.directory.name).glob("*.wav")), [])

    async def test_cancellation_and_no_replay(self):
        task = await self.begin()
        previous = dict(self.delivery.current)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(self.events[-1]["type"], "voice.speech.cancelled")
        with self.assertRaisesRegex(LiveError, "STALE"):
            self.delivery.feedback(
                {**previous, "type": "voice.speech.finished", "position": 1.5}
            )
        self.assertEqual(list(Path(self.directory.name).glob("*.wav")), [])

    async def test_overlap_rejected_and_missing_device_error(self):
        task = await self.begin()
        with self.assertRaisesRegex(LiveError, "VOICE_BUSY"):
            await self.delivery.deliver(str(uuid4()), self.output, self.send)
        self.feedback("error")
        await task

    async def test_invalid_progress_or_premature_finished(self):
        task = await self.begin()
        with self.assertRaises(LiveError):
            self.feedback("finished", 1.5)
        self.feedback("started")
        with self.assertRaises(LiveError):
            self.feedback("finished", 0.5)
        with self.assertRaises(LiveError):
            self.feedback("progress", 90)
        self.feedback("cancelled")
        await task

    async def test_delayed_synthesis_cancel(self):
        started = asyncio.Event()

        async def delayed(*args):
            started.set()
            await asyncio.Event().wait()

        self.provider.async_generate_audio = delayed
        task = asyncio.create_task(
            self.delivery.deliver(str(uuid4()), self.output, self.send)
        )
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertIsNone(self.delivery.current)

    async def test_cloud_mock_transport_ssml_escaping_and_valid_wav(self):
        async def handler(request):
            self.assertEqual(request.url.host, "southeastasia.tts.speech.microsoft.com")
            self.assertIn(b"&lt;audio", request.content)
            self.assertNotIn(b"<audio", request.content)
            return httpx.Response(200, content=wav())

        provider = AzureVietnameseTTS(
            self.directory.name,
            "test-only",
            "southeastasia",
            transport=httpx.MockTransport(handler),
        )
        path = await provider.async_generate_audio(
            '<audio src="https://evil.example"/>'
        )
        self.assertEqual(validate_wav(Path(path).read_bytes()), 0.1)
        provider.remove_file(path)

    async def test_cloud_bad_format_and_http_failure(self):
        for response in [httpx.Response(401), httpx.Response(200, content=b"bad")]:
            provider = AzureVietnameseTTS(
                self.directory.name,
                "test",
                "southeastasia",
                transport=httpx.MockTransport(lambda request: response),
            )
            with self.assertRaises(LiveError):
                await provider.async_generate_audio("Xin chào")

    async def test_synthesis_timeout_is_terminal(self):
        async def delayed(*args):
            await asyncio.Event().wait()

        self.provider.async_generate_audio = delayed
        self.delivery.synthesis_timeout = 0.01
        await self.delivery.deliver(str(uuid4()), self.output, self.send)
        self.assertEqual(self.events[-1]["type"], "voice.speech.error")
        self.assertIsNone(self.delivery.current)

    async def test_cloud_read_timeout(self):
        def timeout(request):
            raise httpx.ReadTimeout("test timeout")

        provider = AzureVietnameseTTS(
            self.directory.name,
            "test",
            "southeastasia",
            transport=httpx.MockTransport(timeout),
        )
        with self.assertRaisesRegex(LiveError, "TTS_UNAVAILABLE"):
            await provider.async_generate_audio("Xin chào")


if __name__ == "__main__":
    unittest.main()
