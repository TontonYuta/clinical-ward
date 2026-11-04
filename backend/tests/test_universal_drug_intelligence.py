"""
Test suite kiểm thử Năng lực Dược Lâm Sàng Toàn Diện Đúng Với Mọi Thuốc (Universal Drug Intelligence)
Căn cứ: CSDL 54,885 thuốc Cục Quản Lý Dược (DAV), Dược Thư Quốc Gia Việt Nam 2015, QĐ 5948/QĐ-BYT.
"""
import pytest
from app.database import AsyncSessionLocal
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

@pytest.mark.asyncio
async def test_universal_coverage_10_drug_classes():
    """Kiểm tra độ phủ và tính chính xác trên 10 nhóm dược lý lớn trong CSDL."""
    test_drugs = [
        # (Query, Expected Drug Name in Response, Expected Legal Basis keyword)
        ("Thông tin thuốc Augmentin", "Augmentin", "Dược thư Quốc gia"),
        ("Thông tin thuốc Concor 5mg", "Concor", "Dược thư Quốc gia"),
        ("Thông tin thuốc Smecta", "Smecta", "Dược thư"),
        ("Thông tin thuốc Jardiance", "Jardiance", "Cục Quản lý Dược"),
        ("Thông tin thuốc Pregabalin", "Pregabalin", "Dược thư Quốc gia"),
        ("Thông tin thuốc Teglutik", "Teglutik", "Bộ Y Tế"),
        ("Thông tin thuốc Venclexta", "Venclexta", "Bộ Y Tế"),
        ("Thông tin thuốc Rocephin", "Rocephin", "Dược thư Quốc gia"),
        ("Thông tin thuốc Nexium", "Nexium", "Dược thư Quốc gia"),
        ("Thông tin thuốc Plavix", "Plavix", "Dược thư Quốc gia")
    ]
    async with AsyncSessionLocal() as db:
        for q, expected_name, expected_basis in test_drugs:
            resp = await lookup_drug_authoritative(q, db)
            assert resp.intent == "MEDICATION_SAFETY_PROFILE", f"Lỗi intent cho '{q}': {resp.intent}"
            assert expected_name.lower() in resp.reply_text.lower(), f"Không tìm thấy '{expected_name}' trong phản hồi của '{q}'"
            assert expected_basis.lower() in (resp.legal_basis or "").lower(), f"Nguồn pháp lý '{resp.legal_basis}' không chứa '{expected_basis}'"

@pytest.mark.asyncio
async def test_natural_condition_phrasing_not_tripped_by_symptoms():
    """Kiểm tra các câu hỏi chứa bệnh kèm (suy tim, suy thận, tiểu đường) không bị trích sai tên thuốc."""
    queries = [
        ("Concor có dùng cho người suy tim được không?", "Concor", "Bisoprolol"),
        ("Metformin uống lúc đói được không?", "Metformin", "sau bữa ăn"),
        ("Smecta uống trước hay sau ăn?", "Smecta", "xa bữa ăn")
    ]
    async with AsyncSessionLocal() as db:
        for q, expected_drug, expected_content in queries:
            resp = await lookup_drug_authoritative(q, db)
            assert resp.intent == "MEDICATION_SAFETY_PROFILE", f"Lỗi intent cho '{q}'"
            assert expected_drug.lower() in resp.reply_text.lower(), f"Không nhận diện được '{expected_drug}' trong '{q}'"
            assert expected_content.lower() in resp.reply_text.lower(), f"Thiếu nội dung lâm sàng '{expected_content}' trong '{q}'"

def test_trie_matcher_extracts_root_brand_names():
    """Kiểm tra Lexical Trie Matcher bóc tách chuẩn xác root brand name cho cả biệt dược có hàm lượng."""
    matcher = get_drug_lexical_matcher()
    test_queries = [
        ("Bệnh nhân cần uống Concor buổi sáng", "Concor"),
        ("Có thuốc Smecta trong kho không", "Smecta"),
        ("Dùng Augmentin 1g cho ca trực", "Augmentin"),
        ("Kê đơn Klacid cho người bệnh", "Klacid")
    ]
    for q, expected_root in test_queries:
        meds = matcher.extract_medications(q)
        assert len(meds) >= 1, f"Không trích xuất được thuốc từ '{q}'"
        assert any(expected_root.lower() in m.lower() for m in meds), f"Không tìm thấy '{expected_root}' trong {meds}"
