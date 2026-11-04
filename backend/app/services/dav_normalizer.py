from __future__ import annotations
import re
from typing import Any


def clean_brand_name(name: str | None) -> str:
    """Loại bỏ các thông tin nhà máy, cơ sở đóng gói, địa chỉ trong ngoặc của tên thuốc CSDL DAV."""
    if not name:
        return ""
    # Nếu có ghi chú nhà sản xuất/đóng gói/địa chỉ ở cuối, lược bỏ từ dấu mở ngoặc đến hết
    cleaned = re.sub(r"\s*\((?:Cơ sở|Nhà sản xuất|Địa chỉ|Đóng gói|Xuất xưởng|NSX).*?\)\s*$", "", name, flags=re.IGNORECASE)
    # Xử lý trường hợp ngoặc lồng nhau (Thailand)
    cleaned = re.sub(r"\s*\((?:Cơ sở|Nhà sản xuất|Địa chỉ|Đóng gói|Xuất xưởng|NSX)[^)]*(?:\([^)]*\)[^)]*)*\)", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[\s,\-]+$", "", cleaned)
    return cleaned.strip() or name


def _text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).replace("\u00a0", " ").split())
    return cleaned or None


def normalize_dav_record(raw: dict[str, Any]) -> dict[str, Any]:
    basic = raw.get("thongTinThuocCoBan") or {}
    manufacturer = raw.get("congTySanXuat") or {}
    applicant = raw.get("congTyDangKy") or {}
    registration = raw.get("thongTinDangKyThuoc") or {}
    # Accept the Vietnamese DAV payload and equivalent English fixture keys.
    active = _text(basic.get("hoatChatChinh") or raw.get("hoatChatChinh") or raw.get("tenHoatChatChinh") or raw.get("activeIngredient"))
    code = _text(raw.get("soDangKy") or raw.get("nationalCode"))
    flags = []
    if not code: flags.append("missing_national_code")
    if not active: flags.append("missing_active_ingredient")
    if active and re.search(r";|\+|\b(?:và|and)\b", active, re.IGNORECASE): flags.append("combination_candidate")
    if active and re.search(r"/", active): flags.append("slash_ambiguous_active_ingredient")
    if raw.get("isActive") is not True: flags.append("not_active_in_source")
    if raw.get("isDuocPhep") is False: flags.append("not_marked_permitted")
    if raw.get("isDaRutSoDangKy") is True: flags.append("registration_withdrawn")
    if raw.get("isHetHan") is True: flags.append("registration_expired")
    if raw.get("isDeleted") is True: flags.append("source_marked_deleted")
    raw_brand = _text(raw.get("tenThuoc") or raw.get("brandName") or raw.get("name"))
    return {
        "source_id": _text(raw.get("id") or raw.get("nationalCode") or code), "national_code": code, "brand_name": clean_brand_name(raw_brand),
        "active_ingredient_raw": active, "strength_raw": _text(basic.get("hamLuong") or raw.get("hamLuong")),
        "dosage_form": _text(basic.get("dangBaoChe") or raw.get("dangBaoChe")), "package_spec": _text(basic.get("dongGoi") or raw.get("dongGoi")),
        "standard_pharmacopeia": _text(basic.get("tieuChuan") or raw.get("tieuChuan")), "shelf_life": _text(basic.get("tuoiTho") or raw.get("tuoiTho")),
        "manufacturer": _text(manufacturer.get("tenCongTySanXuat") or raw.get("tenCongTySanXuat")), "manufacturer_country": _text(manufacturer.get("nuocSanXuat") or raw.get("nuocSanXuat")),
        "applicant": _text(applicant.get("tenCongTyDangKy") or raw.get("tenCongTyDangKy")), "applicant_country": _text(applicant.get("nuocDangKy") or raw.get("nuocDangKy")),
        "approval_date": _text(registration.get("ngayCapSoDangKy") or raw.get("ngayCapSoDangKy")), "expiry_date": _text(registration.get("ngayHetHanSoDangKy")),
        "approval_decision": _text(registration.get("soQuyetDinh") or raw.get("soQuyetDinh")), "is_active": raw.get("isActive"), "is_expired": raw.get("isHetHan"),
        "normalization_flags": flags,
    }
