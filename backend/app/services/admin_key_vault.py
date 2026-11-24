"""
API Key Vault & Multi-Key Pool Manager with Masking and Health Ping Test.
"""
import os
import json
import time
import uuid
import httpx
from typing import List, Optional, Dict, Any, Tuple
from app.config import settings

_VAULT_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/api_key_vault.json"))

def _identity_vault_configured() -> bool:
    return bool(settings.IDENTITY_DATABASE_URL and settings.KEY_ENCRYPTION_KEY)

def _require_complete_identity_vault_config() -> None:
    if bool(settings.IDENTITY_DATABASE_URL) != bool(settings.KEY_ENCRYPTION_KEY):
        raise RuntimeError("Both IDENTITY_DATABASE_URL and KEY_ENCRYPTION_KEY are required for the persistent API key vault.")

def _mask_api_key(key: str) -> str:
    cleaned = (key or "").strip()
    if len(cleaned) <= 10:
        return "AIzaSy..." + cleaned[-4:] if len(cleaned) >= 4 else "AIzaSy...****"
    return cleaned[:8] + "..." + cleaned[-4:]

def _load_vault_data() -> List[Dict[str, Any]]:
    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            return _load_identity_vault_sync()
        except Exception:
            pass
    if not os.path.exists(_VAULT_FILE):
        default_keys: List[Dict[str, Any]] = []
        _save_vault_data(default_keys)
        return default_keys
    try:
        with open(_VAULT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

_ACTIVE_KEY_CACHE: Dict[str, Tuple[str, float]] = {}


def _save_vault_data(keys: List[Dict[str, Any]]) -> None:
    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        _save_identity_vault_sync(keys)
        # Đồng bộ cache tệp dự phòng cho các tiến trình không có kết nối DB trực tiếp
        try:
            os.makedirs(os.path.dirname(_VAULT_FILE), exist_ok=True)
            with open(_VAULT_FILE, "w", encoding="utf-8") as f:
                json.dump(keys, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return
    try:
        os.makedirs(os.path.dirname(_VAULT_FILE), exist_ok=True)
        with open(_VAULT_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _identity_factory_sync():
    from app.identity_database import get_identity_session_factory
    return get_identity_session_factory()[1]


def _run_identity(coroutine_factory):
    import asyncio
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coroutine_factory())

    # Nếu đang chạy bên trong một asyncio event loop (như FastAPI async routes),
    # ủy thác thực thi sang ThreadPool riêng biệt để không chặn event loop và tránh lỗi RuntimeError
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coroutine_factory()).result()


def _load_identity_vault_sync() -> List[Dict[str, Any]]:
    from app.services.identity_service import list_provider_keys
    async def load():
        factory = _identity_factory_sync()
        async with factory() as session:
            rows = await list_provider_keys(session)
            # Keep sync vault callers compatible with existing service code.
            from app.security.secret_encryption import decrypt_secret
            from sqlalchemy import select
            from app.models.identity import ProviderApiKey
            db_rows = (await session.scalars(select(ProviderApiKey).order_by(ProviderApiKey.created_at))).all()
            for item, row in zip(rows, db_rows):
                item["raw_key"] = decrypt_secret(row.encrypted_key, settings.KEY_ENCRYPTION_KEY)
            return rows
    return _run_identity(load)


def _save_identity_vault_sync(keys: List[Dict[str, Any]]) -> None:
    from app.models.identity import ProviderApiKey
    from app.security.secret_encryption import encrypt_secret
    from sqlalchemy import select
    async def save():
        factory = _identity_factory_sync()
        async with factory() as session:
            current = (await session.scalars(select(ProviderApiKey))).all()
            by_id = {row.key_id: row for row in current}
            wanted = {str(item.get("key_id")): item for item in keys}
            for row in current:
                if row.key_id not in wanted:
                    await session.delete(row)
            for key_id, item in wanted.items():
                row = by_id.get(key_id)
                if row is None:
                    row = ProviderApiKey(key_id=key_id, name=item.get("name", ""), provider=item.get("provider", "gemini"), encrypted_key=encrypt_secret(item.get("raw_key", ""), settings.KEY_ENCRYPTION_KEY))
                    session.add(row)
                row.name = item.get("name", row.name)
                row.provider = item.get("provider", row.provider)
                row.encrypted_key = encrypt_secret(item.get("raw_key", ""), settings.KEY_ENCRYPTION_KEY)
                row.status = item.get("status", row.status)
                row.quota_status = item.get("quota_status", row.quota_status)
                row.is_active = bool(item.get("is_active", row.is_active))
                row.tokens_used_today = int(item.get("tokens_used_today", row.tokens_used_today or 0))
                row.requests_count = int(item.get("requests_count", row.requests_count or 0))
                row.error_429_count = int(item.get("error_429_count", row.error_429_count or 0))
                row.latency_ms = item.get("latency_ms", row.latency_ms)
                row.last_used_at = item.get("last_used_at", row.last_used_at)
            await session.commit()
    _run_identity(save)

def get_system_env_key_items(existing_keys: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """Tạo bản ghi minh bạch cho Khóa Hệ Thống Mặc Định (Gemini & Serper từ Render Environment)."""
    items = []
    
    # 1. Khóa Gemini Mặc định
    env_gemini = settings.GEMINI_API_KEY
    if env_gemini and env_gemini != "MY_GEMINI_API_KEY" and len(env_gemini.strip()) >= 10:
        raw_clean = env_gemini.strip()
        masked = _mask_api_key(raw_clean)
        already_exists = False
        has_active_custom = False

        if existing_keys:
            for k in existing_keys:
                if k.get("provider", "gemini") == "gemini":
                    if k.get("key_id") == "sys-env-gemini-primary" or k.get("masked_key") == masked:
                        already_exists = True
                    elif k.get("is_active") and k.get("status") == "active":
                        has_active_custom = True

        if not already_exists:
            tokens_today = 0
            try:
                from app.services.telemetry_store import get_daily_token_usage
                tokens_today, _ = get_daily_token_usage()
            except Exception:
                pass
            is_active = not has_active_custom
            items.append({
                "key_id": "sys-env-gemini-primary",
                "name": "Khóa Gemini Mặc Định (Render Environment)",
                "masked_key": masked,
                "provider": "gemini",
                "status": "active" if is_active else "standby",
                "quota_status": "15 RPM · 1.000.000 TPM · 1.500 RPD",
                "is_active": is_active,
                "is_system_env": True,
                "created_at": 1730000000.0,
                "tokens_used_today": tokens_today,
                "requests_count": 0,
                "error_429_count": 0,
                "latency_ms": None,
                "last_used_at": None,
            })

    # 2. Khóa Serper.dev Mặc định
    env_serper = settings.SERPER_API_KEY
    if env_serper and env_serper != "YOUR_SERPER_API_KEY" and len(env_serper.strip()) >= 10:
        raw_clean_serper = env_serper.strip()
        masked_serper = _mask_api_key(raw_clean_serper)
        serper_already_exists = False
        has_active_custom_serper = False

        if existing_keys:
            for k in existing_keys:
                if k.get("provider") == "serper":
                    if k.get("key_id") == "sys-env-serper-primary" or k.get("masked_key") == masked_serper:
                        serper_already_exists = True
                    elif k.get("is_active") and k.get("status") == "active":
                        has_active_custom_serper = True

        if not serper_already_exists:
            queries_today = 0
            try:
                from app.services.telemetry_store import get_daily_search_query_usage
                queries_today, _ = get_daily_search_query_usage()
            except Exception:
                pass
            is_active_serper = not has_active_custom_serper
            items.append({
                "key_id": "sys-env-serper-primary",
                "name": "Khóa Tìm Kiếm Google Serper (Render Environment)",
                "masked_key": masked_serper,
                "provider": "serper",
                "status": "active" if is_active_serper else "standby",
                "quota_status": "2.500 Queries Quota · 50 QPS",
                "is_active": is_active_serper,
                "is_system_env": True,
                "created_at": 1730000000.0,
                "tokens_used_today": queries_today,
                "requests_count": queries_today,
                "error_429_count": 0,
                "latency_ms": None,
                "last_used_at": None,
            })

    return items


def get_system_env_key_item(existing_keys: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """Tương thích ngược: Trả về khóa Gemini hệ thống đầu tiên."""
    items = get_system_env_key_items(existing_keys)
    for it in items:
        if it.get("provider") == "gemini":
            return it
    return None

def get_all_masked_keys() -> List[Dict[str, Any]]:
    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            from app.identity_database import get_identity_session_factory
            from app.services.identity_service import list_provider_keys
            factory = get_identity_session_factory()[1]
            async def load_masked():
                async with factory() as session:
                    return await list_provider_keys(session)
            db_keys = _run_identity(load_masked)
            sys_items = get_system_env_key_items(db_keys)
            db_keys.extend(sys_items)
            return db_keys
        except Exception:
            pass
    keys = _load_vault_data()
    result = []
    for k in keys:
        prov = k.get("provider", "gemini")
        def_quota = "2.500 Queries Quota · 50 QPS" if prov == "serper" else "15 RPM · 1.000.000 TPM · 1.500 RPD"
        result.append({
            "key_id": k["key_id"],
            "name": k["name"],
            "masked_key": _mask_api_key(k.get("raw_key", "")),
            "provider": prov,
            "status": k.get("status", "active"),
            "quota_status": k.get("quota_status", def_quota),
            "is_active": k.get("is_active", True),
            "is_system_env": False,
            "created_at": k.get("created_at", time.time()),
            "tokens_used_today": k.get("tokens_used_today", 0),
            "requests_count": k.get("requests_count", 0),
            "error_429_count": k.get("error_429_count", 0),
            "latency_ms": k.get("latency_ms", None),
            "last_used_at": k.get("last_used_at", None),
        })
    sys_items = get_system_env_key_items(result)
    result.extend(sys_items)
    return result

def add_api_key(name: str, raw_key: str, provider: str = "gemini") -> Dict[str, Any]:
    keys = _load_vault_data()
    key_id = f"key-{int(time.time())}-{uuid.uuid4().hex[:4]}"
    def_quota = "2.500 Queries Quota · 50 QPS" if provider == "serper" else "15 RPM / Normal"
    new_item = {
        "key_id": key_id,
        "name": name,
        "raw_key": raw_key.strip(),
        "provider": provider,
        "status": "active",
        "quota_status": def_quota,
        "is_active": True,
        "created_at": time.time(),
        "tokens_used_today": 0,
        "requests_count": 0,
        "error_429_count": 0,
        "latency_ms": None,
        "last_used_at": None,
    }
    keys.append(new_item)
    _save_vault_data(keys)
    _ACTIVE_KEY_CACHE.clear()
    return {
        "key_id": key_id,
        "name": name,
        "masked_key": _mask_api_key(raw_key),
        "provider": provider,
        "status": "active",
        "quota_status": def_quota,
        "is_active": True,
        "created_at": new_item["created_at"],
        "tokens_used_today": 0,
        "requests_count": 0,
        "error_429_count": 0,
        "latency_ms": None,
        "last_used_at": None,
    }

def record_key_consumption(raw_key: str, tokens: int, is_error_429: bool = False) -> None:
    """Ghi nhận mức độ tiêu thụ token, số lượt request, và lỗi 429 theo từng khóa API."""
    if not raw_key:
        return
    from datetime import datetime
    keys = _load_vault_data()
    modified = False
    target = raw_key.strip()

    for k in keys:
        raw = (k.get("raw_key") or "").strip()
        if raw == target:
            if is_error_429:
                k["error_429_count"] = k.get("error_429_count", 0) + 1
                k["status"] = "rate_limited"
                k["quota_status"] = f"429 Quá Tải ({datetime.now().strftime('%H:%M:%S')})"
            else:
                k["requests_count"] = k.get("requests_count", 0) + 1
                k["tokens_used_today"] = k.get("tokens_used_today", 0) + max(0, int(tokens))
                k["last_used_at"] = datetime.now().strftime("%H:%M:%S %d/%m")
                if k.get("status") == "rate_limited":
                    k["status"] = "active"
                    k["quota_status"] = "Hoạt động"
            modified = True
            break

    if modified:
        _save_vault_data(keys)

def delete_api_key(key_id: str) -> bool:
    keys = _load_vault_data()
    filtered = [k for k in keys if k["key_id"] != key_id]
    if len(filtered) != len(keys):
        _save_vault_data(filtered)
        _ACTIVE_KEY_CACHE.clear()
        return True
    return False

async def get_active_api_key_async(provider: str = "gemini") -> Optional[str]:
    """Lấy khóa API async an toàn tuyệt đối khi đang chạy trong event loop."""
    cached = _ACTIVE_KEY_CACHE.get(provider)
    if cached and (time.time() - cached[1] < 60):
        return cached[0]

    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            from app.identity_database import get_identity_session_factory
            from app.services.identity_service import get_active_provider_key
            factory = get_identity_session_factory()[1]
            async with factory() as session:
                k = await get_active_provider_key(session, provider)
                if k:
                    _ACTIVE_KEY_CACHE[provider] = (k, time.time())
                    return k
        except Exception:
            pass

    # Fallback to local json vault
    try:
        if os.path.exists(_VAULT_FILE):
            with open(_VAULT_FILE, "r", encoding="utf-8") as f:
                keys = json.load(f)
                for k in keys:
                    if k.get("provider") == provider and k.get("is_active") and k.get("status") == "active":
                        raw = k.get("raw_key")
                        if raw and len(raw.strip()) >= 10:
                            _ACTIVE_KEY_CACHE[provider] = (raw.strip(), time.time())
                            return raw.strip()
    except Exception:
        pass

    # Fallback to Render environment variables if configured
    if provider == "serper":
        env_serper = settings.SERPER_API_KEY
        if env_serper and env_serper != "YOUR_SERPER_API_KEY" and len(env_serper.strip()) >= 10:
            return env_serper.strip()
    elif provider == "gemini":
        env_gemini = settings.GEMINI_API_KEY
        if env_gemini and env_gemini != "MY_GEMINI_API_KEY" and len(env_gemini.strip()) >= 10:
            return env_gemini.strip()

    return None

async def get_raw_key_by_id_async(key_id: str) -> Optional[str]:
    """Lấy raw key theo key_id bất đồng bộ, giải mã an toàn từ DB identity."""
    if key_id == "sys-env-gemini-primary":
        env_key = settings.GEMINI_API_KEY
        if env_key and env_key != "MY_GEMINI_API_KEY" and len(env_key.strip()) >= 10:
            return env_key.strip()

    if key_id == "sys-env-serper-primary":
        env_key = settings.SERPER_API_KEY
        if env_key and env_key != "YOUR_SERPER_API_KEY" and len(env_key.strip()) >= 10:
            return env_key.strip()

    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            from app.identity_database import get_identity_session_factory
            from app.models.identity import ProviderApiKey
            from app.security.secret_encryption import decrypt_secret
            from sqlalchemy import select
            factory = get_identity_session_factory()[1]
            async with factory() as session:
                row = await session.scalar(select(ProviderApiKey).where(ProviderApiKey.key_id == key_id))
                if row and row.encrypted_key:
                    return decrypt_secret(row.encrypted_key, settings.KEY_ENCRYPTION_KEY)
        except Exception:
            pass

    try:
        if os.path.exists(_VAULT_FILE):
            with open(_VAULT_FILE, "r", encoding="utf-8") as f:
                keys = json.load(f)
                for k in keys:
                    if k.get("key_id") == key_id:
                        return k.get("raw_key")
    except Exception:
        pass
    return None

def get_active_api_key(provider: str = "gemini") -> Optional[str]:
    """Lấy khóa API đang kích hoạt đầu tiên từ Key Vault (Quản lý độc quyền qua Clinical AI Monitor)."""
    cached = _ACTIVE_KEY_CACHE.get(provider)
    if cached and (time.time() - cached[1] < 60):
        return cached[0]

    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            import asyncio
            try:
                asyncio.get_running_loop()
                # Running in an event loop: do not call blocking _run_identity
            except RuntimeError:
                from app.identity_database import get_identity_session_factory
                from app.services.identity_service import get_active_provider_key
                factory = get_identity_session_factory()[1]
                async def load_active():
                    async with factory() as session:
                        return await get_active_provider_key(session, provider)
                val = _run_identity(load_active)
                if val:
                    _ACTIVE_KEY_CACHE[provider] = (val, time.time())
                    return val
        except Exception:
            pass

    # Read from file vault if available
    try:
        if os.path.exists(_VAULT_FILE):
            with open(_VAULT_FILE, "r", encoding="utf-8") as f:
                keys = json.load(f)
                for k in keys:
                    if k.get("provider") == provider and k.get("is_active") and k.get("status") == "active":
                        raw = k.get("raw_key")
                        if raw and len(raw.strip()) >= 10:
                            _ACTIVE_KEY_CACHE[provider] = (raw.strip(), time.time())
                            return raw.strip()
    except Exception:
        pass

    # Fallback to Render environment variables if configured
    if provider == "serper":
        env_serper = settings.SERPER_API_KEY
        if env_serper and env_serper != "YOUR_SERPER_API_KEY" and len(env_serper.strip()) >= 10:
            return env_serper.strip()
    elif provider == "gemini":
        env_gemini = settings.GEMINI_API_KEY
        if env_gemini and env_gemini != "MY_GEMINI_API_KEY" and len(env_gemini.strip()) >= 10:
            return env_gemini.strip()

    return None

def rotate_to_next_key(failed_raw_key: str, reason: str = "rate_limited", provider: Optional[str] = None) -> Optional[str]:
    """Tự động đánh dấu khóa bị lỗi hạn ngạch 429/cạn token và xoay vòng kích hoạt khóa dự phòng tiếp theo cùng provider."""
    keys = _load_vault_data()
    next_key = None
    candidate_item = None
    target_provider = provider

    # Bước 1: Đánh dấu vô hiệu hóa tạm thời khóa bị lỗi hạn ngạch và xác định provider
    for k in keys:
        if k.get("raw_key") == failed_raw_key:
            target_provider = target_provider or k.get("provider", "gemini")
            k["status"] = reason
            k["is_active"] = False
            k["error_429_count"] = k.get("error_429_count", 0) + 1
            k["quota_status"] = "429 Cạn Quota (Tự động chuyển khóa dự phòng)"

    target_provider = target_provider or "gemini"

    # Bước 2: Tìm khóa dự phòng khả dụng tiếp theo trong bể cùng provider
    for k in keys:
        raw = k.get("raw_key")
        k_prov = k.get("provider", "gemini")
        if k_prov == target_provider and raw and raw != failed_raw_key and len(raw.strip()) >= 10:
            if k.get("status") in ("active", "standby"):
                candidate_item = k
                next_key = raw.strip()
                break

    # Bước 3: Thăng cấp kích hoạt khóa dự phòng mới làm Active Key
    if candidate_item:
        candidate_item["is_active"] = True
        candidate_item["status"] = "active"
        candidate_item["quota_status"] = "Khả dụng (Đã tự động chuyển giao)"

    _save_vault_data(keys)
    _ACTIVE_KEY_CACHE.pop(target_provider, None)
    return next_key

async def ping_test_serper_key(raw_key: str) -> tuple[bool, str, float, List[str]]:
    """Kiểm tra kết nối và hạn ngạch (Ping Test) thực tế tới Google Serper REST API."""
    start_t = time.monotonic()
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": raw_key.strip(), "Content-Type": "application/json"}
    payload = {"q": "ping", "num": 1}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            elapsed = round((time.monotonic() - start_t) * 1000, 1)
            if res.status_code == 200:
                return True, f"Kết nối Serper thành công ({elapsed}ms - Google Search khả dụng)", elapsed, ["google-serper-search"]
            elif res.status_code == 403:
                return False, "Khóa Serper không hợp lệ hoặc đã hết hạn ngạch credits (HTTP 403 Forbidden)", elapsed, []
            elif res.status_code == 429:
                return False, "Khóa Serper bị giới hạn tần suất (Rate Limit 429)", elapsed, []
            else:
                return False, f"Lỗi máy chủ Serper (HTTP {res.status_code})", elapsed, []
    except Exception as e:
        elapsed = round((time.monotonic() - start_t) * 1000, 1)
        return False, f"Không thể kết nối đến máy chủ Serper: {str(e)[:60]}", elapsed, []

async def ping_test_gemini_key(raw_key: str) -> tuple[bool, str, float, List[str]]:
    start_t = time.monotonic()
    url = "https://generativelanguage.googleapis.com/v1beta/models"
    headers = {"x-goog-api-key": raw_key.strip(), "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url, headers=headers)
            elapsed = round((time.monotonic() - start_t) * 1000, 1)
            if res.status_code == 200:
                data = res.json()
                models = [
                    m["name"].replace("models/", "")
                    for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ][:5]
                return True, "Kết nối thành công (Key hoạt động bình thường)", elapsed, models
            elif res.status_code == 429:
                return False, "Key đang bị giới hạn hạn ngạch (Rate Limit 429)", elapsed, []
            else:
                return False, f"Lỗi xác thực Google API (HTTP {res.status_code})", elapsed, []
    except Exception as e:
        elapsed = round((time.monotonic() - start_t) * 1000, 1)
        return False, f"Không thể kết nối đến máy chủ Google: {str(e)[:60]}", elapsed, []

async def ping_test_key(raw_key: str, provider: str = "gemini") -> tuple[bool, str, float, List[str]]:
    """Định tuyến ping test tương ứng theo provider."""
    if (provider or "").lower() == "serper":
        return await ping_test_serper_key(raw_key)
    return await ping_test_gemini_key(raw_key)

async def auto_heartbeat_all_keys() -> List[Dict[str, Any]]:
    """Tự động kiểm tra sức khỏe, độ trễ và quota cho toàn bộ bể khóa API Key (Gemini & Serper)."""
    _require_complete_identity_vault_config()
    if _identity_vault_configured():
        try:
            from app.identity_database import get_identity_session_factory
            from app.models.identity import ProviderApiKey
            from app.security.secret_encryption import decrypt_secret
            from sqlalchemy import select
            factory = get_identity_session_factory()[1]
            async with factory() as session:
                db_rows = (await session.scalars(select(ProviderApiKey).order_by(ProviderApiKey.created_at))).all()
                active_candidate_by_prov: Dict[str, Any] = {}
                for row in db_rows:
                    if not row.encrypted_key:
                        continue
                    raw = decrypt_secret(row.encrypted_key, settings.KEY_ENCRYPTION_KEY)
                    if not raw or len(raw.strip()) < 10:
                        continue
                    prov = row.provider or "gemini"
                    success, msg, latency, _ = await ping_test_key(raw, provider=prov)
                    row.latency_ms = latency
                    if success:
                        row.status = "active"
                        row.quota_status = f"Hoạt động ({latency}ms)"
                        best = active_candidate_by_prov.get(prov)
                        if not best or (row.latency_ms and row.latency_ms < getattr(best, "latency_ms", 999999)):
                            active_candidate_by_prov[prov] = row
                    elif "429" in msg or "403" in msg:
                        row.status = "rate_limited"
                        row.is_active = False
                    else:
                        row.status = "error"
                for cand in active_candidate_by_prov.values():
                    cand.is_active = True
                await session.commit()
                from app.services.identity_service import list_provider_keys
                from app.routers.availability import invalidate_availability_cache
                invalidate_availability_cache()
                res = await list_provider_keys(session)
                sys_items = get_system_env_key_items(res)
                res.extend(sys_items)
                return res
        except Exception as e:
            pass

    keys = _load_vault_data()
    best_candidate_by_prov: Dict[str, tuple[str, float]] = {}

    for k in keys:
        raw = k.get("raw_key")
        if not raw or len(raw.strip()) < 10:
            continue
        prov = k.get("provider", "gemini")
        success, msg, latency, _ = await ping_test_key(raw, provider=prov)
        k["latency_ms"] = latency
        k["last_checked_at"] = time.time()
        if success:
            k["status"] = "active"
            k["quota_status"] = f"Hoạt động ({latency}ms)"
            if prov not in best_candidate_by_prov or latency < best_candidate_by_prov[prov][1]:
                best_candidate_by_prov[prov] = (raw, latency)
        elif "429" in msg or "403" in msg:
            k["status"] = "rate_limited"
            k["quota_status"] = "Hạn Ngạch Quá Tải / 429 / 403"
        else:
            k["status"] = "error"
            k["quota_status"] = msg[:40]

    for prov, (best_raw, _) in best_candidate_by_prov.items():
        curr_active = next((k for k in keys if k.get("provider", "gemini") == prov and k.get("is_active") and k.get("status") == "active"), None)
        if not curr_active:
            for k in keys:
                if k.get("raw_key") == best_raw:
                    k["is_active"] = True

    _save_vault_data(keys)
    return get_all_masked_keys()
