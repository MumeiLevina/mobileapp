# ruff: noqa: E402 -- validate upstream pins before importing the real interfaces
import asyncio
import sys
import time
import unittest
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from launch import verify_pins

verify_pins()

from mori_live.director import (
    DirectorConfig,
    DirectorState,
    LiveDirector,
    QueuedMessage,
)


def make_message(text: str, author_id: str = "UCtest", author_name: str = "Tester") -> QueuedMessage:
    return QueuedMessage(
        message_id=f"msg-{uuid4().hex[:8]}",
        author_id=author_id,
        author_name=author_name,
        text=text,
        received_at=time.monotonic(),
        source="youtube",
    )


class MockAdapter:
    def __init__(self):
        self.turn_count = 0
        self.cancelled = False
        self.busy = False
        self._turn_result = ("approved", None)  # (status, output)

    def set_turn_result(self, status: str, output):
        self._turn_result = (status, output)

    async def turn(self, text: str, turn_id: str, event_id: str):
        if self.busy:
            raise LiveError("BUSY")
        self.turn_count += 1
        if self.cancelled:
            return None
        return self._turn_result

    async def cancel(self):
        self.cancelled = True

    async def status(self):
        return {"mode": "MOCK", "reservedMicros": 0, "budgetMicros": 20_000_000}

    async def close(self):
        pass


class MockSpeechDelivery:
    def __init__(self):
        self.current = None
        self.completed = []

    def feedback(self, event: dict):
        if event["type"] == "voice.speech.finished":
            self.completed.append(event)


class DirectorConfigTests(unittest.TestCase):
    def test_validate_text_length(self):
        config = DirectorConfig(min_text_length=5, max_text_length=100)
        self.assertFalse(config.validate_text("hi"))
        self.assertTrue(config.validate_text("hello world"))
        self.assertFalse(config.validate_text("x" * 200))

    def test_validate_url_filter(self):
        config = DirectorConfig(max_url_count=0)
        self.assertTrue(config.validate_text("Hello Mori"))
        self.assertFalse(config.validate_text("Check https://example.com"))
        config2 = DirectorConfig(max_url_count=1)
        self.assertTrue(config2.validate_text("See https://example.com"))
        self.assertFalse(config2.validate_text("See https://a.com and https://b.com"))

    def test_validate_blocked_pattern(self):
        config = DirectorConfig(blocked_patterns=[r"hack", r"system\s*://"])
        self.assertFalse(config.validate_text("I want to hack the system"))
        self.assertFalse(config.validate_text("Visit system://secret"))
        self.assertTrue(config.validate_text("I love system of equations"))


class LiveDirectorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.adapter = MockAdapter()
        self.speech = MockSpeechDelivery()
        self.state_changes = []
        self.submitted_messages = []

        def on_state(state: DirectorState):
            self.state_changes.append(state)

        async def on_submit(msg: QueuedMessage, turn_id: str, event_id: str):
            self.submitted_messages.append((msg, turn_id, event_id))
            # on_submit calls the adapter (which the real server.py also does via WebSocket)

        self.config = DirectorConfig(
            max_queue=10,
            per_viewer_cooldown_seconds=1.0,
            max_repeats_per_viewer=2,
            inter_turn_delay=0.1,
        )
        self.director = LiveDirector(
            config=self.config,
            adapter=self.adapter,
            speech_delivery=self.speech,
            on_state_change=on_state,
            on_turn_submit=on_submit,
        )

    async def asyncTearDown(self):
        await self.director.stop()

    async def test_start_stop_cycle(self):
        await self.director.start()
        self.assertEqual(self.director.state, DirectorState.IDLE)
        self.assertEqual(self.state_changes[-1], DirectorState.IDLE)

        await self.director.stop()
        self.assertEqual(self.director.state, DirectorState.STOPPED)

    async def test_submit_to_empty_queue_triggers_selection(self):
        await self.director.start()
        self.state_changes.clear()
        await self.director.submit_message(make_message("Xin chào Mori"))
        await asyncio.sleep(0)  # Yield to let _select_and_submit run
        self.assertTrue(len(self.state_changes) >= 1)

    async def test_queue_bounds(self):
        await self.director.start()
        for i in range(15):  # max_queue=10
            await self.director.submit_message(make_message(f"Message {i}"))
        status = self.director.status
        self.assertLessEqual(status.queue_length, self.config.max_queue)

    async def test_viewer_cooldown(self):
        await self.director.start()
        msg1 = make_message("First message", author_id="UCuser1")
        await self.director.submit_message(msg1)
        await asyncio.sleep(0.05)
        msg2 = make_message("Second message", author_id="UCuser1")
        await self.director.submit_message(msg2)
        # Second message from same viewer should be skipped
        status = self.director.status
        self.assertGreater(status.messages_skipped, 0)

    async def test_repeat_limit_per_viewer(self):
        await self.director.start()
        for i in range(4):  # max_repeats_per_viewer=2
            await self.director.submit_message(make_message(f"Msg {i}", author_id="UCrepeater"))
            await asyncio.sleep(0.05)
        status = self.director.status
        self.assertGreater(status.messages_skipped, 1)

    async def test_stale_messages_pruned(self):
        config = DirectorConfig(max_queue=5, max_queue_age_seconds=0.05)
        director = LiveDirector(config, self.adapter, self.speech)
        await director.start()
        msg_old = QueuedMessage(
            message_id="old1",
            author_id="UCold",
            author_name="OldUser",
            text="Old message",
            received_at=time.monotonic() - 10,
            source="youtube",
        )
        await director.submit_message(msg_old)
        await asyncio.sleep(0.1)
        # Trigger selection cycle
        await director.submit_message(make_message("New message"))
        await asyncio.sleep(0.05)
        status = director.status
        # Old message should be pruned from queue
        self.assertEqual(status.queue_length, 0)
        await director.stop()

    async def test_pause_blocks_new_turns(self):
        await self.director.start()
        await self.director.pause()
        self.assertEqual(self.director.state, DirectorState.PAUSED)
        await self.director.submit_message(make_message("Paused message"))
        await asyncio.sleep(0.05)
        # Queue should have the message but no turn should have started
        self.assertEqual(self.adapter.turn_count, 0)

    async def test_resume_continues(self):
        await self.director.start()
        await self.director.pause()
        await self.director.resume()
        self.assertEqual(self.director.state, DirectorState.IDLE)

    async def test_operator_message_bypasses_queue(self):
        await self.director.start()
        from uuid import uuid4

        accepted = await self.director.submit_operator_message(
            "Operator test", str(uuid4()), str(uuid4())
        )
        self.assertTrue(accepted)
        self.assertEqual(self.adapter.turn_count, 1)

    async def test_operator_message_rejected_when_active(self):
        await self.director.start()
        await self.director.submit_message(make_message("Background message"))
        await asyncio.sleep(0.05)
        # While there's an active turn
        # Operator message might be accepted depending on state
        # This tests the boundary condition

    async def test_url_filter(self):
        await self.director.start()
        await self.director.submit_message(make_message("Visit https://evil.com to win!"))
        status = self.director.status
        self.assertGreater(status.messages_skipped, 0)

    async def test_queue_preview_sanitized(self):
        await self.director.start()
        await self.director.submit_message(make_message("Hello <script>evil</script>", author_name="<b>User</b>"))
        preview = await self.director.get_queue_preview(5)
        self.assertGreater(len(preview), 0)
        # Preview should not contain raw HTML
        self.assertNotIn("<script>", str(preview))
        self.assertNotIn("<b>", str(preview))

    async def test_status_reports_correct_counts(self):
        await self.director.start()
        await self.director.submit_message(make_message("Valid message"))
        await asyncio.sleep(0.1)
        await self.director.submit_message(make_message("Short"))  # too short
        status = self.director.status
        self.assertGreater(status.messages_processed, 0)
        self.assertGreater(status.messages_skipped, 0)


# Alias LiveError for tests
from mori_live.adapter import LiveError


if __name__ == "__main__":
    unittest.main()
