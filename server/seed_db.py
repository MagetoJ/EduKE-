import os
import asyncio
import sys
from dotenv import load_dotenv

load_dotenv()

# --- THE WINDOWS FIX ---
# Prevents 'asyncpg' from abruptly dropping secure SSL connections to Render on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# -----------------------

# Uses DATABASE_URL from your local .env file instead of a hardcoded
# credential — never commit real database credentials to a public repo.
if not os.getenv("DATABASE_URL"):
    print("❌ ERROR: DATABASE_URL is not set. Add it to your .env file before running this.")
    sys.exit(1)

try:
    from seed_superadmin import create_superadmin
except ImportError:
    from seed_superadmin import create_superadmin


async def run_seeding():
    print("Seeding initial administrator accounts to the target database...")
    try:
        await create_superadmin()
        print("Successfully seeded master database accounts!")
    except Exception as e:
        print(f"Error during seeding: {e}")


if __name__ == "__main__":
    asyncio.run(run_seeding())