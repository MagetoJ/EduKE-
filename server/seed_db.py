import os
import asyncio
import sys

# --- THE WINDOWS FIX ---
# Prevents 'asyncpg' from abruptly dropping secure SSL connections to Render on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# -----------------------

# Explicit live target engine connection
os.environ["DATABASE_URL"] = "postgresql+asyncpg://eduke_396b_user:t3CHVYbXLR9IRSo6uMooVMXZJQuZA6e7@dpg-d8gsheernols73c3k420-a.oregon-postgres.render.com/eduke_396b?ssl=require"

try:
    from seed_superadmin import create_superadmin
except ImportError:
    from seed_superadmin import create_superadmin

async def run_seeding():
    print("Seeding initial administrator accounts to the production database...")
    try:
        # Calling the correct function name here
        await create_superadmin()
        print("Successfully seeded master database accounts!")
    except Exception as e:
        print(f"Error during seeding: {e}")

if __name__ == "__main__":
    asyncio.run(run_seeding())