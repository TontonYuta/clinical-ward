"""
Bản Đồ 10 Đại Nghiệp Vụ Bệnh Viện & Quy Trình Lâm Sàng Chuẩn Bộ Y Tế (<=120 LOC)
"""

from app.schemas.copilot import CopilotResponse, CopilotActionCard

CLINICAL_BUSINESS_DIRECTORY = """### 🏥 BẢN ĐỒ 10 ĐẠI NGHIỆP VỤ BỆNH VIỆN & TRỢ LÝ LÂM SÀNG TỰ ĐỘNG

Hệ thống Trợ lý Agent Lâm Sàng được thiết kế tuân thủ nghiêm ngặt các Thông tư, Nghị định của Bộ Y tế và Chính phủ:

1. **Xuất nợ & Mượn khẩn cấp tủ trực ca đêm** *(Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT)*:
   • Tự động sinh phiếu mượn, phân tích CDSS phát hiện tương tác thuốc nghiêm trọng, cảnh báo quá liều.
   • *Lệnh mẫu:* `"Cho 2 lọ Morphin cấp cứu bệnh nhân phòng 1"`, `"Kê 1 lọ Ceftriaxone"`.

2. **Thu hồi vỏ ống & Tiêu hủy thuốc gây nghiện** *(Điều 15 & 16 Thông tư 20/2017/TT-BYT)*:
   • Thu hồi 100% vỏ ống sau tiêm; lập biên bản 3 bên khi rơi vỡ; thành lập hội đồng tiêu hủy vỏ ống.
   • *Lệnh mẫu:* `"Kiểm tra nợ vỏ morphin"`, `"Quy định thu hồi vỏ ống morphin theo thông tư 20"`.

3. **Giao ban & Đối soát ca trực 07:00 AM** *(Thông tư 22/2011/TT-BYT)*:
   • Tự động đối soát nợ ca đêm, phát hiện lệch số lượng sổ sách, tổng hợp cơ số tủ trực.
   • *Lệnh mẫu:* `"Đối soát ca trực đêm qua"`, `"Giao ban ca trực sáng 07:00 AM"`.

4. **Kho Dược GSP & Hạn dùng FEFO** *(Thông tư 36/2018/TT-BYT)*:
   • Xuất kho ưu tiên cận hạn trước (First Expired, First Out); quét thuốc hạn dưới 60 ngày.
   • *Lệnh mẫu:* `"Thuốc nào cận hạn dưới 60 ngày"`, `"Kiểm tra date thuốc trong kho"`.

5. **Lập phiếu dự trù bù thuốc Mẫu 01/TT22** *(Thông tư 22/2011/TT-BYT)*:
   • Quét các mặt hàng chạm ngưỡng Min; tự động tính số lượng bù về cơ số tủ trực tiêu chuẩn.
   • *Lệnh mẫu:* `"Lập phiếu dự trù bù tồn kho"`, `"Dự trù cơ số mẫu 01"`.

6. **Báo hỏng, bảo trì & Kiểm định TBYT** *(Nghị định 98/2021/NĐ-CP)*:
   • Tiếp nhận sự cố máy thở, máy sốc tim; phân loại rủi ro Loại A-B-C-D; an toàn điện IEC 60601-1.
   • *Lệnh mẫu:* `"Máy thở PB840 phòng mổ 2 bị xì khí"`, `"Máy sốc tim Zoll lỗi pin"`.

7. **Chuỗi lạnh Vắc xin & Nhiệt động học MKT** *(WHO PQS & Thông tư 36/2018)*:
   • Theo dõi dải nhiệt 2.0°C - 8.0°C; tính chỉ số Arrhenius MKT; quy trình biệt trữ khi mất điện.
   • *Lệnh mẫu:* `"Nhiệt độ tủ lạnh bảo quản vắc xin thế nào"`, `"Kiểm tra datalogger buồng lạnh"`.

8. **Sổ kiểm toán bất biến & Chống gian lận** *(Nghị định 130/2018/NĐ-CP)*:
   • Xác thực chuỗi băm mật mã HMAC-SHA256 liên kết từng giao dịch; chống chối bỏ trách nhiệm.
   • *Lệnh mẫu:* `"Kiểm tra tính toàn vẹn sổ kiểm toán"`.

9. **Thị giác AI bóc tách hóa đơn dược (Vision OCR)**:
   • Quét hóa đơn CPC1, hóa đơn VAT; tự động trích xuất số lô, hạn dùng, đơn giá vào kho.
   • *Lệnh mẫu:* `"Quét hóa đơn dược phẩm cpc1"`, `"Bóc tách hóa đơn giao hàng"`.

10. **Cổng Tra Cứu Dược Quốc Gia 54.885 SĐK** *(Cục Quản lý Dược)*:
    • Tra cứu chính xác 100/100 theo SĐK, biệt dược, hoạt chất; đối soát tồn kho bệnh viện.
    • *Lệnh mẫu:* `"Thông tin thuốc Rocephin"`, `"SĐK VD-24757-16 là thuốc gì"`.
"""

async def handle_business_overview_intent() -> CopilotResponse:
    card = CopilotActionCard(
        card_type="shift_handover_report",
        title="Danh Mục Nghiệp Vụ Lâm Sàng Bệnh Viện",
        summary="10 Quy trình quản lý Dược, Thiết Bị Y Tế & Chuỗi Lạnh theo Thông tư Bộ Y tế",
        data={"total_workflows": 10, "status": "active"},
        primary_action_label="Xem Kho Dược FEFO",
        primary_action_type="OPEN_FEFO_MODAL"
    )
    return CopilotResponse(
        intent="BUSINESS_OVERVIEW",
        reply_text=CLINICAL_BUSINESS_DIRECTORY,
        card=card,
        legal_basis="Thông tư 22/2011, TT 20/2017, TT 51/2017 & Nghị định 98/2021",
        suggested_chips=["Đối soát ca trực 07:00 AM", "Tra cứu SĐK VD-24757-16", "Thuốc cận hạn FEFO", "Báo hỏng máy thở PB840"]
    )
