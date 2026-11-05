"""Helper formatting and citation extraction for drug profiles (<=65 LOC)."""
import re
import json
from pathlib import Path
from app.models.registry import DavNationalDrug


def format_clinical_text(text: str) -> str:
    """Join PDF line wraps while preserving blank line paragraphs and list items."""
    lines = [line.rstrip() for line in text.splitlines()]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if re.match(r"^(?:[-•*]|[0-9]+[.)])", stripped):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            paragraphs.append(stripped)
        else:
            current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs)


def truncate_clinical_excerpt(text: str, max_length: int = 240) -> str:
    """Truncate clinical excerpt cleanly at sentence, punctuation, or word boundary <= max_length."""
    if not text or len(text) <= max_length:
        return text
    limit = max_length - 4
    candidate = text[:limit]
    cut_pos = -1
    for sep in (". ", "\n"):
        pos = candidate.rfind(sep)
        if pos >= limit - 90:
            cut_pos = max(cut_pos, pos + (1 if sep == ". " else 0))
    if cut_pos == -1:
        for sep in ("; ", ": "):
            pos = candidate.rfind(sep)
            if pos >= limit - 60:
                cut_pos = max(cut_pos, pos + (1 if sep == "; " else 0))
    if cut_pos > 0:
        truncated = candidate[:cut_pos].rstrip()
    else:
        last_space = candidate.rfind(" ")
        truncated = candidate[:last_space].rstrip() if last_space >= limit - 50 else candidate.rstrip()
    if not truncated.endswith((".", "…", "!", "?")):
        truncated += "…"
    if truncated.count("**") % 2 == 1:
        truncated += "**"
    if truncated.count("`") % 2 == 1:
        truncated += "`"
    return truncated[:max_length - 1].rstrip() + "…" if len(truncated) > max_length else truncated


def build_drug_citation(
    matched: DavNationalDrug,
    monograph: object | None,
    source: str,
    target_field: str | None = None
) -> dict:
    legal = source or getattr(monograph, "source", None) or getattr(matched, "clinical_source", None) or ""
    page_match = re.search(r"Trang\s*(\d+)", legal, re.IGNORECASE)
    page = int(page_match.group(1)) if page_match else None
    manifest_path = Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "clinical_source_manifest.json"
    try:
        sources = json.loads(manifest_path.read_text(encoding="utf-8")).get("sources", [])
    except (OSError, ValueError, TypeError):
        sources = []
    dtqg = next((item for item in sources if item.get("id") == "dtqg-v2-2015"), None)
    has_dtqg_provenance = bool(legal and "dược thư" in legal.casefold() and dtqg)
    title = "Dược thư Quốc gia Việt Nam, lần xuất bản II" if has_dtqg_provenance else "Cơ sở dữ liệu đăng ký thuốc Cục Quản lý Dược"
    url = f"/{dtqg['public_path'].removeprefix('public/')}" if has_dtqg_provenance else "https://dichvucong.dav.gov.vn/congbothuoc/index"
    document_id = "dtqg-v2-2015" if has_dtqg_provenance else "dav-registry"
    if has_dtqg_provenance and page:
        url += f"#page={page}"

    excerpt = ""
    candidate_fields = []
    if target_field:
        candidate_fields.append(target_field)
    candidate_fields.extend([
        "indications", "adult_dosage", "contraindications", "precautions",
        "adverse_effects", "pediatric_dosage", "composition", "description"
    ])

    seen_fields = set()
    for field in candidate_fields:
        if field in seen_fields:
            continue
        seen_fields.add(field)
        val = (getattr(monograph, field, None) if monograph is not None else None) or getattr(matched, field, None)
        if val and str(val).strip():
            excerpt = format_clinical_text(str(val)).strip()
            break

    if not excerpt:
        excerpt = str(getattr(matched, "indications", "") or "").strip()
    excerpt = truncate_clinical_excerpt(excerpt, max_length=240)
    clean_section = getattr(monograph, "inn", None) or matched.active_ingredient or getattr(monograph, "title", None) or matched.brand_name
    return {
        "source": title, "legal_basis": legal or "Cục Quản lý Dược (DAV)",
        "section": clean_section,
        "excerpt": excerpt, "document_id": document_id, "url": url, "page": page if has_dtqg_provenance else None,
    }


