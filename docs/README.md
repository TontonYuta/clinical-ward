# HỒ SƠ TÀI LIỆU CHÍNH THỨC — ĐỒ ÁN 2
## HỆ THỐNG QUẢN LÝ KHO DƯỢC, VẬT TƯ, TỦ TRỰC LÂM SÀNG & TRANG THIẾT BỊ Y TẾ BỆNH VIỆN

---

> **Bản mẫu trực tuyến (Production Live):** [https://clinical-ward.vercel.app](https://clinical-ward.vercel.app) *(Chế độ công khai 100%, không yêu cầu đăng nhập Vercel SSO)*  
> **Căn cứ pháp lý chuẩn:** Thông tư 22/2011/TT-BYT, Thông tư 20/2017/TT-BYT, Nghị định 98/2021/NĐ-CP, Thông tư 36/2018/TT-BYT (GSP), Nghị định 151/2017/NĐ-CP, Nghị định 114/2024/NĐ-CP & Nghị định 130/2018/NĐ-CP.

---

## 📚 02 ẤN PHẨM TỔNG HỢP TOÀN DIỆN (BẢN PDF & MARKDOWN)

Toàn bộ tri thức nghiệp vụ, quy trình lâm sàng, cơ sở pháp lý và kiến trúc phần mềm đã được cô đọng và tổng hợp vào **đúng 02 ấn phẩm PDF chính thức** (đã được lưu tại thư mục gốc và thư mục `docs/`):

### 1. Tài liệu 01: Cẩm Nang Toàn Diện Về Nghiệp Vụ Y Tế Lâm Sàng & Bảo Vệ Đồ Án 2
- **File PDF (In ấn A4):** [`01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf`](file:///home/tontonyuta/Downloads/DoAn2/01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf) *(13 trang, dung lượng ~1.17 MB)*
- **File Markdown:** [`01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.md`](file:///home/tontonyuta/Downloads/DoAn2/docs/01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.md)
- **Nội dung trọng tâm:**
  - Bản chất vấn đề: Phân biệt sự khác nhau sống còn giữa Kho Thương Mại (Retail ERP) và Kho Lâm Sàng Bệnh Viện (Ward Stock).
  - Khung pháp lý 8 văn bản quy phạm pháp luật Y tế Việt Nam bắt buộc.
  - Chi tiết 5 quy trình nghiệp vụ cốt lõi (SOP lâm sàng): Mượn khẩn ca đêm, Khóa an toàn vỏ ống Morphin (Ampoule Lockout), Báo hỏng và cảnh báo đỏ LOTO, Quản lý kho dược theo hạn dùng FEFO, Giám sát chuỗi lạnh vắc xin 2.0°C – 8.0°C và quy trình biệt trữ khẩn cấp.
  - Hệ thống 05 biểu mẫu hành chính y tế chuẩn A4 tích hợp sẵn trong ứng dụng (Mẫu 07/TT20, Mẫu 01/TT22, Mẫu 01-TSC, Phiếu mượn khẩn nội bộ, Biên bản kiểm định an toàn TBYT NĐ 98 & IEC 60601-1).
  - Ma trận phân quyền 5 vai trò lâm sàng (RBAC Matrix) & cơ chế xác thực PIN/RFID, chữ ký kép Dual-Witness.
  - Bộ 12 câu hỏi & câu trả lời phản biện đắt giá nhất khi bảo vệ trước Hội đồng chấm điểm.

---

### 2. Tài liệu 02: Tổng Quan Kiến Trúc Hệ Thống & Cấu Trúc Code Toàn Diện
- **File PDF (In ấn A4):** [`02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf`](file:///home/tontonyuta/Downloads/DoAn2/02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf) *(10 trang, dung lượng ~905 KB)*
- **File Markdown:** [`02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.md`](file:///home/tontonyuta/Downloads/DoAn2/docs/02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.md)
- **Nội dung trọng tâm:**
  - Triết lý thiết kế Modular Monolith Clean Architecture & Nguyên tắc Decoupled AI Copilot (hệ thống vận hành 100% độc lập trước khi có AI).
  - Cấu trúc cây thư mục mã nguồn hoàn chỉnh của dự án (`src/`, `backend/`, `scripts/`, `docs/`).
  - Kiến trúc Frontend: Vite 6 + React 19 + TypeScript + Tailwind v4, phân tích 8 component giao diện nghiệp vụ, cơ chế đồng bộ Reactive State và công thái học No-Scroll UI.
  - Kiến trúc Backend: Python 3.12 + FastAPI + SQLAlchemy 2.0 (Async/Await) + SQLite / PostgreSQL, sơ đồ ERD quan hệ thực thể, đặc tả 8 bảng dữ liệu.
  - Danh mục chi tiết các RESTful API Endpoints cho 6 phân hệ nghiệp vụ.
  - Động cơ Trợ lý AI Lâm sàng (Clinical AI Copilot Engine): NLU Intent Classifier, Entity Extraction, Thẻ thao tác động (Action Cards) và rào chắn an toàn (Safety Guardrails) xác thực mã PIN.
  - Bộ kịch bản kiểm thử tự động toàn diện Playwright E2E: `test_copilot_ui.py`, `test_printable_forms.py`, `verify_refined_labels.py` (đạt 100% pass rate).
  - Quy trình Build, đóng gói Container Docker và triển khai đám mây Production trên Vercel.

---

## 📊 TÀI LIỆU TRÌNH CHIẾU & MINH CHỨNG KIỂM THỬ

| STT | Tài liệu / Tài nguyên | Định dạng | Đường dẫn |
| :---: | :--- | :---: | :--- |
| **01** | **Slide Thuyết Trình Đồ Án 2 (12 Slide)** | Marp `.md` / Web `.html` | [`Slide_Thuyet_Trinh_Do_An_2.md`](file:///home/tontonyuta/Downloads/DoAn2/docs/Slide_Thuyet_Trinh_Do_An_2.md) & [`slides/index.html`](file:///home/tontonyuta/Downloads/DoAn2/docs/slides/index.html) |
| **02** | **Video Demo Toàn Bộ Chức Năng** | Video Full-HD 1080p | [`videos/Demo_Toan_Bo_Chuc_Nang_App_Y_Te.mp4`](file:///home/tontonyuta/Downloads/DoAn2/docs/videos/Demo_Toan_Bo_Chuc_Nang_App_Y_Te.mp4) |
| **03** | **Thư Viện Ảnh Chụp Màn Hình Minh Chứng** | Thư mục Ảnh `.png` | [`screenshots/`](file:///home/tontonyuta/Downloads/DoAn2/docs/screenshots/) (bao gồm minh chứng Vercel Live, Copilot Action Cards, 5 Biểu mẫu A4) |

---

*Hồ sơ đã được chuẩn hóa và kiểm tra hoàn tất ngày 17/10/2026.*
