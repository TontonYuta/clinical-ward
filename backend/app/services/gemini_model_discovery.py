"""
Gemini Dynamic Model Discovery & Auto-Ranking Service.
Tự động khám phá danh mục Model khả dụng từ Google Generative AI API trong thời gian thực,
xếp hạng tối ưu cho độ trễ lâm sàng (ưu tiên Flash -> Pro), loại bỏ hoàn toàn mã cứng (hardcode)
và lưu vào bộ nhớ đệm RAM để đạt độ trễ 0ms ở các lượt gọi tiếp theo.
"""

import hashlib
import logging
import os
import re
import time
from typing import Dict, List, Optional, Tuple
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# Bộ nhớ đệm danh mục Model: {key_hash: (model_list, cached_at)}
_MODEL_CACHE: Dict[str, Tuple[List[str], float]] = {}
MODEL_CACHE_TTL_SEC = 43200  # 12 giờ

# Danh sách an toàn dự phòng (chỉ gồm các model Flash-Lite / Flash hạn ngạch request cao, phản hồi ổn định)
SAFE_FALLBACK_GEMINI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
]

# Các từ khóa nhận diện model không dùng cho sinh văn bản / chat hội thoại y tế
DISALLOWED_SUBSTRINGS = (
    "-tts", "preview-tts", "embedding", "aqa", "imagen", "whisper",
    "robotics", "computer-vision-internal", "computer-use", "-image", "flash-image",
    "-omni", "omni-", "live", "2.5-flash-lite", "nano-banana",
    "gemini-4-", "deep-research",
    "lyria", "antigravity-", "veo", "learnlm", "-audio", "transcribe"
)

# Các model không phù hợp cho luồng hỏi đáp (404 với key mới, timeout thường xuyên, hoặc RPD thấp)
_UNSTABLE_OR_LOW_QUOTA_QA_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
}


def filter_high_quota_chat_models(models: List[str]) -> List[str]:
    """
    Lọc danh sách model đã xếp hạng để chỉ giữ các model hỏi đáp có hạn ngạch request (RPD/RPM) cao
    và độ ổn định tốt (ưu tiên Flash-Lite trước, kế đến Flash ổn định; loại Pro/Gemma/model hay timeout).
    """
    preferred_order = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
        "gemini-flash-lite-latest",
    ]
    cleaned = [m.strip().replace("models/", "") for m in models if m and m.strip()]
    high_quota: List[str] = []
    for m in cleaned:
        lower = m.lower()
        if m in _UNSTABLE_OR_LOW_QUOTA_QA_MODELS:
            continue
        if "flash" not in lower:
            continue
        if "lite" in lower or m in preferred_order:
            if m not in high_quota:
                high_quota.append(m)

    if high_quota:
        rank_map = {name: idx for idx, name in enumerate(preferred_order)}
        high_quota.sort(key=lambda name: rank_map.get(name, 100))
        return high_quota

    # Fallback an toàn nếu danh sách đầu vào (hoặc mock test) không có dòng 3.x flash-lite
    flash_only = [m for m in cleaned if "flash" in m.lower()]
    return flash_only or cleaned


def extract_model_version(name: str) -> float:
    """Trích xuất số phiên bản thực tế của model (sau gemini/gemma, ví dụ 3.5, 2.5, 2.0, 1.5)."""
    match = re.search(r"(?:gemini|gemma)[-_](\d+(?:\.\d+)?)", name.lower())
    if match:
        try:
            ver = float(match.group(1))
            if ver <= 4.0:
                return ver
        except ValueError:
            pass
    return 1.0


def filter_and_rank_gemini_models(raw_models: List[str]) -> List[str]:
    """
    Lọc bỏ các model không phù hợp (TTS, Embedding) và xếp hạng thông minh:
    1. Stable Production Models (được chứng thực hạn ngạch ổn định: gemini-2.5-flash -> 2.0-flash -> 1.5-flash).
    2. Pro reasoning models (2.5-pro -> 1.5-pro).
    3. Gemma / Open weight models.
    4. Các model experimental/preview được hạ mức ưu tiên để tránh 429 quota exhaustion.
    """
    valid_candidates: List[str] = []
    for m in raw_models:
        clean = m.strip().replace("models/", "")
        lower = clean.lower()
        if not (lower.startswith("gemini-") or lower.startswith("gemma-")):
            continue
        if any(bad in lower for bad in DISALLOWED_SUBSTRINGS):
            continue
        valid_candidates.append(clean)

    if not valid_candidates:
        return list(SAFE_FALLBACK_GEMINI_MODELS)

    def score_model(name: str) -> float:
        clean = name.strip().replace("models/", "")
        lower = clean.lower()
        ver = extract_model_version(clean)
        base_score = 0.0

        # Ưu tiên model có hạn ngạch RPD/RPM cao nhất (Flash Lite 500 RPD / 15 RPM) trước các model 20 RPD / 5 RPM
        if clean == "gemini-3.5-flash-lite":
            base_score += 180.0
        elif clean == "gemini-3.1-flash-lite":
            base_score += 170.0
        elif clean == "gemini-3-flash-preview":
            base_score += 110.0
        elif clean == "gemini-3.5-flash":
            base_score += 100.0
        elif clean in SAFE_FALLBACK_GEMINI_MODELS:
            base_score += 20.0

        if "flash" in lower:
            base_score += 100.0
            # Các dòng Flash Lite 3.x được Google cấp hạn ngạch RPD gấp 25x (500/ngày) và RPM 3x (15/phút)
            if "lite" in lower:
                if "3.5" in lower:
                    base_score += 55.0
                elif "3." in lower:
                    base_score += 45.0
                else:
                    base_score += 10.0
            if "latest" in lower:
                base_score -= 25.0
            if any(term in lower for term in ("preview", "experimental", "exp", "thinking")):
                base_score -= 50.0
        elif "pro" in lower:
            base_score += 60.0
            if any(term in lower for term in ("preview", "experimental", "exp", "thinking")):
                base_score -= 50.0
        elif "gemma" in lower:
            base_score += 40.0
        else:
            base_score += 20.0

        # Ưu tiên phiên bản cao hơn (2.5 > 2.0 > 1.5)
        return base_score + (ver * 2.0)

    # Sắp xếp theo điểm số giảm dần
    ranked = sorted(set(valid_candidates), key=score_model, reverse=True)
    return ranked


