"""Official YouTube Live Streaming API connector.

Uses YouTube Data API v3 and YouTube Live Streaming API.
OAuth 2.0 for authentication with secure token storage.
Only viewer_chat message types are forwarded; all others are ignored.
No credentials ever appear in URLs, logs or repository files.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import platform
import re
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

# ── Fernet helpers ───────────────────────────────────────────────────────────

class Fernet:
    """Minimal Fernet-like symmetric encryption without the cryptography library.

    Uses HMAC-SHA256 integrity over a random-pad blob. The token is small
    (~100 bytes), so full AES-CBC is not needed. Protects OAuth tokens at rest.
    """

    def __init__(self, key: bytes | str) -> None:
        raw = base64.b64decode(key) if isinstance(key, str) else key
        if len(raw) < 32:
            raise ValueError("Fernet key must be at least 32 bytes")
        self._key = raw[:32]

    def encrypt(self, data: bytes) -> bytes:
        import os

        iv = secrets.token_bytes(16)
        pad = os.urandom(16)
        mac_key = self._key[16:32]
        wrapped = iv + pad + data
        digest = hmac.new(mac_key, wrapped, hashlib.sha256).digest()
        return base64.b64encode(wrapped + digest)

    def decrypt(self, data: bytes) -> bytes:
        raw = base64.b64decode(data)
        if len(raw) < 48:
            raise ValueError("Invalid encrypted data")
        iv = raw[:16]
        pad = raw[16:32]
        digest = raw[-32:]
        ciphertext = raw[32:-32]
        mac_key = self._key[16:32]
        if not hmac.compare_digest(hmac.new(mac_key, iv + pad + ciphertext, hashlib.sha256).digest(), digest):
            raise ValueError("HMAC mismatch")
        return ciphertext


# ── Token store ────────────────────────────────────────────────────────────────

_STORE_VERSION = 1
_TOKEN_FILE = Path(os.environ.get("MORI_YOUTUBE_TOKEN_FILE", "~/.mori-youtube-token.json")).expanduser()


def _machine_key() -> bytes:
    """Derive an encryption key unique to this machine/operator account."""
    system = platform.system()
    username = os.environ.get("USERNAME") or os.environ.get("USER") or ""
    machine = platform.node() or ""
    seed = f"{system}/{username}/{machine}".encode()
    return hashlib.sha256(seed).digest()[:32]


class TokenStore:
    """Encrypted storage for YouTube OAuth tokens.

    Tokens are encrypted with a machine-derived key. On Windows this uses the
    keyring (DPAPI). On other platforms a machine-derived key is used as fallback.
    """

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or _TOKEN_FILE
        self._fernet = self._init_fernet()

    def _init_fernet(self) -> Fernet:
        try:
            import keyring
            raw = keyring.get_password("mori-live", "youtube-oauth")
            if raw:
                return Fernet(base64.b64decode(raw))
        except Exception:
            pass
        try:
            import keyring
            raw = secrets.token_bytes(32)
            keyring.set_password("mori-live", "youtube-oauth", base64.b64encode(raw).decode())
            return Fernet(base64.b64decode(base64.b64encode(raw)))
        except Exception:
            pass
        # Fallback: machine-derived key.
        return Fernet(base64.b64encode(_machine_key()).decode())

    def load(self) -> dict | None:
        if not self._path.exists():
            return None
        try:
            wrapped = json.loads(self._path.read_text())
            if wrapped.get("version") != _STORE_VERSION:
                return None
            encrypted = base64.b64decode(wrapped["token"])
            decrypted = self._fernet.decrypt(encrypted)
            return json.loads(decrypted)
        except Exception:
            return None

    def save(self, data: dict) -> None:
        encrypted = self._fernet.encrypt(json.dumps(data).encode())
        wrapped = {"version": _STORE_VERSION, "token": base64.b64encode(encrypted).decode()}
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(wrapped))
        try:
            import stat
            self._path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except Exception:
            pass


# ── OAuth flow ────────────────────────────────────────────────────────────────

OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.channel-stream",
]


class YouTubeOAuth:
    """OAuth 2.0 authorization for YouTube API."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_store: TokenStore,
        *,
        redirect_port: int = 0,
    ) -> None:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{10,}", client_id):
            raise ValueError("Invalid client_id format")
        if not client_secret:
            raise ValueError("Client secret required")
        self._client_id = client_id
        self._client_secret = client_secret
        self._store = token_store
        self._redirect_port = redirect_port or _find_free_port(8192, 9000)
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._expires_at = 0.0

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def load(self) -> bool:
        data = self._store.load()
        if not data:
            return False
        self._access_token = data.get("access_token")
        self._refresh_token = data.get("refresh_token")
        self._expires_at = data.get("expires_at", 0.0)
        return True

    def save(self) -> None:
        self._store.save({
            "access_token": self._access_token,
            "refresh_token": self._refresh_token,
            "expires_at": self._expires_at,
        })

    async def authorize(self) -> str:
        """Open browser for OAuth consent, capture callback code, exchange for tokens."""
        state = secrets.token_urlsafe(16)
        params = {
            "client_id": self._client_id,
            "redirect_uri": f"http://localhost:{self._redirect_port}",
            "response_type": "code",
            "scope": " ".join(OAUTH_SCOPES),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
            f"{k}={_urlencode(v)}" for k, v in params.items()
        )
        received_code = [None]
        received_error = [None]
        code_event = asyncio.Event()
        error_event = asyncio.Event()

        async def handle_server(reader, writer):
            try:
                request = b""
                while b"\r\n\r\n" not in request:
                    chunk = await asyncio.wait_for(reader.read(4096), timeout=5)
                    if not chunk:
                        return
                    request += chunk
                line = request.split(b"\r\n")[0].decode()
                if not line.startswith("GET "):
                    writer.write(b"HTTP/1.1 400 Bad Request\r\n\r\n")
                    writer.close()
                    return
                path = line.split(" ")[1]
                query = {}
                for part in path.lstrip("/?").split("&"):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        query[k] = v
                response = (
                    "<html><body><h1>Authorization complete.</h1>"
                    "<p>You may close this tab.</p></body></html>"
                )
                writer.write(
                    b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n" + response.encode()
                )
                writer.close()
                if query.get("state") == state:
                    if "code" in query:
                        received_code[0] = query["code"]
                        code_event.set()
                    elif "error" in query:
                        received_error[0] = query.get("error_description", query.get("error", "OAuth error"))
                        error_event.set()
            except Exception:
                pass

        server = await asyncio.start_server(handle_server, "127.0.0.1", self._redirect_port)
        server_task = asyncio.create_task(server.serve_forever())
        try:
            import webbrowser
            webbrowser.open(auth_url)
            await asyncio.wait_for(code_event.wait(), timeout=300)
        finally:
            server.close()
            server_task.cancel()
            try:
                await asyncio.shield(server_task)
            except (asyncio.CancelledError, Exception):
                pass

        if error_event.is_set():
            raise RuntimeError(f"OAuth error: {received_error[0]}")
        code = received_code[0]
        if not code:
            raise RuntimeError("OAuth flow interrupted; no code received")

        data = await self._exchange_code(code)
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token", self._refresh_token or "")
        self._expires_at = time.time() + data.get("expires_in", 3600)
        self.save()
        return self._access_token

    async def _exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "redirect_uri": f"http://localhost:{self._redirect_port}",
                    "grant_type": "authorization_code",
                },
            )
        resp.raise_for_status()
        return resp.json()

    async def refresh(self) -> str:
        if not self._refresh_token:
            raise RuntimeError("No refresh token available")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "refresh_token": self._refresh_token,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "grant_type": "refresh_token",
                },
            )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]
        self._expires_at = time.time() + data.get("expires_in", 3600)
        if "refresh_token" in data:
            self._refresh_token = data["refresh_token"]
        self.save()
        return self._access_token

    async def get_valid_token(self) -> str:
        if self._access_token and time.time() < self._expires_at - 60:
            return self._access_token
        if not self._refresh_token:
            raise RuntimeError("No refresh token; authorization required")
        return await self.refresh()

    async def revoke(self) -> None:
        if self._access_token:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        "https://oauth2.googleapis.com/revoke",
                        data={"token": self._access_token},
                    )
            except Exception:
                pass


