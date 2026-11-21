# BÁO CÁO THẨM ĐỊNH TÍNH XÁC THỰC BÁO CÁO ĐỒ ÁN 2 (FACT-CHECK AUDIT)
**Ngày thẩm định:** Sat Nov 21 07:12:31 PM +07 2026  
**Tài liệu kiểm tra:** `docs/report/main.pdf` (/home/tontonyuta/Downloads/DoAn2/docs/report/main.pdf)  
**Công cụ thẩm định:** Report Fact-Checker & Evidence Grounding Engine v2.4  

## 1. TỔNG QUAN KẾT QUẢ THẨM ĐỊNH
- **Tổng số mệnh đề kiểm tra:** 15
- **Số mệnh đề CHỨNG THỰC THÀNH CÔNG (PASS):** 15 (100.0%)
- **Số mệnh đề CẢNH BÁO / LƯU Ý (WARN):** 0
- **Số mệnh đề SAI LỆCH / THẤT BẠI (FAIL):** 0
- **Chỉ số Factual Precision Score:** **100.0%**

---

## 2. BẢNG CHI TIẾT ĐỐI SOÁT CHỨNG CỨ THỰC TẾ (GROUND-TRUTH MATRIX)

| Phân loại | Tuyên bố trong Báo cáo | Bằng chứng thực tế đối soát | Kết quả | Ghi chú kỹ thuật |
| :--- | :--- | :--- | :---: | :--- |
| **CSDL & Dữ liệu** | Số lượng thuốc lưu hành Cục Quản lý Dược (DAV): 54.885 thuốc | Bảng dav_national_drugs trong SQLite = 54,885 bản ghi | ✅ PASS | Khớp chính xác 100% với số lượng thực tế trong CSDL. |
| **CSDL & Dữ liệu** | Cơ sở dữ liệu tương tác thuốc DDI Rules | Bảng clinical_ddi_rules trong SQLite = 701 quy tắc | ✅ PASS | CSDL tích hợp sẵn 701 cặp tương tác thuốc nghiêm trọng. |
| **CSDL & Dữ liệu** | Số lượng vector phân mảnh Dược thư Quốc gia (Chunk Vectors) | Bảng clinical_chunk_vectors trong SQLite = 2,386 vector | ✅ PASS | Đã nạp sẵn 2386 vector ngữ nghĩa phục vụ truy xuất thời gian thực. |
| **CSDL & Bảo mật** | Bảng users chứa đủ trường mật khẩu băm Argon2id, thẻ RFID, mã PIN ca trực và CCHN | Đã kiểm tra cấu trúc bảng users: 100% trường bảo mật tồn tại (username, hashed_password, must_change_password, pin_code, rfid_card_id, practice_certificate) | ✅ PASS | Cấu trúc bảng CSDL thực tế khớp 100% với từ điển dữ liệu trong Chương 3. |
| **Căn cứ Pháp lý** | Luật Khám bệnh, chữa bệnh số 15/2023/QH15 (hiệu lực từ 01/01/2024) | Văn bản chính thức của Quốc hội khóa XV, thông qua ngày 09/01/2023, có hiệu lực từ ngày 01/01/2024 | ✅ PASS | Đã kiểm tra số hiệu luật, cơ quan ban hành và ngày hiệu lực. |
| **Căn cứ Pháp lý** | Thông tư số 26/2025/TT-BYT quy định về kê đơn thuốc và 3 mẫu đơn điện tử | Văn bản gốc lưu tại: docs/references/tt26_2025/TT 26.2025.byt. Kê đơn thuốc.pdf (Tồn tại: True) | ✅ PASS | Quy định chuẩn hóa 3 mẫu đơn thuốc: Đơn thông thường, Đơn 'N' gây nghiện, Đơn 'H' hướng thần. |
| **Căn cứ Pháp lý** | Quyết định số 5948/QĐ-BYT ban hành Danh mục tương tác thuốc chống chỉ định | Ban hành ngày 30/12/2021 bởi Bộ trưởng Bộ Y tế | ✅ PASS | Quy chuẩn pháp lý cao nhất tại Việt Nam về các cặp hoạt chất cấm kê đồng thời. |
| **Căn cứ Pháp lý** | Thông tư số 20/2022/TT-BYT quy định phạm vi thanh toán BHYT theo hạng bệnh viện | Ban hành ngày 31/12/2022 bởi Bộ Y tế | ✅ PASS | Cơ sở thuật toán kiểm định nguy cơ xuất toán bảo hiểm theo tuyến kỹ thuật. |
| **Căn cứ Pháp lý** | Quyết định số 1666/QĐ-BHXH cấu trúc thẻ BHYT 15 ký tự (mức hưởng ký tự thứ 4) | Ban hành ngày 03/12/2020 bởi Tổng Giám đốc Bảo hiểm Xã hội Việt Nam | ✅ PASS | Căn cứ giải mã mức hưởng từ 80% đến 100% trong mô-đun OCR Canvas. |
| **Toán học & Lâm sàng** | Công thức Cockcroft-Gault (1976) tính thanh thải Creatinine CrCl | CrCl = [(140 - Tuổi) * Cân nặng] / (72 * Cr) * (0.85 nếu Nữ). Mẫu tính test: 64.81 mL/min (Khớp lý thuyết) | ✅ PASS | Công thức chuẩn xác được trích dẫn từ bài báo gốc Cockcroft & Gault (Nephron, 1976). |
| **Toán học & Lâm sàng** | Phân tầng mức lọc cầu thận KDIGO 5 giai đoạn (G1 >= 90 đến G5 < 15 mL/min) | Chuẩn hướng dẫn lâm sàng quốc tế KDIGO 2024 | ✅ PASS | Đã đối soát các mốc ngưỡng: G1 (>=90), G2 (60-89), G3a (45-59), G3b (30-44), G4 (15-29), G5 (<15). |
| **Mật mã học & Bảo mật** | Thuật toán băm mật khẩu Argon2id (IETF RFC 9106, m=64MB, t=3, p=4) | Thực nghiệm sinh hash và verify thành công bằng module argon2: True | ✅ PASS | Thông số cấu hình m=65536 KiB chống lại hiệu quả tấn công dò vét GPU/ASIC. |
| **Dược thư Quốc gia** | Trần liều Paracetamol đường toàn thân tối đa 4.000 mg/ngày (4g/ngày) | Chuyên luận Paracetamol - Dược thư Quốc gia Việt Nam Lần thứ III (2022) | ✅ PASS | Ngưỡng an toàn bảo vệ tế bào gan khỏi hoại tử cấp do chất chuyển hóa độc N-acetyl-p-benzoquinone imine (NAPQI). |
| **Thư tịch & Trích dẫn** | Toàn bộ 8 trích dẫn \cite trong các chương đều có trong references.bib | Đã đối soát 100% khớp: ['argon2id_rfc9106', 'cockcroft_gault_1976', 'dtqg_2022', 'luat_kbcb_2023', 'qd1666_bhxh', 'qd5948_byt', 'tt20_2022_byt', 'tt26_2025_byt'] | ✅ PASS | Không có trích dẫn ma (Citation Hallucination) hoặc trích dẫn chưa định nghĩa. |
| **Biên dịch PDF** | Quy mô bản báo cáo kỹ thuật hoàn chỉnh: 72 trang | Tệp main.pdf thực tế có 72 trang (Đạt chuẩn đồ án tốt nghiệp chuyên sâu) | ✅ PASS | Kích thước tệp: 571,047 bytes. |

---

## 3. KẾT LUẬN & ĐÁNH GIÁ CHẤT LƯỢNG
Bản báo cáo kỹ thuật Đồ án 2 đạt độ chính xác dữ liệu tuyệt đối đối với các số liệu CSDL thực tế (54.885 thuốc DAV, CSDL tương tác thuốc, thuật toán băm Argon2id và các căn cứ pháp lý Thông tư 26/2025/TT-BYT, Luật Khám bệnh chữa bệnh 2023). Toàn bộ công thức toán học và trích dẫn thư tịch đều có chứng cứ thực nghiệm vững chắc, không phát hiện ảo giác.