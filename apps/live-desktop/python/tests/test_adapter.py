# ruff: noqa: E402 -- validate upstream pins before importing the real interfaces
import asyncio
import json
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from launch import verify_pins

verify_pins()

import httpx
from fastapi.testclient import TestClient
from open_llm_vtuber.agent.input_types import BatchInput, TextData, TextSource
from open_llm_vtuber.agent.output_types import SentenceOutput

from mori_live.adapter import LiveError, MoriLiveAgentAdapter
from mori_live.model import validate_model
from mori_live.protocol import TurnResponse
from mori_live.server import create_app

REPO = Path(__file__).resolve().parents[4]
ROOT = REPO / "apps/mobile/.live2d-private/dist"


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls = []
        self.mode = "MOCK"
        self.status = "approved"
        self.http_status = 200
        self.mutate = lambda response: response
        self.gate = None
        self.started = asyncio.Event()
        self.adapter = MoriLiveAgentAdapter(
            "http://127.0.0.1:4319/v1/live",
            "t" * 32,
            "MOCK",
            {"happy": "blushing", "sad": "cry"},
            transport=httpx.MockTransport(self.handler),
        )

    async def asyncTearDown(self):
        await self.adapter.close()

    async def handler(self, request):
        value = json.loads(request.content)
        self.calls.append(value)
        self.assertEqual(request.headers["authorization"], "Bearer " + "t" * 32)
        if self.http_status != 200:
            return httpx.Response(self.http_status)
        if value["type"] == "session.create":
            result = {
                **value,
                "type": "session.created",
                "eventId": str(uuid4()),
                "sessionId": str(uuid4()),
                "mode": self.mode,
                "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1))
                .isoformat()
                .replace("+00:00", "Z"),
            }
        else:
            if self.gate and value["type"] == "turn.request":
                self.started.set()
                await self.gate.wait()
            cancelled = value["type"] == "turn.cancel"
            result = {
                key: value[key]
                for key in ("version", "context", "requestId", "sessionId", "turnId")
            }
            result.update(
                type="turn.response",
                eventId=str(uuid4()),
                mode=self.mode,
                status="cancelled" if cancelled else self.status,
                text="" if cancelled else "Xin chào!",
                emotion="happy",
                intensity=0.2,
                animation="smile_soft",
                trainingEligibility="prohibited",
            )
            result = self.mutate(result)
        return httpx.Response(200, json=result)

    async def turn(self):
        return await self.adapter.turn("Xin chào", str(uuid4()), str(uuid4()))

    async def test_actual_upstream_interface(self):
        result = [
            item
            async for item in self.adapter.chat(
                BatchInput(texts=[TextData(TextSource.INPUT, "Xin chào")])
            )
        ]
        self.assertIsInstance(result[0], SentenceOutput)
        self.assertEqual(result[0].actions.expressions, ["blushing"])
        self.assertIsNone(result[0].actions.pictures)

    async def test_duplicate_and_conflict(self):
        turn, event = str(uuid4()), str(uuid4())
        self.assertIsNotNone(await self.adapter.turn("hi", turn, event))
        self.assertIsNone(await self.adapter.turn("hi", turn, event))
        self.assertEqual(len(self.calls), 2)
        with self.assertRaisesRegex(LiveError, "CONFLICT"):
            await self.adapter.turn("different", turn, event)

    async def test_duplicate_output_event(self):
        event = str(uuid4())
        self.mutate = lambda r: {**r, "eventId": event}
        self.assertIsNotNone(await self.turn())
        self.assertIsNone(await self.turn())

    async def test_fallback_neutral(self):
        self.status = "fallback"
        self.assertEqual((await self.turn())[1].actions.expressions, [])

    async def test_unknown_expression_fallback(self):
        self.adapter.expressions = {}
        self.assertEqual((await self.turn())[1].actions.expressions, [])

    async def test_wrong_bearer(self):
        self.http_status = 401
        with self.assertRaisesRegex(LiveError, "API_401"):
            await self.turn()

    async def test_unavailable(self):
        self.http_status = 503
        with self.assertRaisesRegex(LiveError, "API_503"):
            await self.turn()

    async def test_expired_session(self):
        await self.adapter.ensure_session()
        self.adapter.session.expiresAt = "2000-01-01T00:00:00Z"
        with self.assertRaisesRegex(LiveError, "EXPIRED"):
            await self.turn()
        self.assertEqual(len(self.calls), 1)

    async def test_mismatch_and_invalid_output(self):
        for change in [
            {"turnId": str(uuid4())},
            {"sessionId": str(uuid4())},
            {"requestId": str(uuid4())},
            {"mode": "REAL"},
            {"context": "PRIVATE_COMPANION"},
            {"text": ""},
            {"tool": "execute"},
            {"intensity": 9},
            {"status": "unsafe"},
            {"trainingEligibility": "approved"},
        ]:
            self.mutate = lambda r: {**r, **change}
            with (
                self.subTest(change=change),
                self.assertRaisesRegex(LiveError, "INVALID_RESPONSE"),
            ):
                await self.turn()

    async def test_cancel_during_generation(self):
        self.gate = asyncio.Event()
        task = asyncio.create_task(self.turn())
        await self.started.wait()
        await self.adapter.cancel()
        self.gate.set()
        self.assertIsNone(await task)
        self.assertEqual(self.calls[-1]["type"], "turn.cancel")

    async def test_cancel_failure_blocks_recovery(self):
        self.gate = asyncio.Event()
        task = asyncio.create_task(self.turn())
        await self.started.wait()
        self.http_status = 503
        with self.assertRaises(LiveError):
            await self.adapter.cancel()
        self.gate.set()
        self.assertIsNone(await task)
        with self.assertRaisesRegex(LiveError, "RECOVERY_REQUIRED"):
            await self.adapter.ensure_session()

    async def test_no_history_media_or_proactive(self):
        with self.assertRaisesRegex(LiveError, "HISTORY_DISABLED"):
            self.adapter.set_memory_from_history("x", "y")
        for data in [
            BatchInput([], metadata={"proactive_speak": True}),
            BatchInput([TextData(TextSource.CLIPBOARD, "hi")]),
        ]:
            with self.assertRaisesRegex(LiveError, "TEXT_ONLY"):
                _ = [item async for item in self.adapter.chat(data)]

    async def test_protocol_rejects_coercion(self):
        response = (await self.turn())[0].model_dump()
        for change in [{"intensity": "0.5"}, {"text": 123}, {"eventId": "invalid"}]:
            with self.assertRaises(ValueError):
                TurnResponse.model_validate({**response, **change})


