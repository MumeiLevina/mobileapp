"""Use the pinned upstream interface directly, not its memory agent/factory."""

import asyncio
import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
from open_llm_vtuber.agent.agents.agent_interface import AgentInterface
from open_llm_vtuber.agent.input_types import BatchInput, TextSource
from open_llm_vtuber.agent.output_types import Actions, DisplayText, SentenceOutput

from .protocol import LiveStatus, Session, TurnRequest, TurnResponse, ViewerInput


class LiveError(Exception):
    """Only fixed codes cross the UI/log boundary; never response text or tokens."""


def envelope(kind):
    return dict(
        version=1,
        context="PUBLIC_LIVE",
        type=kind,
        requestId=str(uuid4()),
        eventId=str(uuid4()),
    )


class MoriLiveAgentAdapter(AgentInterface):
    def __init__(self, endpoint, token, mode, expressions, *, transport=None):
        url = urlsplit(endpoint)
        if (
            url.scheme != "http"
            or url.hostname != "127.0.0.1"
            or url.path != "/v1/live"
            or url.query
            or url.fragment
            or url.username
            or url.password
        ):
            raise ValueError("Only the local PUBLIC_LIVE API is supported")
        if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", token):
            raise ValueError("Dedicated API token required")
        if mode not in ("MOCK", "STAGING", "REAL"):
            raise ValueError("Invalid mode")
        self.mode = mode
        self.expressions = expressions
        self.client = httpx.AsyncClient(
            base_url=endpoint,
            headers={"Authorization": f"Bearer {token}"},
            timeout=50,
            follow_redirects=False,
            trust_env=False,
            transport=transport,
        )
        self.session = None
        self.create_event = str(uuid4())
        self.seen_turns = {}  # bounded, hashes only; no raw chat history
        self.seen_events = set()
        self.active = None
        self.cancelled = set()
        self.blocked = False
        self.interrupt_task = None

    async def post(self, request):
        try:
            async with asyncio.timeout(50):
                async with self.client.stream("POST", "", json=request) as response:
                    if response.status_code != 200:
                        raise LiveError(f"API_{response.status_code}")
                    if not response.headers.get("content-type", "").startswith(
                        "application/json"
                    ):
                        raise LiveError("INVALID_RESPONSE")
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 32768:
                            raise LiveError("INVALID_RESPONSE")
                    return bytes(data)
        except (httpx.HTTPError, TimeoutError):
            raise LiveError("API_UNAVAILABLE") from None

    async def ensure_session(self):
        if self.blocked:
            raise LiveError("RECOVERY_REQUIRED")
        if self.session is None:
            request = {**envelope("session.create"), "eventId": self.create_event}
            try:
                session = Session.model_validate_json(await self.post(request))
                if (
                    session.requestId != request["requestId"]
                    or session.mode != self.mode
                ):
                    raise ValueError()
            except ValueError:
                raise LiveError("INVALID_RESPONSE") from None
            self.session = session
        if datetime.fromisoformat(
            self.session.expiresAt.replace("Z", "+00:00")
        ) <= datetime.now(timezone.utc):
            raise LiveError("SESSION_EXPIRED")
        return self.session

    async def status(self):
        try:
            async with asyncio.timeout(3):
                async with self.client.stream("GET", "status", timeout=3) as response:
                    if response.status_code != 200:
                        raise LiveError("STATUS_UNAVAILABLE")
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 4096:
                            raise LiveError("INVALID_STATUS")
                    status = LiveStatus.model_validate_json(bytes(data))
                    if status.mode != self.mode:
                        raise ValueError()
                    return status.model_dump()
        except (httpx.HTTPError, TimeoutError, ValueError):
            raise LiveError("STATUS_UNAVAILABLE") from None

    def validate_response(self, raw, request):
        try:
            response = TurnResponse.model_validate_json(raw)
            if response.mode != self.mode or any(
                getattr(response, key) != request[key]
                for key in ("sessionId", "turnId", "requestId")
            ):
                raise ValueError()
            return response
        except ValueError:
            raise LiveError("INVALID_RESPONSE") from None

    async def turn(self, text, turn_id, event_id):
        ViewerInput(text=text)
        UUID(turn_id)
        UUID(event_id)
        fingerprint = hashlib.sha256((event_id + text.strip()).encode()).hexdigest()
        if turn_id in self.seen_turns:
            if self.seen_turns[turn_id] != fingerprint:
                raise LiveError("TURN_CONFLICT")
            return None  # at-most-once delivery, including uncertain failures
        if self.active:
            raise LiveError("BUSY")
        if len(self.seen_turns) >= 100:
            raise LiveError("SESSION_CAPACITY")
        self.seen_turns[turn_id] = fingerprint
        self.active = turn_id
        try:
            session = await self.ensure_session()
            if turn_id in self.cancelled:
                return None
            request = TurnRequest.model_validate(
                {
                    **envelope("turn.request"),
                    "sessionId": session.sessionId,
                    "turnId": turn_id,
                    "eventId": event_id,
                    "source": "simulated",
                    "input": {"type": "viewer_chat", "text": text},
                }
            ).model_dump()
            response = self.validate_response(await self.post(request), request)
            if (
                turn_id in self.cancelled
                or response.status == "cancelled"
                or response.eventId in self.seen_events
            ):
                return None
            self.seen_events.add(response.eventId)
            # API fallback is safe text but never a celebratory animation.
            expression = (
                self.expressions.get(response.emotion)
                if response.status == "approved"
                else None
            )
            output = SentenceOutput(
                display_text=DisplayText(text=response.text, name="Mori"),
                tts_text=response.text,
                actions=Actions(expressions=[expression] if expression else []),
            )
            return response, output
        finally:
            self.active = None

    async def cancel(self):
        turn_id = self.active
        if not turn_id:
            return
        self.cancelled.add(turn_id)
        if self.session:
            request = {
                **envelope("turn.cancel"),
                "sessionId": self.session.sessionId,
                "turnId": turn_id,
            }
            try:
                result = self.validate_response(await self.post(request), request)
                if result.status != "cancelled":
                    raise LiveError("INVALID_RESPONSE")
            except (LiveError, asyncio.CancelledError):
                self.blocked = True  # uncertain cancellation requires operator recovery
                raise

    async def chat(self, input_data):
        if (
            not isinstance(input_data, BatchInput)
            or input_data.images
            or input_data.files
            or input_data.metadata
            or len(input_data.texts) != 1
            or input_data.texts[0].source != TextSource.INPUT
        ):
            raise LiveError("TEXT_ONLY")
        result = await self.turn(
            input_data.texts[0].content, str(uuid4()), str(uuid4())
        )
        if result:
            yield result[1]

    def handle_interrupt(self, heard_response):
        # No transcript stored. Owner awaits this task before reusing the adapter.
        self.interrupt_task = asyncio.create_task(self.cancel())

    def set_memory_from_history(self, conf_uid, history_uid):
        raise LiveError("HISTORY_DISABLED")

    async def close(self):
        if self.interrupt_task:
            await asyncio.gather(self.interrupt_task, return_exceptions=True)
        await self.client.aclose()
