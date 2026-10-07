import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.workers.tracking_worker import process_tracking_event_async

DATABASE_URL = 'postgresql+asyncpg://postgres.iidmjrsfflnpbijiijpo:Maplelearningsolutions@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with async_session() as db:
        res = await db.execute(text("SELECT id FROM tracking_event_inbox WHERE status = 'received' ORDER BY created_at ASC"))
        inbox_ids = [r[0] for r in res.fetchall()]
        
    print(f'Found {len(inbox_ids)} events to process')
    for i in inbox_ids:
        print(f'Processing {i}...')
        await process_tracking_event_async(i)
        
    async with async_session() as db:
        res = await db.execute(text("SELECT status, progress_percent, score FROM learning_attempts WHERE id = 36"))
        print('Attempt 36:', dict(res.fetchone()._mapping))

asyncio.run(main())