class ServerTests(unittest.TestCase):
    def setUp(self):
        # Synthetic manifest fixture: no licensed assets needed for security tests.
        self.fixture = tempfile.TemporaryDirectory()
        fixture_root = Path(self.fixture.name)
        model_dir = fixture_root / "Resources/snow-neko"
        model_dir.mkdir(parents=True)
        (fixture_root / "Core").mkdir()
        (fixture_root / "Core/live2dcubismcore.min.js").write_text("// test fixture")
        (fixture_root / "index.html").write_text(
            "<!doctype html><title>Fixture</title>"
        )
        (model_dir / "test.moc3").write_bytes(b"MOC3")
        (model_dir / "physics.json").write_text("{}")
        (model_dir / "idle.json").write_text("{}")
        (model_dir / "display.json").write_text(
            json.dumps({"Parameters": [{"Id": "ParamMouthOpenY"}]})
        )
        (model_dir / "snow-neko.model3.json").write_text(
            json.dumps(
                {
                    "Version": 3,
                    "FileReferences": {
                        "Moc": "test.moc3",
                        "Physics": "physics.json",
                        "DisplayInfo": "display.json",
                        "Textures": [],
                        "Expressions": [],
                        "Motions": {"Idle": [{"File": "idle.json"}]},
                    },
                }
            )
        )
        _, _, mapping = validate_model(fixture_root)
        self.adapter = MoriLiveAgentAdapter(
            "http://127.0.0.1:4319/v1/live", "t" * 32, "MOCK", mapping
        )
        self.client = TestClient(
            create_app(self.adapter, fixture_root, "o" * 32, 4320),
            base_url="http://127.0.0.1:4320",
        )
        self.client.__enter__()
        self.headers = {
            "Origin": "http://127.0.0.1:4320",
            "Host": "127.0.0.1:4320",
            "X-Mori-Local": "1",
        }

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.fixture.cleanup()

    def login(self):
        return self.client.post(
            "/login", json={"token": "o" * 32}, headers=self.headers
        )

    def test_login_and_private_assets(self):
        self.assertEqual(self.client.get("/renderer/index.html").status_code, 401)
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertIn("HttpOnly", result.headers["set-cookie"])
        self.assertEqual(self.client.get("/renderer/index.html").status_code, 200)
        for path in ["/history", "/asr", "/config", "/renderer/.env", "/docs"]:
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_host_origin_csrf(self):
        self.assertEqual(
            self.client.get("/", headers={"Host": "evil.example"}).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                "/", headers={"Origin": "https://evil.example"}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post("/login", json={"token": "o" * 32}).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                "/login", json={"token": "wrong"}, headers=self.headers
            ).status_code,
            401,
        )

    def test_websocket_requires_auth_origin(self):
        with self.assertRaises(Exception):
            with self.client.websocket_connect(
                "ws://127.0.0.1:4320/ws", headers=self.headers
            ):
                pass
        self.login()
        with self.assertRaises(Exception):
            with self.client.websocket_connect(
                "ws://127.0.0.1:4320/ws", headers={"Origin": "https://evil.example"}
            ):
                pass
        with self.client.websocket_connect(
            "ws://127.0.0.1:4320/ws", headers=self.headers
        ) as ws:
            self.assertEqual(ws.receive_json()["type"], "connected")
            ws.send_json({"type": "switch-config", "file": "x"})
            self.assertEqual(ws.receive_json()["type"], "error")

    def test_missing_model(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                validate_model(directory)

    def test_renderer_disconnect_cancels_generation(self):
        started, cancelled = threading.Event(), threading.Event()

        async def turn(*args):
            started.set()
            await asyncio.Event().wait()

        async def cancel():
            cancelled.set()

        self.adapter.turn = turn
        self.adapter.cancel = cancel
        self.login()
        with self.client.websocket_connect(
            "ws://127.0.0.1:4320/ws", headers=self.headers
        ) as ws:
            ws.receive_json()
            ws.send_json({"version": 1, "type": "ready"})
            ws.send_json(
                {
                    "version": 1,
                    "context": "PUBLIC_LIVE",
                    "type": "text",
                    "requestId": str(uuid4()),
                    "eventId": str(uuid4()),
                    "turnId": str(uuid4()),
                    "text": "hi",
                }
            )
            self.assertEqual(ws.receive_json()["state"], "thinking")
            self.assertTrue(started.wait(2))
        self.assertTrue(cancelled.wait(2))

    def test_operator_controls_require_auth_and_csrf(self):
        self.assertEqual(
            self.client.post(
                "/control", json={"action": "mute"}, headers=self.headers
            ).status_code,
            401,
        )
        self.login()
        self.assertEqual(
            self.client.post("/control", json={"action": "mute"}).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                "/control", json={"action": "run-command"}, headers=self.headers
            ).status_code,
            409,
        )
        with self.client.websocket_connect(
            "ws://127.0.0.1:4320/ws", headers=self.headers
        ) as ws:
            ws.receive_json()
            for action in ["mute", "resume", "pause", "start", "stop"]:
                response = self.client.post(
                    "/control", json={"action": action}, headers=self.headers
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(ws.receive_json()["action"], action)
            response = self.client.post(
                "/control", json={"action": "test", "text": "hi"}, headers=self.headers
            )
            self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
