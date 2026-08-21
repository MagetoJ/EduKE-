"""
Confirms the app's actual SQLAlchemy engine (same connect_args as
database.py) can connect and run a query, with timing. Use this if you've
already updated database.py to the 30s timeout and want to verify it works
before starting the full uvicorn server.

Usage (from server/, venv activated, .env present):
    python test_sqlalchemy_connect.py
"""
import asyncio
import time

from sqlalchemy import text


async def main():
    from database import engine  # uses your real database.py config

    print("Connecting through the app's actual SQLAlchemy engine...")
    t0 = time.time()
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version();"))
            row = result.fetchone()
        print(f"✅ Connected and queried in {time.time() - t0:.2f}s")
        print(f"   {row[0]}")
    except Exception as e:
        print(f"❌ Failed after {time.time() - t0:.2f}s: {type(e).__name__}: {e}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())