import asyncio
from app.database import engine, Base
from app.seed import seed
from app.seed_registry import seed_dav_registry_if_needed

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    seed_dav_registry_if_needed()

if __name__ == "__main__":
    asyncio.run(init())
