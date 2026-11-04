"""
Bản Đồ 8 Đại Nghiệp Vụ Lâm Sàng Bệnh Viện & Quy Trình Chuẩn Bộ Y Tế (<=120 LOC)
"""

from app.schemas.copilot import CopilotResponse

CLINICAL_BUSINESS_DIRECTORY = """### 🏥 HỆ THỐNG TRỢ LÝ DƯỢC LÂM SÀNG & QUY TRÌNH BỆNH VIỆN

Hệ thống Trợ lý Agent Lâm Sàng được thiết kế tuân thủ nghiêm ngặt các Thông tư, Nghị định của Bộ Y tế và Luật Khám bệnh, chữa bệnh:

1. **Thẩm định đơn thuốc tự động (AI Prescription Audit)** *(Thông tư 26/2025/TT-BYT & TT 52/2017/TT-BYT)*:
   • Rà soát thể thức đơn đúng quy định pháp luật hiện hành.
   • Kiểm tra nội dung đơn thuốc phù hợp chẩn đoán (ICD-10 vs DĐVN V).
   • Đánh giá liều dùng phù hợp theo lứa tuổi, cân nặng và bệnh lý.
   • Cảnh báo tương tác chống chỉ định (QĐ 5948/QĐ-BYT) và lưu ý thời điểm, cách dùng thuốc.
   • *Lệnh mẫu:* `"Kiểm tra đơn thuốc RX-2026-604"`, `"Thẩm định đơn thuốc cho bệnh nhân"`.

2. **Kê đơn thuốc điện tử CPOE & Chặn tương tác nguy hiểm**:
   • Hỗ trợ bác sĩ lập đơn thuốc ngoại trú/nội trú chuẩn hóa theo quy chuẩn.
   • Tự động cảnh báo tương tác thuốc tức thì (CDSS) khi thêm thuốc vào đơn.
   • *Lệnh mẫu:* `"Mở form kê đơn CPOE"`, `"Kê Paracetamol cho bệnh nhân Nguyễn Văn A"`.

3. **Tra cứu An toàn Dược lâm sàng & Tương tác thuốc (DDI)** *(Dược thư Quốc gia DĐVN V & QĐ 5948/QĐ-BYT)*:
   • Tra cứu nhanh gọn 54.885 thuốc CSDL Cục Quản lý Dược (DAV), chỉ định, liều lượng, chống chỉ định, thời điểm dùng.
   • Kiểm tra tương tác thuốc đa hoạt chất, phân tầng cảnh báo mức độ nghiêm trọng.
   • *Lệnh mẫu:* `"Tương tác giữa Clopidogrel và Omeprazol"`, `"Kháng sinh Zithromax uống trước hay sau ăn?"`.

4. **Lập lịch dặn dò cữ thuốc & Gửi Email/SMS cho người bệnh**:
   • Tự động chuyển đơn thuốc thành các cữ sáng - trưa - chiều - tối kèm hướng dẫn trước/sau ăn.
   • Soạn nội dung dặn dò chi tiết, rõ ràng, dễ hiểu gửi qua Email hoặc SMS cho bệnh nhân.
   • *Lệnh mẫu:* `"Dặn dò bệnh nhân uống thuốc"`, `"Mở form gửi email/sms"`.

5. **Phác đồ cấp cứu & Cảnh giác Dược (ADR)** *(Thông tư 51/2017/TT-BYT & QĐ 2147/QĐ-BYT)*:
   • Phác đồ Adrenalin cấp cứu phản vệ theo từng lứa tuổi/cân nặng.
   • Nhận diện phản ứng có hại của thuốc (ADR) và lập dự thảo báo cáo cảnh giác dược.
   • *Lệnh mẫu:* `"Phác đồ cấp cứu phản vệ"`, `"Xử trí phản ứng phụ của thuốc"`.

6. **Giám sát Kho Dược GSP & Hạn dùng FEFO** *(Thông tư 36/2018/TT-BYT)*:
   • Xuất kho ưu tiên cận hạn trước (First Expired, First Out); quét thuốc hạn dưới 60 ngày.
   • *Lệnh mẫu:* `"Thuốc nào cận hạn dưới 60 ngày"`, `"Kiểm tra tồn kho thuốc"`.

7. **Chuỗi lạnh Vắc xin & Sinh phẩm (Cold Chain - GSP)** *(WHO PQS & Thông tư 36/2018/TT-BYT)*:
   • Theo dõi dải nhiệt 2.0°C - 8.0°C; tính chỉ số nhiệt động học Arrhenius (MKT); quy trình biệt trữ khi mất điện.
   • *Lệnh mẫu:* `"Nhiệt độ tủ lạnh bảo quản vắc xin thế nào"`, `"Kiểm tra chuỗi lạnh"`.

8. **Sổ kiểm toán bất biến & An toàn dữ liệu** *(Nghị định 130/2018/NĐ-CP)*:
   • Xác thực chuỗi băm mật mã HMAC-SHA256 liên kết từng giao dịch; chống chối bỏ trách nhiệm.
   • *Lệnh mẫu:* `"Kiểm tra tính toàn vẹn sổ kiểm toán"`.
"""

async def handle_business_overview_intent() -> CopilotResponse:
    return CopilotResponse(
        intent="BUSINESS_OVERVIEW",
        reply_text=CLINICAL_BUSINESS_DIRECTORY,
        card=None,
        legal_basis="Thông tư 26/2025, TT 52/2017, QĐ 5948 & DĐVN V",
        suggested_chips=["Kiểm tra đơn thuốc", "Tương tác giữa Clopidogrel và Omeprazol", "Mở form gửi email/sms", "Thuốc cận hạn FEFO"]
    )
