import sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.services.dav_catalog_reader import DavCatalogReader
reader=DavCatalogReader(ROOT/'artifacts/clinical_hospital-with-dav-catalog.sqlite','dav-canonical-20261030-v12')
for label,call in [('exact',lambda:reader.search('893110151100')),('page',lambda:reader.list_registry(page=1,page_size=20)),('warehouse',lambda:reader.list_registry(only_in_warehouse=True,page_size=20)),('pharm',lambda:reader.list_registry(pharm_group='antibiotic',page_size=20))]:
    started=time.perf_counter()
    try:
        result=call(); print(label,round((time.perf_counter()-started)*1000,2),result.get('total'),len(result.get('items',[])),flush=True)
    except Exception as exc: print(label,'ERROR',repr(exc),flush=True)
