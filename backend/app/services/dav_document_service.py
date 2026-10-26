import json
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug

DAV_API_URL = "https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging"

def extract_file_path(raw_json_str: str | None) -> str | None:
    if not raw_json_str or not isinstance(raw_json_str, str):
        return None
    try:
        arr = json.loads(raw_json_str)
        if isinstance(arr, list) and len(arr) > 0 and isinstance(arr[0], dict):
            return arr[0].get("duongDanTep")
    except Exception:
        pass
    return None

async def fetch_dav_documents_from_portal(national_code: str, brand_name: str | None = None) -> tuple[str | None, str | None]:
    search_term = national_code.strip() if national_code else (brand_name or "").strip()
    if not search_term:
        return None, None
    try:
        async with httpx.AsyncClient(timeout=8.0, verify=False) as client:
            payload = {
                "skipCount": 0,
                "maxResultCount": 1,
                "filterText": search_term,
                "SoDangKyThuoc": {},
                "KichHoat": True
            }
            res = await client.post(DAV_API_URL, json=payload)
            if res.status_code != 200:
                return None, None
            data = res.json()
            items = data.get("result", {}).get("items", [])
            if not items:
                return None, None
            tai_lieu = items[0].get("thongTinTaiLieu") or {}
            hdsd = extract_file_path(tai_lieu.get("urlHuongDanSuDung"))
            label = extract_file_path(tai_lieu.get("urlNhan"))
            return hdsd, label
    except Exception:
        return None, None

async def resolve_and_cache_drug_documents(db: AsyncSession, drug: DavNationalDrug) -> tuple[str | None, str | None]:
    if drug.hdsd_path or drug.label_path:
        return drug.hdsd_path, drug.label_path
    
    hdsd, label = await fetch_dav_documents_from_portal(drug.national_code, drug.brand_name)
    if hdsd or label:
        drug.hdsd_path = hdsd
        drug.label_path = label
        try:
            await db.commit()
            await db.refresh(drug)
        except Exception:
            await db.rollback()
    return drug.hdsd_path, drug.label_path
