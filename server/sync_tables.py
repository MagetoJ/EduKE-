import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Uses DATABASE_URL from your local .env file instead of a hardcoded
# credential — never commit real database credentials to a public repo.
if not os.getenv("DATABASE_URL"):
    print("❌ ERROR: DATABASE_URL is not set. Add it to your .env file before running this.")
    sys.exit(1)

from database import init_db


async def main():
    print("Syncing Python models to target PostgreSQL database...")
    try:
        await init_db()
        print("✅ Tables synced successfully! (New tables created)")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())