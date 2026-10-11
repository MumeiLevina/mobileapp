"""Mori-owned restricted launcher. No stock upstream routes/context are imported."""

import asyncio
import hmac
import json
import secrets
import time
from uuid import uuid4
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pydantic import Field, ValidationError

from .adapter import LiveError, envelope
from .model import validate_model
from .protocol import Envelope, Strict
from .voice import SpeechDelivery

WEB = Path(__file__).parent.parent / "web"


class TextCommand(Envelope):
    type: Literal["text"]
    turnId: str
    text: str = Field(min_length=1, max_length=2000)


class PlaybackEvent(Strict):
    version: Literal[1]
    type: Literal[
        "voice.speech.started",
        "voice.speech.progress",
        "voice.speech.finished",
        "voice.speech.cancelled",
        "voice.speech.error",
    ]
    turnId: str = Field(min_length=36, max_length=36)
    speechId: str = Field(min_length=36, max_length=36)
    position: float = Field(ge=0, le=91, allow_inf_nan=False)


class OperatorCommand(Strict):
    action: Literal["start", "pause", "resume", "stop", "mute", "test"]
    text: str | None = Field(default=None, min_length=1, max_length=2000)


def create_app(adapter, renderer_root, operator_token, port, tts=None):
    root, allowed, _ = validate_model(renderer_root)
    if len(operator_token) < 32:
        raise ValueError("Dedicated operator token must have at least 32 characters")
    origin = f"http://127.0.0.1:{port}"
    cookie = secrets.token_urlsafe(32)
    expires = time.monotonic() + 14400
    connected = False
    login_attempts = []
    renderer_control = None
    status = {
        "operation": "RUNNING",
        "connected": False,
        "avatar": "not_ready",
        "emotion": "neutral",
        "speech": "",
        "error": None,
        "mode": adapter.mode,
        "voice": tts.__class__.__name__ if tts else "disabled",
    }
    budget_cache = {"checked": 0.0, "value": None}

    @asynccontextmanager
    async def lifespan(app):
        yield
        await adapter.close()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    def authenticated(connection):
        return time.monotonic() < expires and hmac.compare_digest(
            connection.cookies.get("mori_operator", ""), cookie
        )

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        if (
            request.headers.get("host") != f"127.0.0.1:{port}"
            or request.headers.get("origin") not in (None, origin)
            or request.headers.get("sec-fetch-site")
            not in (None, "none", "same-origin")
        ):
            return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        if request.url.path not in (
            "/",
            "/login",
            "/client.js",
            "/voice.mjs",
            "/style.css",
            "/operator",
            "/operator.js",
            "/avatar",
        ) and not authenticated(request):
            return JSONResponse({"error": "UNAUTHORIZED"}, status_code=401)
        if request.method not in ("GET", "POST"):
            return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        response = await call_next(request)
        response.headers.update(
            {
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer",
                "Permissions-Policy": "microphone=(), camera=(), display-capture=()",
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
            }
        )
        return response

    @app.get("/")
    @app.get("/avatar")
    async def index():
        return FileResponse(WEB / "index.html")

    @app.get("/operator")
    async def operator():
        return FileResponse(WEB / "operator.html")

    @app.get("/operator.js")
    async def operator_script():
        return FileResponse(WEB / "operator.js", media_type="text/javascript")

    @app.get("/status")
    async def live_status():
        if time.monotonic() - budget_cache["checked"] > 3:
            budget_cache["checked"] = time.monotonic()
            try:
                budget_cache["value"] = await adapter.status()
            except LiveError:
                budget_cache["value"] = None
        return {"version": 1, **status, "budget": budget_cache["value"]}

    @app.post("/control")
    async def control(request: Request):
        if (
            request.headers.get("origin") != origin
            or request.headers.get("x-mori-local") != "1"
            or request.headers.get("content-type") != "application/json"
        ):
            return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 10000:
                return JSONResponse({"error": "INVALID_REQUEST"}, status_code=413)
        try:
            command = OperatorCommand.model_validate_json(body)
            if renderer_control is None:
                raise LiveError("RENDERER_DISCONNECTED")
            await renderer_control(command)
            return {"ok": True}
        except (ValueError, LiveError):
            return JSONResponse({"error": "CONTROL_UNAVAILABLE"}, status_code=409)

    @app.get("/client.js")
    async def javascript():
        return FileResponse(WEB / "client.js", media_type="text/javascript")

    @app.get("/voice.mjs")
    async def voice_script():
        return FileResponse(WEB / "voice.mjs", media_type="text/javascript")

    @app.get("/style.css")
    async def stylesheet():
        return FileResponse(WEB / "style.css", media_type="text/css")

    @app.post("/login")
    async def login(request: Request):
        if (
            request.headers.get("origin") != origin
            or request.headers.get("x-mori-local") != "1"
            or request.headers.get("content-type") != "application/json"
        ):
            return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        now = time.monotonic()
        login_attempts[:] = [t for t in login_attempts if now - t < 60]
        if len(login_attempts) >= 10:
            return JSONResponse({"error": "RATE_LIMIT"}, status_code=429)
        login_attempts.append(now)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 1024:
                return JSONResponse({"error": "INVALID_REQUEST"}, status_code=413)
        try:
            value = json.loads(body)
            valid = (
                isinstance(value, dict)
                and set(value) == {"token"}
                and isinstance(value["token"], str)
                and hmac.compare_digest(value["token"], operator_token)
            )
        except (ValueError, TypeError):
            valid = False
        if not valid or now >= expires:
            return JSONResponse({"error": "UNAUTHORIZED"}, status_code=401)
        response = JSONResponse(
            {
                "mode": adapter.mode,
                "voice": tts.__class__.__name__ if tts else "disabled",
            }
        )
        response.set_cookie(
            "mori_operator", cookie, httponly=True, samesite="strict", max_age=14400
        )
        return response

    @app.get("/renderer/{name:path}")
    async def renderer(name: str):
        if name not in allowed:
            return JSONResponse({"error": "NOT_FOUND"}, status_code=404)
        target = (root / name).resolve(strict=True)
        if not target.is_relative_to(root):
            return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
        return FileResponse(target)

    @app.websocket("/ws")
    async def socket(ws: WebSocket):
        nonlocal connected, renderer_control
        if (
            ws.headers.get("host") != f"127.0.0.1:{port}"
            or ws.headers.get("origin") != origin
            or not authenticated(ws)
            or connected
        ):
            await ws.close(code=1008)
            return
        connected = True
        status.update(connected=True, avatar="loading", error=None)
        await ws.accept()
        active = None
        speech = SpeechDelivery(tts) if tts else None
        ready = False
        count = 0
        window = time.monotonic()

        async def send(event):
            await ws.send_json({"version": 1, **event})

        async def run(command):
            try:
                await send({"type": "state", "state": "thinking"})
                result = await adapter.turn(
                    command.text, command.turnId, command.eventId
                )
                if result:
                    response, output = result
                    status.update(
                        emotion=response.emotion
                        if response.status == "approved"
                        else "neutral",
                        speech=output.tts_text,
                    )
                    await send(
                        {
                            "type": "response",
                            "turnId": response.turnId,
                            "eventId": response.eventId,
                            "text": output.display_text.text,
                            "expression": next(iter(output.actions.expressions), None),
                            "safeFallback": response.status == "fallback",
                        }
                    )
                    if speech:
                        await speech.deliver(response.turnId, output, send)
                else:
                    await send({"type": "deduplicated"})
            except (LiveError, ValueError):
                status["error"] = "TURN_FAILED"
                await send({"type": "error", "code": "TURN_FAILED"})
            finally:
                status["speech"] = ""
                await send({"type": "state", "state": "idle"})

        async def operate(command):
            nonlocal active
            if command.action in ("pause", "stop", "mute"):
                status["operation"] = (
                    "STOPPED" if command.action == "stop" else "PAUSED"
                )
                # Immediate renderer mute before a possibly slow backend tombstone.
                await send({"type": "operator", "action": command.action})
                try:
                    await adapter.cancel()
                finally:
                    if active and not active.done():
                        active.cancel()
                        await asyncio.gather(active, return_exceptions=True)
            elif command.action in ("start", "resume"):
                if adapter.blocked:
                    raise LiveError("RECOVERY_REQUIRED")
                status["operation"] = "RUNNING"
                await send({"type": "operator", "action": command.action})
            elif command.action == "test":
                if (
                    not ready
                    or status["operation"] != "RUNNING"
                    or not command.text
                    or (active and not active.done())
                ):
                    raise LiveError("NOT_READY")
                text_command = TextCommand.model_validate(
                    {**envelope("text"), "turnId": str(uuid4()), "text": command.text}
                )
                active = asyncio.create_task(run(text_command))

        renderer_control = operate

        try:
            await send({"type": "connected", "mode": adapter.mode})
            if status["operation"] != "RUNNING":
                await send({"type": "operator", "action": "pause"})
            while True:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=60)
                if len(raw.encode()) > 12000 or not authenticated(ws):
                    await ws.close(code=1008)
                    break
                try:
                    value = json.loads(raw)
                    if time.monotonic() - window >= 60:
                        count, window = 0, time.monotonic()
                    count += 1
                    # ~4 playback progress events/second, bounded independently
                    # of Nest's generation quota. A flood disconnect cancels work.
                    if count > 600:
                        await ws.close(code=1008)
                        break
                    if value == {"version": 1, "type": "ready"}:
                        ready = True
                        status["avatar"] = "ready"
                    elif value == {"version": 1, "type": "ping"}:
                        await send({"type": "pong"})
                    elif isinstance(value, dict) and str(
                        value.get("type", "")
                    ).startswith("voice.speech."):
                        feedback = PlaybackEvent.model_validate(value)
                        if not speech:
                            raise ValueError()
                        speech.feedback(feedback.model_dump())
                    elif value == {"version": 1, "type": "cancel"}:
                        await adapter.cancel()
                        if active and not active.done():
                            active.cancel()
                            await asyncio.gather(active, return_exceptions=True)
                        await send({"type": "state", "state": "idle"})
                    else:
                        command = TextCommand.model_validate(value)
                        if (
                            not ready
                            or status["operation"] != "RUNNING"
                            or (active and not active.done())
                        ):
                            raise ValueError()
                        active = asyncio.create_task(run(command))
                except (ValueError, ValidationError, LiveError):
                    await send({"type": "error", "code": "INVALID_REQUEST"})
        except (WebSocketDisconnect, TimeoutError):
            pass
        finally:
            try:
                await adapter.cancel()
            except LiveError:
                pass
            if active:
                active.cancel()
                await asyncio.gather(active, return_exceptions=True)
            connected = False
            renderer_control = None
            status.update(connected=False, avatar="disconnected", speech="")

    return app