async def get_available_gemini_models_async(
    api_key: Optional[str] = None,
    force_refresh: bool = False,
    high_quota_only: bool = False,
) -> List[str]:
    """
    Lấy danh sách các model Gemini khả dụng cho API Key.
    Ưu tiên:
    1. Cấu hình biến môi trường GEMINI_DEFAULT_MODEL / GEMINI_FALLBACK_MODELS (nếu có).
    2. Bộ nhớ đệm RAM (0ms).
    3. Tự động truy vấn Google API (GET /v1beta/models) và lưu RAM.
    4. Danh sách Safe Fallback nếu lỗi kết nối.
    Khi `high_quota_only=True`, lọc chỉ giữ các model hỏi đáp có RPD/RPM cao và ổn định.
    """
    def _maybe_filter(candidates: List[str]) -> List[str]:
        return filter_high_quota_chat_models(candidates) if high_quota_only else list(candidates)

    # 1. Kiểm tra cấu hình override từ biến môi trường máy chủ
    env_default = (getattr(settings, "GEMINI_DEFAULT_MODEL", None) or os.getenv("GEMINI_DEFAULT_MODEL", "")).strip()
    env_fallbacks_raw = (getattr(settings, "GEMINI_FALLBACK_MODELS", None) or os.getenv("GEMINI_FALLBACK_MODELS", "")).strip()

    if env_default:
        models = [env_default]
        if env_fallbacks_raw:
            for fb in env_fallbacks_raw.split(","):
                fb_clean = fb.strip()
                if fb_clean and fb_clean not in models:
                    models.append(fb_clean)
        return models

    # Lấy API key hợp lệ
    key = (api_key or "").strip()
    if not key or key == "MY_GEMINI_API_KEY" or len(key) < 10:
        from app.services.admin_key_vault import get_active_api_key_async
        key = (await get_active_api_key_async(provider="gemini")) or (settings.GEMINI_API_KEY or "").strip()

    if not key or key == "MY_GEMINI_API_KEY" or len(key) < 10:
        return _maybe_filter(SAFE_FALLBACK_GEMINI_MODELS)

    # 2. Kiểm tra bộ nhớ đệm RAM
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    now = time.time()
    if not force_refresh and key_hash in _MODEL_CACHE:
        cached_models, cached_at = _MODEL_CACHE[key_hash]
        if now - cached_at < MODEL_CACHE_TTL_SEC and cached_models:
            return _maybe_filter(cached_models)

    # 3. Khám phá từ Google Generative AI API trong thời gian thực
    url = "https://generativelanguage.googleapis.com/v1beta/models"
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                raw_models = [
                    m["name"] for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                ranked = filter_and_rank_gemini_models(raw_models)
                if ranked:
                    _MODEL_CACHE[key_hash] = (ranked, now)
                    logger.info("Gemini Dynamic Discovery: Đã nạp %d model cho key (%s...)", len(ranked), key[:6])
                    return _maybe_filter(ranked)
            else:
                logger.warning("Gemini Dynamic Discovery trả về HTTP %d: %s", res.status_code, res.text[:120])
    except Exception as e:
        logger.warning("Không thể tự động khám phá model Gemini từ Google API (%s). Sử dụng fallback.", e)

    # 4. Fallback nếu không kết nối được Google
    _MODEL_CACHE[key_hash] = (SAFE_FALLBACK_GEMINI_MODELS, now)
    return _maybe_filter(SAFE_FALLBACK_GEMINI_MODELS)


def invalidate_gemini_model_cache(api_key: Optional[str] = None) -> None:
    """Xóa bộ nhớ đệm khám phá model khi có thay đổi key."""
    if api_key:
        key_hash = hashlib.sha256(api_key.strip().encode("utf-8")).hexdigest()
        _MODEL_CACHE.pop(key_hash, None)
    else:
        _MODEL_CACHE.clear()
