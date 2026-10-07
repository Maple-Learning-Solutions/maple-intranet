import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = 'postgresql+asyncpg://postgres.iidmjrsfflnpbijiijpo:Maplelearningsolutions@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def check_user():
    async with async_session() as db:
        res = await db.execute(text("SELECT id FROM users WHERE id = 'temp_admin_user'"))
        user = res.fetchone()
        print('temp_admin_user exists:', bool(user))

asyncio.run(check_user())