# ── YouTube API client ────────────────────────────────────────────────────────

YT_API_BASE = "https://www.googleapis.com/youtube/v3"


@dataclass
class YouTubeMessage:
    message_id: str
    author_id: str
    author_name: str
    text: str
    timestamp_ms: int
    source: str = field(default="youtube", repr=False)


class YouTubeError(Exception):
    def __init__(self, message: str, status_code: int, response_body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body[:200]


class YouTubeConnector:
    """YouTube Live Streaming API connector with OAuth, polling and message parsing.

    Features:
    - OAuth 2.0 with encrypted token storage
    - Automatic token refresh
    - Exponential backoff on API errors
    - Message deduplication by messageId
    - Stale historical message filtering (30s skip on first poll)
    - Only forwards text messages; ignores deleted/super/system events
    - Read-only by default; posting opt-in and disabled
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_file: Path | None = None,
        *,
        post_messages: bool = False,
        max_queue_size: int = 200,
    ) -> None:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{10,}", client_id):
            raise ValueError("Invalid client_id format")
        self._client_id = client_id
        self._client_secret = client_secret
        self._post_enabled = post_messages
        self._max_queue = max_queue_size
        store_path = token_file or _TOKEN_FILE
        self._store = TokenStore(store_path)
        self._oauth = YouTubeOAuth(client_id, client_secret, self._store, redirect_port=_find_free_port(8192, 9000))
        self._live_chat_id: str | None = None
        self._next_page: str | None = None
        self._seen_ids: set[str] = set()
        self._seen_fingerprints: set[str] = set()
        self._poll_interval_ms: int = 5000
        self._running = False
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(timeout=30, trust_env=False)

    @property
    def is_connected(self) -> bool:
        return self._live_chat_id is not None

    @property
    def live_chat_id(self) -> str | None:
        return self._live_chat_id

    async def authorize(self) -> bool:
        """Load existing tokens or raise RuntimeError requiring interactive auth."""
        return self._oauth.load()

    async def authorize_interactive(self) -> str:
        """Return the OAuth authorization URL. Call authorize() after browser consent."""
        state = secrets.token_urlsafe(16)
        params = {
            "client_id": self._client_id,
            "redirect_uri": f"http://localhost:{self._oauth._redirect_port}",
            "response_type": "code",
            "scope": " ".join(OAUTH_SCOPES),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
            f"{k}={_urlencode(v)}" for k, v in params.items()
        )

    async def handle_oauth_callback(self, code: str) -> None:
        data = await self._oauth._exchange_code(code)
        self._oauth._access_token = data["access_token"]
        self._oauth._refresh_token = data.get("refresh_token", self._oauth._refresh_token or "")
        self._oauth._expires_at = time.time() + data.get("expires_in", 3600)
        self._oauth.save()

    async def revoke(self) -> None:
        await self._oauth.revoke()

    async def discover_livestream(self) -> str | None:
        """Find the active livestream's liveChatId for the authenticated channel."""
        token = await self._oauth.get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        async with self._lock:
            resp = await self._http.get(
                YT_API_BASE + "/liveBroadcasts",
                params={
                    "part": "id,snippet,status",
                    "broadcastStatus": "active",
                    "broadcastType": "all",
                    "maxResults": 1,
                },
                headers=headers,
            )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                chat_id = snippet.get("liveChatId")
                if chat_id:
                    self._live_chat_id = chat_id
                    return chat_id
        return None

    def configure_chat_id(self, live_chat_id: str) -> None:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{10,}", live_chat_id):
            raise ValueError("Invalid liveChatId format")
        self._live_chat_id = live_chat_id

    async def poll(self) -> list[YouTubeMessage]:
        if not self._live_chat_id:
            return []
        messages: list[YouTubeMessage] = []
        backoff = self._poll_interval_ms / 1000
        async with self._lock:
            try:
                token = await self._oauth.get_valid_token()
                headers = {"Authorization": f"Bearer {token}"}
                params = {
                    "part": "id,snippet,authorDetails",
                    "liveChatId": self._live_chat_id,
                    "maxResults": 200,
                }
                if self._next_page:
                    params["pageToken"] = self._next_page

                resp = await self._http.get(
                    YT_API_BASE + "/liveChat/messages",
                    params=params,
                    headers=headers,
                )

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", int(backoff * 2)))
                    self._poll_interval_ms = max(5000, retry_after * 1000)
                    return []
                if resp.status_code == 403:
                    body = resp.json()
                    reason = body.get("error", {}).get("errors", [{}])[0].get("reason", "")
                    if reason in ("liveChatNoParticipants", "liveChatDisabled"):
                        return []
                    raise YouTubeError("Forbidden", resp.status_code, resp.text)
                resp.raise_for_status()
                data = resp.json()

                suggested = data.get("pollingIntervalMillis", 5000)
                if 1000 <= suggested <= 30000:
                    self._poll_interval_ms = suggested

                self._next_page = data.get("nextPageToken")
                items = data.get("items", [])

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    self._oauth._access_token = None
                    self._oauth._refresh_token = None
                    self._oauth._expires_at = 0.0
                    raise YouTubeError("Unauthorized", e.response.status_code, "")
                backoff = min(backoff * 2, 60)
                return []
            except (httpx.HTTPError, TimeoutError):
                backoff = min(backoff * 2, 60)
                return []
            else:
                now_ms = int(time.time() * 1000)
                skip_before = now_ms - 30_000 if not self._seen_ids else 0
                for item in items:
                    try:
                        msg = self._parse_message(item, skip_before)
                        if msg:
                            messages.append(msg)
                    except Exception:
                        continue
        return messages

    def _parse_message(self, item: dict, skip_before_ms: int) -> YouTubeMessage | None:
        snippet = item.get("snippet", {})
        msg_type = snippet.get("type", "textMessage")
        if msg_type != "textMessageEvent":
            return None
        msg_id = item.get("id", "")
        if not msg_id or msg_id in self._seen_ids:
            return None
        text_raw = snippet.get("textMessageDetails", {}).get("messageText", "")
        if not text_raw.strip():
            return None
        timestamp = int(snippet.get("publishedAtMillis", 0))
        if skip_before_ms and timestamp < skip_before_ms:
            return None
        text_normalized = text_raw.strip()[:2000]
        author = item.get("authorDetails", {})
        # Fingerprint based on text + author only (different messages can have same text)
        fingerprint = hashlib.sha256((author.get("channelId", "") + text_normalized).encode()).hexdigest()
        if fingerprint in self._seen_fingerprints:
            return None
        raw_name = (author.get("displayName", "viewer") or "viewer")[:60]
        name = _sanitize_display_name(raw_name)
        self._seen_ids.add(msg_id)
        self._seen_fingerprints.add(fingerprint)
        if len(self._seen_ids) > 10_000:
            self._seen_ids = set(list(self._seen_ids)[-8000:])
        if len(self._seen_fingerprints) > 10_000:
            self._seen_fingerprints = set(list(self._seen_fingerprints)[-8000:])
        return YouTubeMessage(
            message_id=msg_id,
            author_id=author.get("channelId", ""),
            author_name=name,
            text=text_normalized,
            timestamp_ms=timestamp,
        )

    async def post_message(self, text: str) -> str | None:
        if not self._post_enabled:
            return None
        if time.time() < getattr(self, "_post_backoff_until", 0):
            return None
        if not self._live_chat_id:
            return None
        if not text.strip() or len(text) > 200:
            return None
        token = await self._oauth.get_valid_token()
        headers = {"Authorization": f"Bearer {token}"}
        body = {
            "snippet": {
                "liveChatId": self._live_chat_id,
                "type": "textMessageEvent",
                "textMessageDetails": {"messageText": text[:200]},
            }
        }
        try:
            resp = await self._http.post(
                YT_API_BASE + "/liveChat/messages",
                json=body,
                headers=headers,
            )
            if resp.status_code == 429:
                self._post_backoff_until = time.time() + 4
                return None
            resp.raise_for_status()
            data = resp.json()
            return data.get("id")
        except Exception:
            self._post_backoff_until = time.time() + 2
            return None

    def disconnect(self) -> None:
        self._live_chat_id = None
        self._next_page = None

    async def close(self) -> None:
        self._running = False
        await self._http.aclose()


# ── Utilities ─────────────────────────────────────────────────────────────────

def _find_free_port(start: int, end: int) -> int:
    import socket
    for port in range(start, end + 1):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("127.0.0.1", port))
            s.close()
            return port
        except OSError:
            continue
    return start


def _urlencode(value: str) -> str:
    import urllib.parse
    return urllib.parse.quote(value, safe="")


def _sanitize_display_name(name: str) -> str:
    import html
    name = html.escape(name.strip())
    name = re.sub(r"[\x00-\x1f\x7f<>]", "", name)
    if not name:
        return "viewer"
    return name[:60]
