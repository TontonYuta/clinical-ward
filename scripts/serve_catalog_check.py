from __future__ import annotations
import asyncio, os, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.config import settings
settings.DAV_CATALOG_DB_PATH=os.environ['DAV_CATALOG_DB_PATH']
from app.main import app
from httpx import AsyncClient,ASGITransport
async def main():
    async with AsyncClient(transport=ASGITransport(app=app),base_url='http://test') as client:
        for params in ({'search':'893110151100'},{'page':1,'page_size':20},{'only_in_warehouse':'true','page_size':20},{'pharm_group':'antibiotic','page_size':20}):
            started=time.perf_counter(); response=await client.get('/api/v1/registry/catalog',params=params)
            data=response.json(); print(params,response.status_code,round((time.perf_counter()-started)*1000,2),data.get('total'),len(data.get('items',[])))
asyncio.run(main())
