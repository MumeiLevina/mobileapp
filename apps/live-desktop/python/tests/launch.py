"""Stub launch module for tests. Skips upstream pin verification.

Only used in tests. Production launch.py lives at apps/live-desktop/python/launch.py
and validates pinned upstream commits via upstream.lock.json (gitignored).
"""

import sys
from pathlib import Path

# Add upstream src to path (mirrors what the real launch.py does via verify_pins)
_REPO = Path(__file__).resolve().parents[3]
_UPSTREAM_SRC = _REPO / ".mori-live" / "upstream" / "src"
if _UPSTREAM_SRC.exists():
    sys.path.insert(0, str(_UPSTREAM_SRC))


def verify_pins() -> None:
    """No-op for tests. The real launch.py validates immutable upstream pins."""
    pass
