import os
import sys
import asyncio
from sqlalchemy import text

# Explicit live target engine connection
os.environ["DATABASE_URL"] = "postgresql+asyncpg://eduke_396b_user:t3CHVYbXLR9IRSo6uMooVMXZJQuZA6e7@dpg-d8gsheernols73c3k420-a.oregon-postgres.render.com/eduke_396b?ssl=require"

try:
    from database import engine
    from models import Base
except ImportError:
    from database import engine
    from models import Base

async def reinitialize_db():
    print("Connecting asynchronously to production Render database...")
    
    async with engine.begin() as conn:
        print("Forcing clean cascade drop of existing layout schemas...")
        # Separate the semicolon statements into individual executions
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        
        print("Creating brand new tables with modern columns...")
        await conn.run_sync(Base.metadata.create_all)
        
    print("Database tables completely re-initialized successfully!")

if __name__ == "__main__":
    asyncio.run(reinitialize_db())