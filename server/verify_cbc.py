# server/verify_cbc.py
import asyncio
from sqlalchemy import select
from database import async_session_maker
from models import GradeBand, Pathway, LearningArea

async def check_existence():
    async with async_session_maker() as db:
        # Check Grade Bands
        bands = (await db.execute(select(GradeBand))).scalars().all()
        print(f"🔹 Grade Bands found: {[b.code for b in bands]}")
        
        # Check Pathways
        pathways = (await db.execute(select(Pathway))).scalars().all()
        print(f"🔹 Pathways found: {[p.code for p in pathways]}")
        
        # Check Learning Areas
        las = (await db.execute(select(LearningArea).limit(3))).scalars().all()
        print(f"🔹 Sample Learning Areas: {[l.name for l in las]}")

if __name__ == "__main__":
    asyncio.run(check_existence())