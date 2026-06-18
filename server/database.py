import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from tenacity import retry, stop_after_attempt, wait_fixed
import logging
from dotenv import load_dotenv  # Import dotenv to read your .env file

# Load environment variables
load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

# --- DEBUGGING BLOCK ---
if not DATABASE_URL:
    print("🚨 CRITICAL ERROR: DATABASE_URL environment variable is MISSING!")
    DATABASE_URL = "sqlite+aiosqlite:///./eduke.db" 
else:
    print("✅ SUCCESS: DATABASE_URL was found!")
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
# -----------------------

engine = create_async_engine(DATABASE_URL)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

@retry(stop=stop_after_attempt(5), wait=wait_fixed(2))
async def init_db():
    """Initialize database tables with retry logic - SmartBiz pattern"""
    try:
        async with engine.begin() as conn:
            # This creates all tables defined in your models.py
            from models import Base as ModelBase
            await conn.run_sync(ModelBase.metadata.create_all)
        logger.info(f"✅ Database initialized successfully using: {DATABASE_URL.split('@')[-1]}")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise e
