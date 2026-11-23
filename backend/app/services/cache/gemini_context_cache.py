"""
Google Gemini Context Caching Manager for Clinical Ward AI Copilot.
Căn cứ:
1. Google Generative AI Context Caching API (v1beta/cachedContents).
2. Tối ưu chi phí token (giảm 75% giá input token cho nội dung lưu đệm).
3. Đảm bảo dung lượng vượt ngưỡng tối thiểu của Gemini (>= 2,048 tokens).
4. Cơ chế Transparent Fallback: tự động quay về chế độ thường nếu API không hỗ trợ.
"""

import time
import json
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple
import httpx

from app.config import settings

logger = logging.getLogger("gemini_context_cache")

# Hằng số thời gian sống của Cache trên hạ tầng Google (2 giờ = 7200 giây)
DEFAULT_CACHE_TTL_SEC = 7200
# Thời gian trừ hao trước khi hết hạn để tự động làm mới (refresh margin: 5 phút)
REFRESH_MARGIN_SEC = 300

# Bộ nhớ đệm cục bộ lưu thông tin các cache đang hoạt động
# Key: f"{key_hash}:{model}:{content_hash}" -> Value: {"name": str, "expire_time": float, "token_count": int}
_ACTIVE_CACHES: Dict[str, Dict[str, Any]] = {}