def extract_inline_citation_token(source_str: str) -> str:
    """Trích xuất token dẫn chứng trực tiếp định dạng [Dược thư tr.XXX] hoặc [QĐ 5948] chuẩn tương thích frontend."""
    if not source_str:
        return "[Dược thư]"
    page_m = re.search(r"Trang\s*(\d+)", source_str, re.IGNORECASE)
    if page_m:
        return f"[Dược thư tr.{page_m.group(1)}]"
    if "5948" in source_str:
        return "[QĐ 5948]"
    if "51" in source_str:
        return "[TT 51]"
    if "26" in source_str:
        return "[TT 26]"
    if "20" in source_str:
        return "[TT 20]"
    if "22" in source_str:
        return "[TT 22]"
    if "dược thư" in source_str.lower() or "dtqg" in source_str.lower():
        return "[Dược thư]"
    return "[DĐVN V]"


def smart_unfold_clinical_text(raw_text: str) -> str:
    """Xử lý rách dòng do căn lề/OCR và chuẩn hóa tiêu đề lâm sàng."""
    if not raw_text:
        return ""
    # 1. Khử tiêu đề đầu trang lặp lại và OCR glitches
    text = re.sub(r'Paracetamol\s*\((?:acetaminophen)?\)\s*Paracetamol', 'Paracetamol', raw_text, flags=re.IGNORECASE)
    text = re.sub(r'^\s*\(ADR\)\s*', '', text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r'\bĐau\s+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ])', r'Giảm đau: \1', text)
    text = re.sub(r'\bSốt\s+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ])', r'Hạ sốt: \1', text)

    continuation_words = {
        'tối đa', 'cách', 'hoặc', 'và', 'trên', 'dưới', 'khoảng', 'sau đó',
        'nếu cần', 'chia thành', 'chia làm', 'liều', 'cho', 'với', 'trong', 'ở', 'lần', 'mỗi', 'từ', 'đến'
    }

    lines = text.splitlines()
    merged_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if not merged_lines:
            merged_lines.append(stripped)
            continue

        prev = merged_lines[-1]
        prev_words = prev.lower().split()
        last_word = prev_words[-1].rstrip('.,;:') if prev_words else ''
        last_two = ' '.join([w.rstrip('.,;:') for w in prev_words[-2:]]) if len(prev_words) >= 2 else ''

        is_bullet = bool(re.match(r'^(?:[•\-\*]|\d+[\.\)])\s+', stripped))
        is_header = bool(re.match(r'^(?:Người lớn|Trẻ em|Đường uống|Uống|Đặt trực tràng|Truyền tĩnh mạch|Tiêm tĩnh mạch|Liều dùng|Cách dùng|Thường gặp|Ít gặp|Hiếm gặp):', stripped))

        needs_join = False
        if not is_bullet and not is_header:
            if prev.strip().endswith(':'):
                if not re.match(r'^(?:Người lớn|Trẻ em|Cách dùng|Liều lượng):\s*$', prev.strip(), re.IGNORECASE):
                    if re.match(r'^\s*\d+\s*(?:mg|g|ml|kg|lần|viên|–|-)', stripped, re.IGNORECASE) or re.match(r'^\s*Liều\b', stripped, re.IGNORECASE):
                        needs_join = True
            elif prev.endswith((',', ';', '-', '(', '<', '>', ':.')) or last_word in continuation_words or last_two in continuation_words:
                needs_join = True
            elif not prev.endswith(('.', '!', '?', ':')):
                needs_join = True

        if needs_join:
            if prev.endswith(':.'):
                merged_lines[-1] = prev[:-1]
            merged_lines[-1] = merged_lines[-1] + ' ' + stripped
        else:
            merged_lines.append(stripped)

    return '\n'.join(merged_lines)


def split_clinical_chunks(raw_text: str) -> list[str]:
    """Phân rã văn bản lâm sàng thô thành các cụm thông tin độc lập, chuẩn hóa câu và khử trùng lặp 100%."""
    raw_text = smart_unfold_clinical_text(raw_text).strip()
    items = []
    if "•" in raw_text or "\n-" in raw_text or "\n*" in raw_text:
        raw_lines = raw_text.split("•") if "•" in raw_text else raw_text.splitlines()
        lines = [re.sub(r'^[•\-\*]\s*', '', l.strip()) for l in raw_lines if l.strip()]
        for l in lines:
            if l and len(l) > 3:
                items.append(l)
    else:
        lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
        for line in lines:
            sentences = [s.strip() for s in re.split(r'(?<=\.)\s+(?=[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ])', line) if s.strip()]
            for s in sentences:
                if s and len(s) > 3:
                    items.append(s)
    seen = set()
    deduped = []
    for it in items:
        cleaned = it.rstrip(';. ')
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            if not cleaned.endswith(('.', '!', '?', ':')):
                it = cleaned + '.'
            else:
                it = cleaned
            deduped.append(it)
    return deduped


