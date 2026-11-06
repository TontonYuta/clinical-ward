import asyncio
from app.database import engine, Base
from app.seed import seed
from app.seed_registry import seed_dav_registry_if_needed
from app.services.registry_service import warm_up_registry_cache_and_fts

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    seed_dav_registry_if_needed()
    warm_up_registry_cache_and_fts()

if __name__ == "__main__":
    asyncio.run(init())
