"""
API Key Vault & Multi-Key Pool Manager with Masking and Health Ping Test.
"""
import os
import json
import time
import uuid
import httpx
from typing import List, Optional, Dict, Any
from app.config import settings

_VAULT_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/api_key_vault.json"))

def _mask_api_key(key: str) -> str:
    cleaned = (key or "").strip()
    if len(cleaned) <= 10:
        return "AIzaSy..." + cleaned[-4:] if len(cleaned) >= 4 else "AIzaSy...****"
    return cleaned[:8] + "..." + cleaned[-4:]

def _load_vault_data() -> List[Dict[str, Any]]:
    if not os.path.exists(_VAULT_FILE):
        default_keys: List[Dict[str, Any]] = []
        _save_vault_data(default_keys)
        return default_keys
    try:
        with open(_VAULT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_vault_data(keys: List[Dict[str, Any]]) -> None:
    try:
        os.makedirs(os.path.dirname(_VAULT_FILE), exist_ok=True)
        with open(_VAULT_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def get_all_masked_keys() -> List[Dict[str, Any]]:
    keys = _load_vault_data()
    result = []
    for k in keys:
        result.append({
            "key_id": k["key_id"],
            "name": k["name"],
            "masked_key": _mask_api_key(k.get("raw_key", "")),
            "provider": k.get("provider", "gemini"),
            "status": k.get("status", "active"),
            "quota_status": k.get("quota_status", "15 RPM / Normal"),
            "is_active": k.get("is_active", True),
            "created_at": k.get("created_at", time.time()),
            "tokens_used_today": k.get("tokens_used_today", 0),
            "requests_count": k.get("requests_count", 0),
            "error_429_count": k.get("error_429_count", 0),
            "latency_ms": k.get("latency_ms", None),
            "last_used_at": k.get("last_used_at", None),
        })
    return result

def add_api_key(name: str, raw_key: str, provider: str = "gemini") -> Dict[str, Any]:
    keys = _load_vault_data()
    key_id = f"key-{int(time.time())}-{uuid.uuid4().hex[:4]}"
    new_item = {
        "key_id": key_id,
        "name": name,
        "raw_key": raw_key.strip(),
        "provider": provider,
        "status": "active",
        "quota_status": "15 RPM / Normal",
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
    return {
        "key_id": key_id,
        "name": name,
        "masked_key": _mask_api_key(raw_key),
        "provider": provider,
        "status": "active",
        "quota_status": "15 RPM / Normal",
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
        return True
    return False

def get_active_api_key(provider: str = "gemini") -> Optional[str]:
    """Lấy khóa API đang kích hoạt đầu tiên từ Key Vault (Quản lý độc quyền qua Clinical AI Monitor)."""
    keys = _load_vault_data()
    for k in keys:
        if k.get("provider") == provider and k.get("is_active") and k.get("status") == "active":
            raw = k.get("raw_key")
            if raw and len(raw.strip()) >= 10:
                return raw.strip()
    return None

def rotate_to_next_key(failed_raw_key: str, reason: str = "rate_limited") -> Optional[str]:
    """Tự động đánh dấu khóa bị lỗi hạn ngạch 429/cạn token và xoay vòng kích hoạt khóa dự phòng tiếp theo."""
    keys = _load_vault_data()
    next_key = None
    candidate_item = None

    # Bước 1: Đánh dấu vô hiệu hóa tạm thời khóa bị lỗi hạn ngạch
    for k in keys:
        if k.get("raw_key") == failed_raw_key:
            k["status"] = reason
            k["is_active"] = False
            k["error_429_count"] = k.get("error_429_count", 0) + 1
            k["quota_status"] = "429 Cạn Token (Tự động chuyển khóa dự phòng)"

    # Bước 2: Tìm khóa dự phòng khả dụng tiếp theo trong bể
    for k in keys:
        raw = k.get("raw_key")
        if raw and raw != failed_raw_key and len(raw.strip()) >= 10:
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
    return next_key

async def ping_test_gemini_key(raw_key: str) -> tuple[bool, str, float, List[str]]:
    start_t = time.monotonic()
    models_to_check = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
    test_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={raw_key}"
    payload = {"contents": [{"parts": [{"text": "ping"}]}], "generationConfig": {"maxOutputTokens": 3}}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.post(test_url, json=payload)
            elapsed = round((time.monotonic() - start_t) * 1000, 1)
            if res.status_code == 200:
                return True, "Kết nối thành công (Key hoạt động bình thường)", elapsed, models_to_check
            elif res.status_code == 429:
                return False, "Key đang bị giới hạn hạn ngạch (Rate Limit 429)", elapsed, []
            else:
                # Thử thêm gemini-3.1-flash-lite nếu 3.5 gặp vấn đề
                fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={raw_key}"
                res2 = await client.post(fallback_url, json=payload)
                elapsed2 = round((time.monotonic() - start_t) * 1000, 1)
                if res2.status_code == 200:
                    return True, "Kết nối thành công (gemini-3.1-flash-lite)", elapsed2, models_to_check
                return False, f"Lỗi xác thực Google API (HTTP {res.status_code})", elapsed, []
    except Exception as e:
        elapsed = round((time.monotonic() - start_t) * 1000, 1)
        return False, f"Không thể kết nối đến máy chủ Google: {str(e)[:60]}", elapsed, []

async def auto_heartbeat_all_keys() -> List[Dict[str, Any]]:
    """Tự động kiểm tra sức khỏe, độ trễ và quota cho toàn bộ bể khóa API Key."""
    keys = _load_vault_data()
    best_candidate_key = None
    min_latency = float("inf")

    for k in keys:
        raw = k.get("raw_key")
        if not raw or len(raw.strip()) < 10:
            continue
        success, msg, latency, _ = await ping_test_gemini_key(raw)
        k["latency_ms"] = latency
        k["last_checked_at"] = time.time()
        if success:
            k["status"] = "active"
            k["quota_status"] = f"Hoạt động ({latency}ms)"
            if latency < min_latency:
                min_latency = latency
                best_candidate_key = raw
        elif "429" in msg:
            k["status"] = "rate_limited"
            k["quota_status"] = "429 Hạn Ngạch Quá Tải"
        else:
            k["status"] = "error"
            k["quota_status"] = msg[:40]

    # Tự động tối ưu hóa key active: nếu active key hiện tại lỗi, switch sang key latency thấp nhất
    if best_candidate_key:
        curr_active = next((k for k in keys if k.get("is_active") and k.get("status") == "active"), None)
        if not curr_active:
            for k in keys:
                if k.get("raw_key") == best_candidate_key:
                    k["is_active"] = True

    _save_vault_data(keys)
    return get_all_masked_keys()