def format_flat_field_inquiry(
    drug_name: str,
    drug_inn: str,
    field_data: list[tuple[str, str, str]],  # (field_key, req_label, val_text)
    source: str,
    user_name: str = "Bác sĩ"
) -> str:
    """Định dạng phản hồi Cụm Thông Tin Lâm Sàng: trực diện, súc tích, gắn duy nhất 1 nguồn ở cuối phản hồi."""
    default_token = extract_inline_citation_token(source)
    inn_title = drug_inn.title() if drug_inn else ""
    drug_title = drug_name if (drug_inn and drug_inn.lower() in drug_name.lower()) else (f"{drug_name} ({inn_title})" if inn_title else drug_name)
    labels = [fd[1] for fd in field_data]

    if len(field_data) == 1:
        header = f"**{labels[0]} của {drug_title}:**"
    else:
        header = f"**Thông tin chuyên môn về {drug_title}:**"

    def get_cluster_token(key: str, label: str, text: str) -> str:
        k_lower = key.lower()
        l_lower = label.lower()
        if "interaction" in k_lower or "tương tác" in l_lower or "5948" in text:
            return "[QĐ 5948]"
        if "anaphylaxis" in k_lower or "phản vệ" in l_lower or "51/2017" in text:
            return "[TT 51/2017/TT-BYT]"
        if "prescription" in k_lower or "kê đơn" in l_lower or "26/2025" in text:
            return "[TT 26/2025/TT-BYT]"
        return default_token

    body_parts = []
    if len(field_data) == 1:
        key, label, val = field_data[0]
        single_token = get_cluster_token(key, label, val)
        if val.startswith("[") and "\n" in val:
            lines = []
            for l in val.splitlines():
                sl = l.strip()
                if not sl:
                    continue
                sl_clean = re.sub(r'\s*\[(?:DTQG|Dược thư|QĐ\s*5948|QĐ-BYT|TT\s*\d+)[\s\w.:,/–-]*\]', '', sl)
                lines.append(sl_clean)
            body_parts.append("\n".join(lines))
        else:
            chunks = split_clinical_chunks(val)
            if not chunks:
                chunks = [val.strip()]
            clean_chunks = []
            for c in chunks:
                c_clean = re.sub(r'\s*\[(?:DTQG|Dược thư|QĐ\s*5948|QĐ-BYT|TT\s*\d+)[\s\w.:,/–-]*\]', '', c).strip()
                clean_chunks.append(f"• {c_clean}")
            body_parts.append("\n".join(clean_chunks))
    else:
        has_ddi_only = all("interaction" in k.lower() or "tương tác" in l.lower() for k, l, _ in field_data)
        single_token = "[QĐ 5948]" if has_ddi_only else default_token

        for key, label, val in field_data:
            if val.startswith("[") and "\n" in val:
                sub_lines = []
                for l in val.splitlines():
                    sl = l.strip()
                    if not sl:
                        continue
                    sl_clean = re.sub(r'\s*\[(?:DTQG|Dược thư|QĐ\s*5948|QĐ-BYT|TT\s*\d+)[\s\w.:,/–-]*\]', '', sl)
                    if sl_clean.startswith(">") or sl_clean.startswith("#"):
                        sub_lines.append(f"  {sl_clean}")
                    elif re.match(r"^[•\-\*]", sl_clean):
                        core = re.sub(r"^[•\-\*]\s*", "", sl_clean)
                        sub_lines.append(f"  - {core}")
                    else:
                        sub_lines.append(f"  - {sl_clean}")
                body_parts.append(f"• **{label}:**\n" + "\n".join(sub_lines))
            else:
                chunks = split_clinical_chunks(val)
                if not chunks:
                    chunks = [val.strip()]
                sub_lines = []
                for c in chunks:
                    c_clean = re.sub(r'\s*\[(?:DTQG|Dược thư|QĐ\s*5948|QĐ-BYT|TT\s*\d+)[\s\w.:,/–-]*\]', '', c).strip()
                    sub_lines.append(f"  - {c_clean}")
                body_parts.append(f"• **{label}:**\n" + "\n".join(sub_lines))

    return f"{header}\n\n" + "\n\n".join(body_parts) + f"\n\nNguồn: {single_token}"

