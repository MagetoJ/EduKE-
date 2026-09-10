import os
import sys
import unittest
from datetime import timedelta

os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-at-least-32-characters-long")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
sys.path.insert(0, os.path.dirname(__file__))

from auth import create_access_token, hash_refresh_token  # noqa: E402
from config import Settings  # noqa: E402
import jwt  # noqa: E402
from jwt.exceptions import InvalidTokenError  # noqa: E402


class SecurityFoundationTests(unittest.TestCase):
    def test_expired_access_tokens_are_rejected_by_default(self):
        token = create_access_token({"sub": "user@example.com"}, expires_delta=timedelta(seconds=-1))
        with self.assertRaises(InvalidTokenError):
            jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])

    def test_refresh_token_hash_does_not_equal_raw_token(self):
        raw_token = "refresh-token-value"
        digest = hash_refresh_token(raw_token)
        self.assertNotEqual(raw_token, digest)
        self.assertEqual(len(digest), 64)

    def test_placeholder_jwt_secret_is_rejected(self):
        with self.assertRaises(ValueError):
            Settings(
                jwt_secret="your-super-secret-jwt-key-change-this-in-production",
                database_url="sqlite+aiosqlite:///./test.db",
            )


if __name__ == "__main__":
    unittest.main()
