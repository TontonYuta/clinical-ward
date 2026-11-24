"""
Kiểm thử bộ định tuyến điều hướng phân hệ (Semantic Navigation Router) & Chống cướp quyền kê đơn CPOE.
Xác nhận 100%:
1. Các câu lệnh mở tab (CPOE, Kho FEFO, Tủ trực, Chuỗi lạnh, Thiết bị, BHYT) được nhận diện chính xác qua ngữ nghĩa.
2. Các câu hỏi chuyên môn y khoa có chứa từ 'kê đơn' KHÔNG bị cướp quyền (hijack) thành form CPOE rỗng.
3. Các câu hỏi về hạn dùng / bảo quản KHÔNG bị cướp quyền thành bảng báo cáo kho FEFO.
4. Hành vi lập đơn thuốc có bệnh nhân cụ thể vẫn hoạt động chuẩn xác theo Thông tư 26/2025/TT-BYT.
"""

import pytest
from app.services.chatbot.semantic_navigation_router import (
    route_semantic_navigation,
    is_clinical_or_educational_inquiry,
)
from app.services.chatbot.hospital_business_dispatcher import (
    dispatch_clinical_subflows,
    dispatch_operational_business,
)

@pytest.mark.asyncio
async def test_semantic_navigation_cpoe():
    """Nhận diện chính xác yêu cầu mở tab kê đơn CPOE."""
    queries = [
        "mở tab kê đơn",
        "chuyển sang màn hình kê đơn thuốc CPOE",
        "mở form kê đơn điện tử",
        "vào tab kê đơn cpoe"
    ]
    for q in queries:
        res = await route_semantic_navigation(q, q.lower(), user_role="doctor")
        assert res is not None, f"Failed for query: {q}"
        assert res.intent == "NAVIGATE_TAB"
        assert res.card is not None
        assert res.card.target_tab == "cpoe"
        assert res.card.data.get("openModal") == "cpoe_prescription"

@pytest.mark.asyncio
async def test_semantic_navigation_other_tabs():
    """Nhận diện chính xác yêu cầu mở các phân hệ khác (Kho FEFO, Tủ trực, Chuỗi lạnh, BHYT, Thiết bị)."""
    tab_cases = [
        ("mở tab kho dược", "fefo"),
        ("chuyển sang tab FEFO", "fefo"),
        ("mở tab tủ trực", "debt"),
        ("chuyển sang màn hình sổ nợ cấp cứu", "debt"),
        ("mở tab chuỗi lạnh", "coldchain"),
        ("chuyển sang màn hình giám sát kho lạnh", "coldchain"),
        ("mở tab thiết bị y tế", "equipment"),
        ("chuyển sang màn hình quản lý máy móc", "equipment"),
        ("mở tab văn bản pháp quy", "documents"),
        ("chuyển sang màn hình danh mục BHYT", "documents"),
        ("chuyển về màn hình tổng quan", "overview"),
    ]
    for query, expected_tab in tab_cases:
        res = await route_semantic_navigation(query, query.lower(), user_role="doctor")
        assert res is not None, f"Failed to route navigation for: {query}"
        assert res.intent == "NAVIGATE_TAB"
        assert res.card is not None
        assert res.card.target_tab == expected_tab, f"Expected {expected_tab}, got {res.card.target_tab} for: {query}"

@pytest.mark.asyncio
async def test_clinical_inquiries_with_prescribing_keywords_not_hijacked():
    """
    Các câu hỏi chuyên môn y khoa chứa từ 'kê đơn' TUYỆT ĐỐI KHÔNG bị nuốt thành form CPOE rỗng
    hoặc thông báo thiếu định danh người bệnh. Chúng phải trả về None để pipeline RAG giải đáp.
    """
    clinical_queries = [
        "Nguyên tắc kê đơn kháng sinh hợp lý theo hướng dẫn Bộ Y Tế",
        "Khi kê đơn Paracetamol cho bệnh nhân suy gan cần lưu ý những gì?",
        "Kê đơn thuốc ngoại trú tối đa bao nhiêu ngày theo thông tư mới?",
        "Lưu ý gì khi kê đơn phối hợp thuốc chống đông với NSAID?",
        "Bác sĩ cần kê đơn hạ sốt cho trẻ 10kg, liều lượng và khoảng cách dùng thế nào?",
        "Cách kê đơn Morphin giảm đau cho bệnh nhân ung thư giai đoạn cuối",
        "Đơn thuốc có Augmentin và Paracetamol có tương tác không?",
    ]
    for q in clinical_queries:
        # 1. semantic_navigation_router phải bỏ qua
        nav_res = await route_semantic_navigation(q, q.lower(), user_role="doctor")
        assert nav_res is None, f"Clinical query was falsely captured by semantic navigation: {q}"

        # 2. is_clinical_or_educational_inquiry phải nhận diện là câu hỏi chuyên môn
        assert is_clinical_or_educational_inquiry(q, q.lower()) is True, f"Failed to recognize clinical inquiry: {q}"

        # 3. dispatch_clinical_subflows phải trả về None (không cướp quyền)
        subflow_res = await dispatch_clinical_subflows(q, q.lower(), "Bác sĩ Test", None, user_role="doctor")
        assert subflow_res is None, f"Clinical query was hijacked by CPOE subflow: {q}"

@pytest.mark.asyncio
async def test_shelf_life_inquiries_not_hijacked_by_fefo():
    """
    Câu hỏi chuyên môn về hạn dùng hoặc bảo quản không bị cướp quyền thành bảng danh mục kho FEFO.
    """
    shelf_life_queries = [
        "Hạn dùng của Paracetamol sau khi mở nắp là bao lâu?",
        "Nhiệt độ bảo quản của vắc xin là bao nhiêu độ C?",
        "Thuốc kháng sinh pha hỗn dịch để được mấy ngày trong tủ lạnh?",
        "Bảo quản insulin chưa mở nắp ở nhiệt độ nào là an toàn?",
    ]
    for q in shelf_life_queries:
        ops_res = await dispatch_operational_business(q, q.lower(), "Bác sĩ Test", None)
        assert ops_res is None, f"Knowledge inquiry was falsely hijacked by operational dispatcher: {q}"

@pytest.mark.asyncio
async def test_cpoe_explicit_prescription_drafting_works():
    """
    Khi bác sĩ thực sự yêu cầu kê đơn cho bệnh nhân cụ thể với tên thuốc,
    hệ thống chuẩn bị bản nháp CPOE Action Card bình thường.
    """
    query = "Kê đơn cho bệnh nhân Trần Thị Mai viêm họng dùng Augmentin 1g"
    res = await dispatch_clinical_subflows(query, query.lower(), "BS. Đỗ Minh Tuấn", None, user_role="doctor")
    assert res is not None
    assert res.intent in ("CPOE_PRESCRIPTION", "CPOE_CLARIFICATION")
    assert res.card is not None
    assert res.card.target_tab == "cpoe"
