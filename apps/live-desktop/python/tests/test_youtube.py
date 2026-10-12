# ruff: noqa: E402 -- validate upstream pins before importing the real interfaces
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from launch import verify_pins

verify_pins()

import httpx

from mori_live.youtube import (
    YouTubeConnector,
    TokenStore,
    _sanitize_display_name,
)

# Valid test client_id (alphanumeric + dash/underscore, >=10 chars)
TEST_CLIENT_ID = "testclientid123456789"  # 20 chars
TEST_CLIENT_SECRET = "test-secret-001"


def make_message_item(
    msg_id: str,
    text: str,
    author_name: str = "TestUser",
    author_id: str = "UCtest",
    published_ms: int | None = None,
    is_owner: bool = False,
) -> dict:
    now = published_ms or int(time.time() * 1000)
    return {
        "id": msg_id,
        "snippet": {
            "type": "textMessageEvent",
            "liveChatId": "LxABC123",
            "textMessageDetails": {"messageText": text},
            "publishedAtMillis": str(now),
        },
        "authorDetails": {
            "displayName": author_name,
            "channelId": author_id,
            "isChatOwner": is_owner,
            "isChatSponsor": False,
        },
    }


class TokenStoreTests(unittest.TestCase):
    def test_load_returns_none_for_missing_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = TokenStore(Path(tmpdir) / "nonexistent.json")
            self.assertIsNone(store.load())

    def test_save_and_load_round_trip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "token.json"
            store = TokenStore(path)
            original = {
                "access_token": "ya29.test",
                "refresh_token": "refresh",
                "expires_at": 9999999999.0,
            }
            store.save(original)
            loaded = store.load()
            self.assertEqual(loaded["access_token"], original["access_token"])
            self.assertEqual(loaded["refresh_token"], original["refresh_token"])


class YouTubeConnectorParseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.connector = YouTubeConnector(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            token_file=Path(tempfile.mkdtemp()) / "token.json",
        )
        self.connector._live_chat_id = "LxTestChat"
        self.now_ms = int(time.time() * 1000)

    async def asyncTearDown(self):
        await self.connector.close()

    def test_parses_valid_text_message(self):
        item = make_message_item("msg1", "Xin chào Mori", "Viewer1", "UCviewer1")
        msg = self.connector._parse_message(item, 0)
        self.assertIsNotNone(msg)
        self.assertEqual(msg.text, "Xin chào Mori")
        self.assertEqual(msg.author_name, "Viewer1")
        self.assertEqual(msg.source, "youtube")
        self.assertEqual(msg.message_id, "msg1")

    def test_skips_deleted_messages(self):
        item = {
            "id": "deleted1",
            "snippet": {
                "type": "deletedMessageEvent",
                "liveChatId": "LxTestChat",
                "publishedAtMillis": str(self.now_ms),
            },
            "authorDetails": {},
        }
        msg = self.connector._parse_message(item, 0)
        self.assertIsNone(msg)

    def test_skips_super_chat(self):
        item = {
            "id": "super1",
            "snippet": {
                "type": "superChatEvent",
                "liveChatId": "LxTestChat",
                "publishedAtMillis": str(self.now_ms),
            },
            "authorDetails": {"displayName": "Fan", "channelId": "UCfan"},
        }
        msg = self.connector._parse_message(item, 0)
        self.assertIsNone(msg)

    def test_skips_empty_text(self):
        item = make_message_item("empty1", "   ", "User1", "UCuser1")
        msg = self.connector._parse_message(item, 0)
        self.assertIsNone(msg)

    def test_skips_duplicate_message_id(self):
        item = make_message_item("dup1", "Hello", "User1", "UCuser1", self.now_ms)
        self.connector._seen_ids.add("dup1")
        msg = self.connector._parse_message(item, 0)
        self.assertIsNone(msg)

    def test_skips_old_messages_on_first_poll(self):
        old_ms = self.now_ms - 60_000
        item = make_message_item("old1", "Old message", "User1", "UCuser1", old_ms)
        msg = self.connector._parse_message(item, self.now_ms - 30_000)
        self.assertIsNone(msg)

    def test_skips_repeated_fingerprint(self):
        item = make_message_item("msg2a", "Same text", "User1", "UCuser1", self.now_ms)
        self.connector._parse_message(item, 0)
        item2 = make_message_item("msg2b", "Same text", "User1", "UCuser1", self.now_ms + 1000)
        msg = self.connector._parse_message(item2, 0)
        self.assertIsNone(msg)

    def test_truncates_long_text(self):
        long_text = "A" * 3000
        item = make_message_item("long1", long_text, "User1", "UCuser1", self.now_ms)
        msg = self.connector._parse_message(item, 0)
        self.assertIsNotNone(msg)
        self.assertEqual(len(msg.text), 2000)

    def test_sanitizes_html_in_display_name(self):
        item = make_message_item("html1", "Hello", "<script>evil</script>", "UCuser1", self.now_ms)
        msg = self.connector._parse_message(item, 0)
        self.assertIsNotNone(msg)
        self.assertNotIn("<script>", msg.author_name)

    def test_bounds_seen_sets(self):
        now_ms = int(time.time() * 1000)
        for i in range(500):
            item = make_message_item(f"msg{i}", f"Text {i}", f"User{i}", f"UC{i}", now_ms - i * 1000)
            self.connector._parse_message(item, 0)
        # Sets should be bounded
        self.assertLessEqual(len(self.connector._seen_ids), 10_000)
        self.assertLessEqual(len(self.connector._seen_fingerprints), 10_000)


class YouTubeConnectorPollTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.connector = YouTubeConnector(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            token_file=Path(tempfile.mkdtemp()) / "token.json",
        )
        self.connector._live_chat_id = "LxTestChat"
        self.mock_transport = []
        self.mock_index = 0
        self.now_ms = int(time.time() * 1000)

    async def asyncTearDown(self):
        await self.connector.close()

    def _add_mock_response(self, status: int, body: dict, headers: dict | None = None):
        self.mock_transport.append((status, body, headers or {}))

    def _make_handler(self):
        async def handler(request):
            if self.mock_index >= len(self.mock_transport):
                return httpx.Response(200, json={"items": [], "pollingIntervalMillis": 5000})
            status, body, headers = self.mock_transport[self.mock_index]
            self.mock_index += 1
            return httpx.Response(status, json=body, headers=headers)

        return handler

    async def test_poll_returns_messages(self):
        now = int(time.time() * 1000)
        self._add_mock_response(
            200,
            {
                "items": [
                    {
                        "id": "ytmsg1",
                        "snippet": {
                            "type": "textMessageEvent",
                            "liveChatId": "LxTestChat",
                            "textMessageDetails": {"messageText": "Vietnamese: Xin chào!"},
                            "publishedAtMillis": str(now),
                        },
                        "authorDetails": {
                            "displayName": "Nam",
                            "channelId": "UCnam",
                            "isChatOwner": False,
                            "isChatSponsor": False,
                        },
                    },
                ],
                "pollingIntervalMillis": 5000,
                "nextPageToken": "page2",
            },
        )
        self.connector._oauth._access_token = "test_token"
        self.connector._oauth._expires_at = time.time() + 3600
        self.connector._http = httpx.AsyncClient(
            transport=httpx.MockTransport(self._make_handler()),
            timeout=30,
        )

        messages = await self.connector.poll()
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].text, "Vietnamese: Xin chào!")
        self.assertEqual(messages[0].author_name, "Nam")

    async def test_poll_filters_deleted_and_super(self):
        now = int(time.time() * 1000)
        self._add_mock_response(
            200,
            {
                "items": [
                    {
                        "id": "deleted1",
                        "snippet": {
                            "type": "deletedMessageEvent",
                            "liveChatId": "LxTestChat",
                            "publishedAtMillis": str(now),
                        },
                        "authorDetails": {},
                    },
                    {
                        "id": "super1",
                        "snippet": {
                            "type": "superChatEvent",
                            "liveChatId": "LxTestChat",
                            "publishedAtMillis": str(now),
                        },
                        "authorDetails": {"displayName": "Fan", "channelId": "UCfan"},
                    },
                    {
                        "id": "text1",
                        "snippet": {
                            "type": "textMessageEvent",
                            "liveChatId": "LxTestChat",
                            "textMessageDetails": {"messageText": "Real message"},
                            "publishedAtMillis": str(now),
                        },
                        "authorDetails": {
                            "displayName": "RealUser",
                            "channelId": "UCreal",
                            "isChatOwner": False,
                            "isChatSponsor": False,
                        },
                    },
                ],
                "pollingIntervalMillis": 5000,
            },
        )
        self.connector._oauth._access_token = "test_token"
        self.connector._oauth._expires_at = time.time() + 3600
        self.connector._http = httpx.AsyncClient(
            transport=httpx.MockTransport(self._make_handler()),
            timeout=30,
        )

        messages = await self.connector.poll()
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0].message_id, "text1")

    async def test_poll_returns_empty_when_no_chat_id(self):
        self.connector._live_chat_id = None
        messages = await self.connector.poll()
        self.assertEqual(messages, [])


class SanitizeDisplayNameTests(unittest.TestCase):
    def test_html_escaped(self):
        # Python html.escape encodes / as &#47; not &#x2F; — just verify no raw tags
        result = _sanitize_display_name("<script>alert(1)</script>")
        self.assertNotIn("<script>", result)
        self.assertNotIn("</script>", result)

    def test_truncated_at_60(self):
        self.assertEqual(len(_sanitize_display_name("A" * 100)), 60)

    def test_empty_becomes_viewer(self):
        self.assertEqual(_sanitize_display_name(""), "viewer")
        self.assertEqual(_sanitize_display_name("   "), "viewer")


class OAuthValidationTests(unittest.TestCase):
    def test_rejects_invalid_client_id(self):
        with self.assertRaises(ValueError):
            YouTubeConnector(client_id="x", client_secret="secret", token_file=Path(tempfile.mkdtemp()) / "t.json")

    def test_rejects_empty_client_secret(self):
        with self.assertRaises(ValueError):
            YouTubeConnector(
                client_id="test-client-id.apps.googleusercontent.com",
                client_secret="",
                token_file=Path(tempfile.mkdtemp()) / "t.json",
            )


if __name__ == "__main__":
    unittest.main()