def _build_invariant_clinical_corpus() -> Tuple[str, str]:
    """
    Tạo nội dung tri thức lâm sàng bất biến cốt lõi của bệnh viện.
    Bao gồm System Instruction + Tri thức QĐ 5948 + TT 20/2017 + TT 51/2017 + TT 22/2011 + TT 36/2018.
    Đảm bảo tổng dung lượng > 2.048 tokens theo quy chuẩn kỹ thuật của Google.
    Trả về (system_instruction, corpus_content).
    """
    from app.services.copilot_gemini import SYSTEM_PROMPT
    from app.services.rag.lightrag_data import PHARMACOLOGICAL_CLASS_TAXONOMY, CLASS_INTERACTION_GRAPH

    taxonomy_lines = []
    for cls_key, cls_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        name_vi = cls_info.get("name_vi", cls_key)
        atc = cls_info.get("atc_prefix", "")
        members = ", ".join(cls_info.get("members", []))
        mechanism = cls_info.get("mechanism", "")
        taxonomy_lines.append(f"- **{name_vi} (Mã ATC: {atc})**: Hoạt chất gồm: {members}. Cơ chế: {mechanism}")

    ddi_lines = []
    for ddi in CLASS_INTERACTION_GRAPH:
        ca, cb = ddi["class_a"], ddi["class_b"]
        sev = ddi.get("severity", "")
        mech = ddi.get("mechanism", "")
        cons = ddi.get("consequence", "")
        mgmt = ddi.get("management", "")
        ddi_lines.append(f"- **{ca} + {cb}** [{sev}]:\n  • Cơ chế: {mech}\n  • Hậu quả: {cons}\n  • Xử trí: {mgmt}")

    corpus = f"""=== BỘ TRI THỨC DƯỢC LÂM SÀNG & PHÁP LÝ BỆNH VIỆN BẤT BIẾN (CLINICAL CORPUS) ===

1. CĂN CỨ PHÁP LÝ & QUY CHẾ QUẢN LÝ DƯỢC QUỐC GIA:
- Thông tư 20/2017/TT-BYT & Nghị định 54/2017/NĐ-CP:
  + Quy định chi tiết về quản lý thuốc kiểm soát đặc biệt (thuốc gây nghiện, hướng thần, tiền chất dùng làm thuốc).
  + Bắt buộc cơ chế kiểm soát hai chữ ký (Bác sĩ điều trị và Dược sĩ lâm sàng / Điều dưỡng trưởng).
  + Thuốc gây nghiện cấp cứu buồng bệnh (Morphin, Fentanyl) bắt buộc lập biên bản mượn, đối soát vỏ ống rỗng và thành lập hội đồng hủy vỏ ống định kỳ.
- Thông tư 22/2011/TT-BYT:
  + Quy định về tổ chức và hoạt động của Khoa Dược bệnh viện.
  + Quy chế tủ trực thuốc cấp cứu tại các khoa lâm sàng: cơ số cố định, bù kho theo mẫu số 01/TT22, bàn giao ca trực có ký nhận.
- Thông tư 51/2017/TT-BYT:
  + Hướng dẫn phòng, chẩn đoán và xử trí sốc phản vệ tại cơ sở khám bệnh, chữa bệnh.
  + Hộp thuốc cấp cứu phản vệ bắt buộc có tại tất cả các buồng tiêm, phòng khám, xe tiêm cấp cứu.
  + Thuốc thiết yếu cấp cứu hàng đầu: Adrenalin 1mg/1ml tiêm bắp ngay lập tức khi xuất hiện triệu chứng phản vệ từ độ II trở lên (khó thở, tụt HA, mày đay phù mạch cấp). Liều người lớn: 1/2 đến 1 ống tiêm bắp đùi trước ngoài, nhắc lại mỗi 3-5 phút nếu chưa hồi phục.
- Thông tư 36/2018/TT-BYT (Thực hành tốt bảo quản thuốc GSP):
  + Bảo quản thuốc và vắc xin theo chuỗi lạnh nghiêm ngặt 2.0°C đến 8.0°C.
  + Theo dõi nhiệt độ tự động, tính toán nhiệt độ động học trung bình (MKT).
  + Ứng phó sự cố mất điện: kích hoạt bình tích lạnh, cách ly lô hàng quá nhiệt để kiểm định chất lượng trước khi tái sử dụng.
- Quyết định 5948/QĐ-BYT:
  + Danh mục các cặp tương tác thuốc chống chỉ định trong thực hành lâm sàng tại cơ sở khám chữa bệnh.

2. HỆ THỐNG PHÂN LOẠI DƯỢC LÝ ATC & CON ĐƯỜNG CHUYỂN HÓA ENZYM GAN:
{chr(10).join(taxonomy_lines)}

3. MA TRẬN TƯƠNG TÁC THUỐC CẤP NHÓM CHỐNG CHỈ ĐỊNH (QĐ 5948/QĐ-BYT):
{chr(10).join(ddi_lines)}

4. NGUYÊN TẮC AN TOÀN VÀ ĐIỀU KIỆN KÊ ĐƠN:
- Bệnh nhân suy thận: Điều chỉnh liều lượng theo mức lọc cầu thận eGFR hoặc độ thanh thải Creatinin (ClCr). Chống chỉ định Metformin và NSAID khi eGFR < 30 mL/phút/1.73m2.
- Phụ nữ có thai: Chống chỉ định tuyệt đối nhóm ức chế men chuyển (ACEi) và chẹn thụ thể Angiotensin II (ARB) do nguy cơ quái thai, suy thận và thiểu ối thai nhi.
- Chống chỉ định phối hợp kép 2 thuốc cùng cơ chế hạ áp ức chế hệ RAAS (ACEi + ARB) do làm tăng tử vong do suy thận cấp và tăng kali máu ngừng tim."""

    return SYSTEM_PROMPT, corpus


# Khởi tạo nội dung tĩnh một lần
_INVARIANT_SYSTEM_PROMPT, _INVARIANT_CLINICAL_CORPUS = _build_invariant_clinical_corpus()
_CORPUS_HASH = hashlib.sha256(f"{_INVARIANT_SYSTEM_PROMPT}\0{_INVARIANT_CLINICAL_CORPUS}".encode("utf-8")).hexdigest()[:16]


def get_cache_signature(api_key: str, model: str) -> str:
    """Tạo khóa định danh duy nhất cho bộ cache theo Key, Model và mã băm Corpus."""
    key_hash = hashlib.sha256((api_key or "").strip().encode("utf-8")).hexdigest()[:12]
    return f"{key_hash}:{model}:{_CORPUS_HASH}"


