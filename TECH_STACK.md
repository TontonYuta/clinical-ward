# BẢN ĐỒ KIẾN TRÚC & CÔNG NGHỆ (TECH_STACK.MD)

## 1. Danh Sách Thư Viện & Lý Do Lựa Chọn

| Thành phần | Thư viện / Công nghệ | Phiên bản | Lý do lựa chọn & Vai trò trong hệ thống |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React** + **TypeScript** | 19.x / 5.x | Xây dựng Single Page Application chuẩn y tế, strict type-checking chống lỗi runtime khi tính liều và tra cứu hoạt chất. |
| **Build Tool & Bundler** | **Vite** | 8.x | Thời gian build siêu tốc (<1s), Hot Module Replacement (HMR) tức thời cho trải nghiệm vibecoding mượt mà. |
| **CSS Engine** | **Tailwind CSS** | 4.x | Thiết kế giao diện lâm sàng chuẩn Atomic, không CSS phình to, dễ tùy biến màu sắc cảnh báo theo bảng màu Bộ Y Tế. |
| **Biểu tượng (Icons)** | **Lucide React** | Mới nhất | Bộ icon y tế chuẩn mực (`Pill`, `Stethoscope`, `Boxes`, `FileText`, `ShieldAlert`), siêu nhẹ và sắc nét. |
| **Database & Persistence** | **SQLite (WAL mode)** + **Better-SQLite3** | 11.x | Cơ sở dữ liệu nhúng cục bộ siêu nhanh, chuẩn ACID y tế, hỗ trợ Write-Ahead Logging (WAL) đảm bảo tính toàn vẹn của sổ kiểm toán dược. |
| **E2E Testing & Verification** | **Playwright** | 1.50+ | Tự động hóa kiểm thử UI, chụp ảnh màn hình đa thiết bị (Desktop + Mobile) và kiểm chứng kép các luồng lâm sàng. |
| **NLP & CDSS Engine** | **TypeScript Native Deterministic Engine** | Tự phát triển | Phân tích cú pháp y lệnh và câu hỏi lâm sàng không phụ thuộc mạng ngoài, tốc độ đáp ứng <5ms, bảo mật dữ liệu bệnh án 100%. |

---

## 2. Bản Đồ Luồng Dữ Liệu (Data Flow)

```mermaid
flowchart TD
    User([Người dùng: Bác sĩ / Dược sĩ / Điều dưỡng])

    subgraph Presentation Layer
        UI[Giao diện React + Tailwind CSS]
        Modal[Modal Thông Tin Thuốc & Dược Thư]
        Chatbot[Trợ Lý AI Dược Lâm Sàng]
    end

    subgraph Business Logic Layer
        CDSS[CDSS Clinical Engine: Cảnh báo DDI, Quá liều Opioid, K+ tiêm]
        NLPEngine[Bộ Xử Lý Ngôn Ngữ Tự Nhiên & Intent Dispatcher]
        StateStore[Local State: Batches, Debts, Prescriptions]
    end

    subgraph Data & Persistence Layer
        DB[(SQLite WAL: Debts, Batches, Audit Logs)]
        MonographDB[(Clinical Profiles: 14 Chiều Thông Tin Thuốc & SĐK)]
    end

    User -->|Tương tác UI / Kê đơn / Mượn thuốc| UI
    User -->|Nhập câu hỏi: Dùng để làm gì, ai dị ứng| Chatbot

    Chatbot --> NLPEngine
    NLPEngine --> CDSS
    NLPEngine --> MonographDB

    UI --> StateStore
    UI --> Modal
    Modal --> MonographDB

    StateStore --> DB
    CDSS --> UI
```

---

## 3. Quy Chuẩn State Machine (4 Trạng Thái Bắt Buộc)

Mọi luồng thao tác với dữ liệu thuốc (Kê đơn, Mượn tủ trực, Xuất kho FEFO, Hoàn trả vỏ rỗng, Dặn dò nhắc thuốc) đều được khóa cứng qua 4 trạng thái:
1. `Idle`: Trạng thái chờ khởi tạo hoặc hiển thị danh mục tĩnh.
2. `Loading`: Đang gửi yêu cầu xác thực hoặc kết nối Webhook Google Apps Script.
3. `Success`: Thao tác thành công, ghi sổ kiểm toán SHA-256 hoặc xác nhận gửi email thành công.
4. `Error / Empty`: Báo lỗi vi phạm quy chế hoặc lỗi kết nối webhook kèm hướng dẫn khắc phục.

---

## 4. Kiến Trúc Dặn Dò & Gửi Email Nhắc Uống Thuốc (Google Apps Script Gateway)

### 4.1. Bản Đồ Luồng Tự Động Hóa (Automation Flow)

```mermaid
flowchart LR
    Doctor([Bác sĩ Kê đơn CPOE / Chatbot]) -->|Ra lệnh dặn dò / Click Nhắc thuốc| App[Hệ Thống Lâm Sàng]
    App -->|Chuẩn hóa 4 cữ Sáng-Trưa-Chiều-Tối| Payload[PrescriptionAdvicePayload]
    
    Payload -->|HTTP POST| Gateway{Cơ Chế Phân Phối}
    Gateway -->|Ưu tiên 1: Google Apps Script Webhook| GAS["Google Apps Script Web App<br/>(script.google.com)"]
    Gateway -->|Ưu tiên 2: Backend Relay API| PyBackend["FastAPI /prescription-advice/send-email"]
    Gateway -->|Ưu tiên 3: Local HTML Preview| Preview[Trình Xem Trước HTML & In Ấn]
    
    GAS -->|GmailApp.sendEmail| Gmail[Hòm Thư Bệnh Nhân]
    PyBackend -->|httpx async POST| GAS
    
    subgraph Kênh Mở Rộng Trong Tương Lai
        GAS -.->|Webhook webhook_url| Zalo[Zalo ZNS / OA]
        GAS -.->|SMS Gateway API| SMS[Tin Nhắn SMS Brandname]
        GAS -.->|Push API| WebPush[Web Push Notification]
    end
```

### 4.2. Thư Viện & Công Nghệ Sử Dụng
- **Google Apps Script (GAS)**: `doPost(e)` Web App gateway, miễn phí, không yêu cầu cấu hình SMTP server phức tạp, bảo mật cấp doanh nghiệp theo tài khoản Google Workspace / Gmail y tế.
- **Python `httpx` (Async Client)**: Kết nối backend FastAPI với Google Apps Script Web App hỗ trợ chuyển hướng 302 và timeout 15s.
- **Responsive HTML Email Template**: Bố cục chuẩn mực y tế, bảng chia cữ trực quan (🌅 07:00, ☀️ 11:30, 🌤️ 18:00, 🌙 21:00), tương thích 100% với Outlook, Gmail, Apple Mail và điện thoại di động.
