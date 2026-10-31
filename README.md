# ĐỒ ÁN 2: HỆ THỐNG QUẢN LÝ KHO DƯỢC, VẬT TƯ & TỦ TRỰC LÂM SÀNG BỆNH VIỆN
## (Clinical Ward Inventory & Medical Device Lifecycle Management System with AI Copilot)

[![Production Live](https://img.shields.io/badge/Production-clinical--ward.vercel.app-emerald?style=for-the-badge&logo=vercel)](https://clinical-ward.vercel.app)
[![Playwright Tests](https://img.shields.io/badge/Playwright%20Tests-100%25%20Passed-blue?style=for-the-badge&logo=playwright)](https://clinical-ward.vercel.app)
[![Legal Compliance](https://img.shields.io/badge/Bộ%20Y%20Tế-TT22%20%7C%20TT20%20%7C%20NĐ98%20%7C%20TT36%20GSP-purple?style=for-the-badge)](https://clinical-ward.vercel.app)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/TontonYuta/clinical-ward)

---

## 🌟 BẢN MẪU TRỰC TUYẾN (PRODUCTION PROTOTYPE)
- **Đường dẫn truy cập:** [https://clinical-ward.vercel.app](https://clinical-ward.vercel.app)
- **Chế độ truy cập:** Công khai 100% (Public Access), đã tắt toàn bộ SSO Authentication. Hội đồng và giảng viên hướng dẫn có thể trải nghiệm trực tiếp trên mọi thiết bị (Desktop / Laptop / Tablet).

---

## 📑 02 ẤN PHẨM HỒ SƠ PDF CHÍNH THỨC CỦA ĐỒ ÁN 2

Toàn bộ quy trình y tế thực tế, cơ sở pháp lý và kiến trúc kỹ thuật đã được tổng hợp trọn vẹn vào **đúng 02 file PDF xuất bản chuẩn A4** tại thư mục gốc:

1. **[01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf](01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf)** *(13 trang A4)*
   - Cẩm nang toàn diện về quy trình tủ trực cấp cứu ca đêm, đối soát 07:00 AM.
   - Cơ chế đóng kín kiểm soát thuốc gây nghiện (Thông tư 20/2017 & NĐ 54/2017): Khóa an toàn vỏ ống Morphin (Ampoule Lockout), biên bản tiêu hủy vỏ ống 3 bên.
   - Quy trình báo hỏng, gắn cờ LOTO đỏ, nghiệm thu an toàn điện (Nghị định 98/2021 & chuẩn IEC 60601-1).
   - Quản lý kho dược theo hạn dùng FEFO (Thông tư 36/2018 GSP), dự trù Mẫu 01/TT22.
   - Giám sát chuỗi lạnh vắc xin 2.0°C – 8.0°C, công thức nhiệt độ động học MKT Arrhenius và kịch bản kích hoạt biệt trữ khẩn cấp.
   - Hệ thống 05 biểu mẫu hành chính A4 chuẩn hóa.
   - Ma trận phân quyền 5 vai trò lâm sàng (RBAC Matrix) & Chữ ký kép Dual-Witness.
   - Bộ 12 câu hỏi & câu trả lời phản biện hội đồng đắt giá nhất.

2. **[02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf](02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf)** *(10 trang A4)*
   - Kiến trúc Modular Monolith Clean Architecture & Nguyên tắc Decoupled AI Copilot (Core Logic vận hành độc lập 100% trước AI).
   - Frontend: Vite 6, React 19, TypeScript, Tailwind CSS v4, No-Scroll UI công thái học máy trạm lâm sàng.
   - Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (Async Engine), aiosqlite / PostgreSQL, Pydantic v2.
   - Sơ đồ ERD 8 thực thể quan hệ, đặc tả danh mục đầy đủ các RESTful API Endpoints.
   - Động cơ AI Copilot NLP, trích xuất thực thể y tế (NER), Action Cards tương tác trực tiếp và chốt chặn an toàn (Safety Guardrails) yêu cầu mã PIN.
   - Cơ chế chuỗi băm bất biến HMAC-SHA256 chống sửa đổi dữ liệu (Audit Trail) theo chuẩn FDA 21 CFR Part 11.
   - Bộ kiểm thử tự động toàn diện Playwright Headless Chromium (100% Pass Rate).
   - Hướng dẫn Build Vite, cấu hình Vercel (`vercel.json`) và đóng gói Docker Backend.

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY CỤC BỘ (LOCAL SETUP)

### 1. Khởi chạy Frontend React:
```bash
# Cài đặt thư viện dependencies
npm install

# Khởi chạy máy chủ phát triển
npm run dev
# -> Truy cập http://localhost:5173
```

### 2. Khởi chạy Backend FastAPI (Tùy chọn):
```bash
# Kích hoạt môi trường Python ảo
source /home/tontonyuta/.venv/bin/activate

# Cài đặt thư viện backend
pip install -r backend/requirements.txt

# Khởi chạy Uvicorn server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# -> Swagger UI API Docs tại: http://localhost:8000/docs
```

### 3. Chạy kiểm thử tự động Playwright & Tái xuất bản PDF:
```bash
# Chạy bộ test tương tác Copilot & in ấn biểu mẫu A4
python scripts/test_copilot_ui.py
python scripts/test_printable_forms.py

# Xuất bản lại 02 tài liệu PDF chính thức
python scripts/generate_official_pdfs.py
```

---

*Đồ Án Tốt Nghiệp 2 — Khoa Công Nghệ Thông Tin — Năm Học 2026*
