import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from tenacity import retry, stop_after_attempt, wait_fixed
import logging
from dotenv import load_dotenv  # Import dotenv to read your .env file

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Fetch the DATABASE_URL from your .env file. Fall back to SQLite only if not provided.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./eduke.db")

# If you are using SQLite locally, you need connect_args. For Postgres, remove it.
if "sqlite" in DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
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
