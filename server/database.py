import os
import sys
import ssl
import socket
import asyncio
import logging
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# --- WINDOWS SSL FIX ---
# Windows' default asyncio event loop (ProactorEventLoop) has a long-standing
# bug where it can silently tear down SSL/TLS transports mid-handshake. This
# is what produces "ConnectionResetError: [WinError 10054] An existing
# connection was forcibly closed by the remote host" when connecting to
# Render's Postgres over SSL. Switching to the Selector event loop policy
# fixes it. This must run before any event loop is created, so it lives at
# the very top of this module (imported first, by main.py).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# ------------------------

import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# --- SANITY CHECK #1: make sure "asyncpg" really is the real asyncpg package ---
# If a broken/foreign package ever shadows the real one in the venv (mismatched
# name, partial install, etc.), fail loudly here with a clear message instead of
# letting SQLAlchemy blow up deep inside its connection pool with a cryptic
# "missing 5 required positional arguments" TypeError.
if not hasattr(asyncpg, "connect"):
    raise RuntimeError(
        "The installed 'asyncpg' package does not expose connect(). Your virtual "
        "environment is broken or a different package is shadowing asyncpg. Run:\n"
        "  pip uninstall asyncpg asyncpg-connector -y\n"
        "  pip install asyncpg==0.30.0\n"
        "and confirm with: python -c \"import asyncpg, inspect; print(asyncpg.__file__)\""
    )

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    logger.warning("DATABASE_URL is not set — falling back to local SQLite for dev only.")
    DATABASE_URL = "sqlite+aiosqlite:///./test.db"
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


def _force_ipv4_host(hostname: str) -> str | None:
    """Resolve hostname to an IPv4 address.

    On some Windows setups, the OS resolver prefers an AAAA (IPv6) record for
    Render's hostname, and Render's TLS proxy resets that connection instead of
    falling back — this is what produces WinError 10054 mid-handshake. Forcing
    IPv4 here sidesteps that entirely. We still connect using the ORIGINAL
    hostname string (not the raw IP) for SNI purposes; we only use this to
    verify an IPv4 route exists and to log if it doesn't.
    """
    try:
        infos = socket.getaddrinfo(hostname, 5432, socket.AF_INET, socket.SOCK_STREAM)
        return infos[0][4][0] if infos else None
    except socket.gaierror as e:
        logger.warning(f"Could not resolve IPv4 address for {hostname}: {e}")
        return None


if DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    parsed = urlparse(DATABASE_URL)

    # Strip any sslmode/ssl query params — we pass our own ssl context via
    # connect_args below, and having both raises "parameter cannot be changed now".
    query_params = dict(parse_qsl(parsed.query))
    query_params.pop("sslmode", None)
    query_params.pop("ssl", None)
    DATABASE_URL = urlunparse(parsed._replace(query=urlencode(query_params)))

    if parsed.hostname:
        ipv4 = _force_ipv4_host(parsed.hostname)
        if ipv4:
            logger.info(f"Resolved {parsed.hostname} -> {ipv4} (IPv4 route confirmed)")
        else:
            logger.warning(
                f"No IPv4 route found for {parsed.hostname}; connection may hit "
                "IPv6 and reset (WinError 10054) on some Windows networks."
            )

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    connect_args = {
        "timeout": 15,            # fail fast on initial connect
        "command_timeout": 30,    # fail fast on a hung query
        "ssl": ssl_ctx,
        # Render's pooler can behave like pgbouncer in transaction mode, which
        # breaks asyncpg's prepared-statement cache ("prepared statement ...
        # does not exist"). Disabling it is a one-line permanent fix.
        "statement_cache_size": 0,
    }

    engine = create_async_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # discard connections the network/server silently closed
        pool_recycle=180,     # recycle before Render's idle timeout can kill them
        pool_size=5,
        max_overflow=5,
        connect_args=connect_args,
    )

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


@retry(
    stop=stop_after_attempt(6),
    wait=wait_exponential(multiplier=1, min=2, max=20),  # 2s, 4s, 8s, 16s, 20s, 20s
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def init_db():
    """Initialize database tables with exponential-backoff retry.

    Exponential backoff (instead of a fixed 2s wait) gives Render's free-tier
    Postgres enough time to wake up from a cold start on the first request,
    which is the single most common cause of connection resets on startup.
    """
    try:
        async with engine.begin() as conn:
            from models import Base as ModelBase
            await conn.run_sync(ModelBase.metadata.create_all)
        safe_target = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
        logger.info(f"✅ Database initialized successfully using: {safe_target}")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise e