import os
import asyncio
from database import init_db

# Connect to your live Render database
os.environ["DATABASE_URL"] = "postgresql+asyncpg://eduke_396b_user:t3CHVYbXLR9IRSo6uMooVMXZJQuZA6e7@dpg-d8gsheernols73c3k420-a.oregon-postgres.render.com/eduke_396b?ssl=require"

async def main():
    print("Syncing Python models to Render PostgreSQL...")
    try:
        await init_db()
        print("✅ Tables synced successfully! (New tables created)")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())