class GeminiContextCacheManager:
    """Quản lý vòng đời bộ đệm ngữ cảnh Gemini Context Caching."""

    @staticmethod
    def get_cached_content_name(api_key: str, model: str) -> Optional[str]:
        """
        Kiểm tra xem có cache hợp lệ còn hạn sử dụng hay không.
        Nếu còn hạn > REFRESH_MARGIN_SEC, trả về tên tài nguyên cache (cachedContents/xyz).
        """
        sig = get_cache_signature(api_key, model)
        cached_info = _ACTIVE_CACHES.get(sig)
        if not cached_info:
            return None

        expire_time = cached_info.get("expire_time", 0.0)
        now = time.time()
        if expire_time - now > REFRESH_MARGIN_SEC:
            return cached_info.get("name")

        # Cache sắp hết hạn hoặc đã hết hạn, xóa khỏi bộ nhớ đệm
        _ACTIVE_CACHES.pop(sig, None)
        return None

    @classmethod
    async def get_or_create_context_cache(
        cls,
        api_key: str,
        model: str,
        timeout_sec: float = 6.0
    ) -> Optional[str]:
        """
        Lấy cache hiện có hoặc tự động tạo mới tài nguyên cache trên Google API.
        Nếu tạo thất bại (ví dụ API key không đủ quyền hoặc model không hỗ trợ), trả về None để fallback.
        """
        if not api_key or api_key == "MY_GEMINI_API_KEY" or len(api_key.strip()) < 10:
            return None

        # 1. Kiểm tra cache còn hạn
        existing_name = cls.get_cached_content_name(api_key, model)
        if existing_name:
            return existing_name

        # 2. Tạo mới cache trên Google Generative AI REST API
        sig = get_cache_signature(api_key, model)
        url = "https://generativelanguage.googleapis.com/v1beta/cachedContents"
        headers = {
            "x-goog-api-key": api_key.strip(),
            "Content-Type": "application/json"
        }

        # Model format: models/gemini-2.5-flash
        model_resource = f"models/{model}" if not model.startswith("models/") else model
        payload = {
            "model": model_resource,
            "displayName": f"clinical_ward_corpus_{_CORPUS_HASH}",
            "systemInstruction": {
                "parts": [{"text": _INVARIANT_SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": _INVARIANT_CLINICAL_CORPUS}]
                }
            ],
            "ttl": f"{DEFAULT_CACHE_TTL_SEC}s"
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=3.0)) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200 or res.status_code == 201:
                    data = res.json()
                    cache_name = data.get("name")
                    expire_time_str = data.get("expireTime")
                    token_count = data.get("usageMetadata", {}).get("totalTokenCount", 0)

                    # Chuyển đổi expireTime (ISO 8601) sang timestamp float
                    expire_ts = time.time() + DEFAULT_CACHE_TTL_SEC
                    if expire_time_str:
                        try:
                            from datetime import datetime, timezone
                            clean_iso = expire_time_str.replace("Z", "+00:00")
                            expire_dt = datetime.fromisoformat(clean_iso)
                            expire_ts = expire_dt.timestamp()
                        except Exception:
                            expire_ts = time.time() + DEFAULT_CACHE_TTL_SEC

                    if cache_name:
                        _ACTIVE_CACHES[sig] = {
                            "name": cache_name,
                            "expire_time": expire_ts,
                            "token_count": token_count,
                            "created_at": time.time()
                        }
                        logger.info("Khởi tạo Gemini Context Cache thành công: %s (%d tokens, model=%s)", cache_name, token_count, model)
                        return cache_name
                else:
                    logger.debug("Không thể tạo Gemini Context Cache (HTTP %d): %s", res.status_code, res.text[:200])
        except Exception as e:
            logger.debug("Lỗi kết nối khi tạo Gemini Context Cache: %s", e)

        return None

    @classmethod
    def invalidate_all_caches(cls) -> None:
        """Xóa toàn bộ cache trong RAM khi có thay đổi văn bản quy chuẩn."""
        _ACTIVE_CACHES.clear()
        logger.info("Đã làm mới toàn bộ Gemini Context Cache.")


# Hàm tiện ích dùng chung
async def get_active_context_cache(api_key: str, model: str) -> Optional[str]:
    """Helper truy xuất nhanh cache name cho cuộc gọi LLM."""
    return await GeminiContextCacheManager.get_or_create_context_cache(api_key, model)
