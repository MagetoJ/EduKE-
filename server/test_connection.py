"""
Run this from server/ folder:
    python test_connection.py
"""
import os
import socket
import ssl
import sys
import time
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    print("❌ DATABASE_URL not set in environment/.env")
    sys.exit(1)

# Normalize scheme for parsing
parse_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgres://", "postgresql://", 1)
parsed = urlparse(parse_url)
host = parsed.hostname
port = parsed.port or 5432

# Strip ssl/sslmode query params - we pass SSL explicitly via connect_args instead,
# to avoid asyncpg's "parameter cannot be changed now" conflict.
query_params = dict(parse_qsl(parsed.query))
removed = {k: query_params.pop(k) for k in ["sslmode", "ssl"] if k in query_params}
clean_query = urlencode(query_params)
clean_url = urlunparse(parsed._replace(query=clean_query))

print(f"Target host: {host}")
print(f"Target port: {port}")
if removed:
    print(f"Removed SSL-related query params before connecting: {removed}")
print()

# --- Step 1: DNS resolution ---
print("=== Step 1: DNS resolution ===")
try:
    infos = socket.getaddrinfo(host, port)
    for info in infos:
        family = "IPv4" if info[0] == socket.AF_INET else "IPv6"
        print(f"  {family}: {info[4][0]}")
except Exception as e:
    print(f"❌ DNS resolution failed: {e}")
    sys.exit(1)
print()

# --- Step 2: Plain TCP connect (no SSL) ---
print("=== Step 2: Plain TCP connect (no SSL), 10s timeout ===")
try:
    start = time.time()
    sock = socket.create_connection((host, port), timeout=10)
    elapsed = time.time() - start
    print(f"✅ TCP connected in {elapsed:.2f}s")
    sock.close()
except Exception as e:
    print(f"❌ TCP connect failed: {e}")
    sys.exit(1)
print()

# --- Step 3: Real asyncpg connect with generous timeout, clean DSN ---
print("=== Step 3: asyncpg.connect() with 20s timeout, verbose ===")
import asyncio
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
    except Exception as e:
        print(f"❌ asyncpg connect failed: {type(e).__name__}: {e}")

asyncio.run(try_connect())