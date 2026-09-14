import os
import socket
import ssl
import sys
import time
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from dotenv import load_dotenv
import pytest
import asyncio

load_dotenv()

def run_connection_check():
    """Executes database connectivity checks across DNS, TCP, and asyncpg."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        return False, "DATABASE_URL not set in environment/.env"

    if "sqlite" in database_url:
        return True, "SQLite/in-memory database detected. Skipping PostgreSQL socket check."

    # Normalize scheme for parsing
    parse_url = database_url.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres://", "postgresql://", 1)
    parsed = urlparse(parse_url)
    host = parsed.hostname
    port = parsed.port or 5432

    # Strip ssl/sslmode query params
    query_params = dict(parse_qsl(parsed.query))
    removed = {k: query_params.pop(k) for k in ["sslmode", "ssl"] if k in query_params}
    clean_query = urlencode(query_params)
    clean_url = urlunparse(parsed._replace(query=clean_query))

    print(f"Target host: {host}")
    print(f"Target port: {port}")
    if removed:
        print(f"Removed SSL-related query params before connecting: {removed}\n")

    # Step 1: DNS resolution
    print("=== Step 1: DNS resolution ===")
    try:
        infos = socket.getaddrinfo(host, port)
        for info in infos:
            family = "IPv4" if info[0] == socket.AF_INET else "IPv6"
            print(f"  {family}: {info[4][0]}")
    except Exception as e:
        return False, f"DNS resolution failed: {e}"

    # Step 2: Plain TCP connect
    print("\n=== Step 2: Plain TCP connect (no SSL), 10s timeout ===")
    try:
        start = time.time()
        sock = socket.create_connection((host, port), timeout=10)
        elapsed = time.time() - start
        print(f"✅ TCP connected in {elapsed:.2f}s")
        sock.close()
    except Exception as e:
        return False, f"TCP connect failed: {e}"

    # Step 3: asyncpg connect
    print("\n=== Step 3: asyncpg.connect() with 20s timeout, verbose ===")
    import asyncpg

    async def try_connect():
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            start = time.time()
            conn = await asyncpg.connect(dsn=clean_url, timeout=20, ssl=ctx)
            elapsed = time.time() - start
            print(f"✅ asyncpg connected in {elapsed:.2f}s")
            version = await conn.fetchval("SELECT version()")
            print(f"   Server: {version}")
            await conn.close()
            return True, "Database connection successful."
        except Exception as e:
            return False, f"asyncpg connect failed: {type(e).__name__}: {e}"

    return asyncio.run(try_connect())


def test_database_connection():
    """Pytest entrypoint that skips gracefully in CI/test environments."""
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url or "sqlite" in database_url:
        pytest.skip("Skipping PostgreSQL connection test (missing or using SQLite in-memory URL).")

    success, message = run_connection_check()
    if not success:
        pytest.fail(message)


if __name__ == "__main__":
    success, message = run_connection_check()
    if not success:
        print(f"\n❌ {message}")
        sys.exit(1)
    print(f"\n✅ {message}")