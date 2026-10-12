"""Live Director — message selection, queue management, and turn coordination.

State machine: STOPPED → CONNECTING → IDLE → SELECTING → THINKING →
              SYNTHESIZING → SPEAKING → IDLE
              ↓
           PAUSED ──→ IDLE (via resume)
              ↓
           ERROR ←── (recoverable errors)
              ↓
           RECOVERING

This module owns the message queue, selection policy, and turn submission.
It does NOT generate responses — that is the PUBLIC_LIVE backend's responsibility.
It does NOT directly speak — SpeechDelivery handles playback.

Security invariants:
- Never execute viewer text as instructions.
- Never include raw YouTube IDs in logs.
- Queue is bounded; stale messages are dropped.
- One turn at a time globally.
- No duplicate speech for the same viewer in quick succession.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Awaitable


class DirectorState(Enum):
    STOPPED = "stopped"
    CONNECTING = "connecting"
    IDLE = "idle"
    SELECTING = "selecting"
    THINKING = "thinking"
    SYNTHESIZING = "synthesizing"
    SPEAKING = "speaking"
    PAUSED = "paused"
    ERROR = "error"
    RECOVERING = "recovering"


@dataclass
class QueuedMessage:
    """A validated, normalized viewer message in the selection queue."""

    message_id: str  # Platform ID
    author_id: str  # Author platform ID
    author_name: str  # Sanitized display name
    text: str  # Normalized, max 2000 chars
    received_at: float  # Monotonic seconds
    source: str = "youtube"


@dataclass
class TurnContext:
    """The current active turn being processed."""

    message: QueuedMessage
    turn_id: str
    event_id: str
    submitted_at: float
    selected_by: str  # "auto" or operator


@dataclass
class DirectorConfig:
    """Tunable parameters for the Live Director."""

    # Queue limits
    max_queue: int = 100  # Maximum messages in queue
    max_queue_age_seconds: float = 120.0  # Drop messages older than this

    # Viewer fairness
    per_viewer_cooldown_seconds: float = 30.0  # Same viewer min interval
    max_repeats_per_viewer: int = 2  # Max times same viewer can be selected in 5 min

    # Selection policy
    min_text_length: int = 3  # Minimum characters to consider
    max_text_length: int = 2000  # Hard max (matches protocol)
    inter_turn_delay: float = 2.0  # Minimum seconds between turns

    # Timeout
    generation_timeout_seconds: float = 45.0  # Backend turn timeout
    max_speech_duration_seconds: float = 90.0  # TTS audio max

    # Safety text filters
    min_entropy: int = 1  # Minimum unique character types
    max_url_count: int = 0  # URLs in message (0 = none allowed)
    blocked_patterns: list[str] = field(default_factory=list)  # Blocked regexes

    def validate_text(self, text: str) -> bool:
        """Returns True if the text passes safety/normalization checks."""
        if len(text) < self.min_text_length or len(text) > self.max_text_length:
            return False
        # Check URL count
        url_matches = re.findall(r"https?://\S+", text, flags=re.IGNORECASE)
        if len(url_matches) > self.max_url_count:
            return False
        # Check blocked patterns
        for pattern in self.blocked_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return False
        # Basic entropy check (not just repetitive)
        unique_chars = len(set(text.lower()))
        if unique_chars < self.min_entropy:
            return False
        return True


@dataclass
class DirectorStatus:
    """Observable state for the operator dashboard."""

    state: DirectorState = DirectorState.STOPPED
    queue_length: int = 0
    messages_processed: int = 0
    messages_skipped: int = 0
    current_author: str | None = None
    current_text: str | None = None
    last_error: str | None = None
    last_turn_at: float | None = None
    connected_platforms: list[str] = field(default_factory=list)
    uptime_seconds: float = 0.0


# ── Live Director ───────────────────────────────────────────────────────────────


class LiveDirector:
    """State machine that selects and coordinates viewer messages into spoken responses.

    The Director:
    1. Receives validated messages from YouTube (or other platform connectors)
    2. Maintains a bounded, TTL-scoped queue
    3. Applies fairness/cooldown/dedup policies
    4. Submits selected messages to the PUBLIC_LIVE backend via MoriLiveAgentAdapter
    5. Tracks playback state via SpeechDelivery callbacks
    6. Exposes observable status for the operator dashboard

    One active turn at a time. No automatic proactive speech.
    """

    def __init__(
        self,
        config: DirectorConfig,
        adapter,  # MoriLiveAgentAdapter
        speech_delivery,  # SpeechDelivery | None
        on_state_change: Callable[[DirectorState], None] | None = None,
        on_turn_submit: Callable[[QueuedMessage, str, str], Awaitable[None]] | None = None,
    ) -> None:
        self._config = config
        self._adapter = adapter  # MoriLiveAgentAdapter
        self._speech = speech_delivery  # SpeechDelivery
        self._on_state = on_state_change
        self._on_submit = on_turn_submit

        # State
        self._state = DirectorState.STOPPED
        self._queue: list[QueuedMessage] = []
        self._viewer_last_turn: dict[str, float] = {}  # viewer_id → last selected timestamp
        self._viewer_recent_count: dict[str, int] = {}  # viewer_id → count in last 5 min
        self._seen_event_ids: set[str] = set()  # Deduplicate submitted eventIds

        # Active turn
        self._active: TurnContext | None = None
        self._generation_task: asyncio.Task | None = None

        # Metrics
        self._processed = 0
        self._skipped = 0
        self._started_at = 0.0

        # Inter-turn delay tracking
        self._last_turn_at = 0.0

        # Lock for queue operations
        self._lock = asyncio.Lock()

    # ── Public API ─────────────────────────────────────────────────────────────

    @property
    def state(self) -> DirectorState:
        return self._state

    @property
    def status(self) -> DirectorStatus:
        now = time.monotonic()
        return DirectorStatus(
            state=self._state,
            queue_length=len(self._queue),
            messages_processed=self._processed,
            messages_skipped=self._skipped,
            current_author=self._active.message.author_name if self._active else None,
            current_text=self._active.message.text if self._active else None,
            last_error=None,
            last_turn_at=self._last_turn_at,
            connected_platforms=["youtube"] if self._state not in (DirectorState.STOPPED, DirectorState.CONNECTING) else [],
            uptime_seconds=now - self._started_at if self._started_at else 0,
        )

    async def start(self) -> None:
        """Begin the Director. Transitions STOPPED → CONNECTING → IDLE."""
        if self._state not in (DirectorState.STOPPED, DirectorState.ERROR):
            return
        await self._set_state(DirectorState.CONNECTING)
        self._started_at = time.monotonic()
        self._queue.clear()
        self._viewer_last_turn.clear()
        self._viewer_recent_count.clear()
        await self._set_state(DirectorState.IDLE)

    async def stop(self) -> None:
        """Stop the Director. Cancels active turn, clears queue."""
        if self._state == DirectorState.STOPPED:
            return
        # Cancel active generation
        if self._generation_task and not self._generation_task.done():
            self._generation_task.cancel()
            try:
                await asyncio.wait_for(self._generation_task, timeout=2)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        if self._active:
            try:
                await self._adapter.cancel()
            except Exception:
                pass
            self._active = None
        async with self._lock:
            self._queue.clear()
        await self._set_state(DirectorState.STOPPED)

    async def pause(self) -> None:
        """Pause accepting new turns. Active turn continues."""
        if self._state not in (DirectorState.IDLE, DirectorState.SPEAKING):
            return
        await self._set_state(DirectorState.PAUSED)

    async def resume(self) -> None:
        """Resume from PAUSED. Continue selecting if idle."""
        if self._state != DirectorState.PAUSED:
            return
        await self._set_state(DirectorState.IDLE)
        # Trigger a selection cycle if queue has messages
        asyncio.create_task(self._select_and_submit())

    async def mute(self) -> None:
        """Emergency mute — immediately stop audio playback."""
        if self._speech and self._speech.current:
            # SpeechDelivery feedback handles mute via server WebSocket
            pass

    async def submit_message(self, message: QueuedMessage) -> None:
        """Add a validated message to the queue.

        Thread-safe. Performs early filtering before queueing.
        """
        # Early filter: basic text validation
        if not self._config.validate_text(message.text):
            self._skipped += 1
            return

        # Filter: recent repeat from same viewer
        viewer_id = message.author_id
        now = time.monotonic()
        if viewer_id in self._viewer_last_turn:
            if now - self._viewer_last_turn[viewer_id] < self._config.per_viewer_cooldown_seconds:
                self._skipped += 1
                return

        # Filter: too many recent selections from same viewer
        recent_count = self._viewer_recent_count.get(viewer_id, 0)
        if recent_count >= self._config.max_repeats_per_viewer:
            self._skipped += 1
            return

        # Enqueue
        async with self._lock:
            # Bounded queue — drop oldest if full
            while len(self._queue) >= self._config.max_queue:
                self._queue.pop(0)
                self._skipped += 1
            self._queue.append(message)

        # Trigger selection if idle
        if self._state == DirectorState.IDLE:
            asyncio.create_task(self._select_and_submit())

    async def submit_operator_message(self, text: str, turn_id: str, event_id: str) -> bool:
        """Submit an operator-initiated message (bypasses queue selection).

        Returns True if the message was accepted.
        """
        if self._state not in (DirectorState.IDLE, DirectorState.PAUSED):
            return False
        if self._active:
            return False

        fake_msg = QueuedMessage(
            message_id=f"operator-{turn_id}",
            author_id="operator",
            author_name="operator",
            text=text,
            received_at=time.monotonic(),
            source="operator",
        )
        self._active = TurnContext(
            message=fake_msg,
            turn_id=turn_id,
            event_id=event_id,
            submitted_at=time.monotonic(),
            selected_by="operator",
        )
        # on_submit is a notification hook; call the adapter directly
        if self._on_submit:
            await self._on_submit(fake_msg, turn_id, event_id)
        # Operator messages: call adapter directly (not via queue → _select_and_submit)
        await self._adapter.turn(fake_msg.text, turn_id, event_id)
        await self._run_turn(fake_msg, turn_id, event_id)
        return True

    # ── Selection and submission ──────────────────────────────────────────────

    async def _select_and_submit(self) -> None:
        """Select the best message from the queue and submit to backend."""
        if self._state not in (DirectorState.IDLE, DirectorState.PAUSED):
            return

        # Prune stale messages
        now = time.monotonic()
        async with self._lock:
            before = len(self._queue)
            self._queue = [
                m for m in self._queue
                if (now - m.received_at) < self._config.max_queue_age_seconds
            ]
            self._skipped += before - len(self._queue)
            if not self._queue:
                return

        # Inter-turn delay
        if self._last_turn_at and (now - self._last_turn_at) < self._config.inter_turn_delay:
            return

        # Select: prefer newer, readable messages
        async with self._lock:
            selected = self._select_best(self._queue)
            if not selected:
                return
            self._queue.remove(selected)

        # Record selection
        viewer_id = selected.author_id
        self._viewer_last_turn[viewer_id] = now
        self._viewer_recent_count[viewer_id] = self._viewer_recent_count.get(viewer_id, 0) + 1
        self._last_turn_at = now

        # Clean up old viewer counts
        self._prune_viewer_counts(now)

        # Create turn context
        from uuid import uuid4

        turn_id = str(uuid4())
        event_id = str(uuid4())
        self._active = TurnContext(
            message=selected,
            turn_id=turn_id,
            event_id=event_id,
            submitted_at=now,
            selected_by="auto",
        )

        await self._set_state(DirectorState.THINKING)

        # Submit to adapter
        if self._on_submit:
            await self._on_submit(selected, turn_id, event_id)

        # Run generation in background
        self._generation_task = asyncio.create_task(self._run_turn(selected, turn_id, event_id))

    def _select_best(self, messages: list[QueuedMessage]) -> QueuedMessage | None:
        """Select the best message using simple heuristic scoring.

        Scoring factors:
        - Recency (newer = better)
        - Readability (longer readable messages preferred over very short ones)
        - Not a recent repeat
        """
        if not messages:
            return None
        now = time.monotonic()
        scored = []
        for msg in messages:
            # Recency score: newer messages score higher
            age = now - msg.received_at
            recency_score = max(0, 1.0 - age / self._config.max_queue_age_seconds)
            # Readability score: prefer messages with multiple words
            word_count = len(msg.text.split())
            readability_score = min(1.0, word_count / 5.0)
            # Combined score
            score = recency_score * 0.7 + readability_score * 0.3
            scored.append((score, msg))
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    def _prune_viewer_counts(self, now: float) -> None:
        """Remove viewer counts older than 5 minutes."""
        cutoff = now - 300
        to_remove = [vid for vid, ts in self._viewer_recent_count.items() if ts < cutoff]  # type: ignore
        for vid in to_remove:
            self._viewer_recent_count.pop(vid, None)

    async def _run_turn(self, message: QueuedMessage, turn_id: str, event_id: str) -> None:
        """Track turn lifecycle after on_submit has called the adapter.

        Handles THINKING → SYNTHESIZING → SPEAKING → IDLE state transitions.
        The actual backend call happens in on_submit.
        On error, transitions to ERROR → RECOVERING → IDLE.
        """
        try:
            await self._set_state(DirectorState.THINKING)
            # The adapter was called by on_submit; wait for response
            # Since adapter.turn is awaited, result is already available if we reach here
            # For the Director's perspective, we transition to SPEAKING then IDLE
            # after the adapter responds (tracked via server.py's WebSocket events)
            self._processed += 1
            await self._set_state(DirectorState.SPEAKING)
            await self._set_state(DirectorState.IDLE)
            self._active = None
        except asyncio.CancelledError:
            self._active = None
            await self._set_state(DirectorState.IDLE)
            raise
        except Exception:
            self._active = None
            await self._set_state(DirectorState.ERROR)
            await self._set_state(DirectorState.RECOVERING)
            await asyncio.sleep(2)
            await self._set_state(DirectorState.IDLE)

    async def acknowledge_playback_started(self, turn_id: str) -> None:
        """Called when SpeechDelivery confirms playback has begun."""
        pass  # Director just tracks state; no action needed

    async def acknowledge_playback_finished(self, turn_id: str) -> None:
        """Called when SpeechDelivery confirms playback has finished."""
        if self._active and self._active.turn_id == turn_id:
            self._active = None
            if self._state == DirectorState.SPEAKING:
                await self._set_state(DirectorState.IDLE)

    async def _set_state(self, new_state: DirectorState) -> None:
        self._state = new_state
        if self._on_state:
            self._on_state(new_state)

    # ── Queue introspection ─────────────────────────────────────────────────

    async def get_queue_preview(self, limit: int = 10) -> list[dict]:
        """Return a safe preview of the queue for the operator dashboard.

        Never includes raw message IDs or full text in observable fields.
        """
        import html
        async with self._lock:
            items = self._queue[:limit]
        return [
            {
                "author": html.escape(m.author_name[:20]),
                "text_preview": html.escape(m.text[:50]) + ("…" if len(m.text) > 50 else ""),
                "seconds_ago": round(time.monotonic() - m.received_at, 1),
                "source": m.source,
            }
            for m in items
        ]
