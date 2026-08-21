import os
import sys
import asyncio
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# This script now reads DATABASE_URL from your local .env file instead of a
# hardcoded credential — never commit real database credentials to a public
# repo. If this was previously run against your live Render database,
# rotate that database's password in the Render dashboard, since the old
# credential was exposed on GitHub.
if not os.getenv("DATABASE_URL"):
    print("❌ ERROR: DATABASE_URL is not set. Add it to your .env file before running this.")
    sys.exit(1)

try:
    from database import engine
    from models import Base
except ImportError:
    from database import engine
    from models import Base


async def reinitialize_db():
    print("Connecting asynchronously to target database...")

    async with engine.begin() as conn:
        print("Forcing clean cascade drop of existing layout schemas...")
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))

        print("Creating brand new tables with modern columns...")
        await conn.run_sync(Base.metadata.create_all)

    print("Database tables completely re-initialized successfully!")


if __name__ == "__main__":
    # SAFETY GUARD: this drops and rebuilds the ENTIRE public schema.
    # Require explicit confirmation so it can never run by accident.
    target = os.getenv("DATABASE_URL", "").split("@")[-1]
    print(f"⚠️  This will PERMANENTLY DELETE ALL DATA in: {target}")
    confirm = input("Type the database host name shown above to confirm: ").strip()
    if confirm != target.split("/")[0]:
        print("Confirmation did not match. Aborting — no changes made.")
        sys.exit(1)
    asyncio.run(reinitialize_db())