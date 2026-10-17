---
marp: true
theme: default
paginate: true
header: 'Đồ Án 2: Chatbot / AI Agent Quản Lý Kho Y Tế Lâm Sàng'
footer: 'Bộ Y Tế: TT 22, TT 20, NĐ 98, TT 36 GSP, NĐ 151 | FDA 21 CFR Part 11'
style: |
  section {
    font-family: 'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #0B132B;
    color: #E2E8F0;
  }
  h1 {
    color: #38BDF8;
    font-weight: 800;
  }
  h2 {
    color: #2DD4BF;
    font-weight: 700;
  }
  h3 {
    color: #F8FAFC;
    font-weight: 600;
  }
  strong {
    color: #FBBF24;
  }
  code {
    background-color: #1E293B;
    color: #38BDF8;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
  }
  table {
    font-size: 14px;
  }
---

# BÁO CÁO NGHIỆM THU ĐỒ ÁN 2
## Nghiên Cứu, Xây Dựng Chatbot / AI Agent Quản Lý Kho Thiết Bị, Vật Tư Y Tế & Dược Phẩm

- **Chuyên ngành:** Khoa học máy tính / Hệ thống thông tin (Capstone Project 2)
- **Mô hình kiến trúc:** Action-Oriented AI Agent & Clinical Workstation
- **Nguyên tắc cốt lõi:** Chuẩn hóa 100% quy phạm pháp luật Y tế Việt Nam

---

## 1. Bối Cảnh Thực Tế & Điểm Nghẽn Hiện Trường

Tại các bệnh viện công lập và đa khoa tại Việt Nam:

1. **Cứu người là ưu tiên số 1, thủ tục giấy tờ bị bỏ lại phía sau:**
   - 01:30 sáng cấp cứu sốc phản vệ / đa chấn thương: Bốc thuốc/vật tư dùng ngay $\to$ **Nợ cơ số tủ trực**.
   - Quên làm phiếu bù sau 24h $\to$ BHYT từ chối thanh toán $\to$ **Điều dưỡng bỏ tiền túi đền**.
2. **Nguy cơ trách nhiệm hình sự với Thuốc gây nghiện (Morphin):**
   - Mất 1 ống thuốc hay 1 vỏ ống là kíp trực bị dừng việc để giải trình công an và thanh tra y tế.
3. **Thiết bị tiền tỷ đắp chiếu vì hỏng phụ kiện:**
   - Máy thở Bennett 840, máy sốc tim dừng hoạt động chỉ vì xì dây thở, đứt cáp SpO2.
4. **Kho thuốc tiền tỷ hỏng vì sự cố mất điện âm thầm:**
   - Tủ lạnh vắc xin/sinh phẩm mất điện lúc 2h sáng làm quá nhiệt $8^\circ\text{C}$ biến tính vắc xin.

---

## 2. Kiến Trúc Action-Oriented AI Agent & Trợ Lý Ảo

```
[Nhân Viên Y Tế] (Giọng nói / Tin nhắn / Ảnh chụp / Mã QR)
       │
       ▼
[Clinical AI Agent] ──(NLU Intent & Entity Extraction)
       │
       ├──► [Phân Hệ 1: Sổ nợ tủ trực] (Fast-Logging 10s & Nhắc 07:00 sáng)
       ├──► [Phân Hệ 2: Sự cố thiết bị] (Phân loại C/D & Sổ lý lịch NĐ 98)
       ├──► [Phân Hệ 3: Kho Dược FEFO] (Ưu tiên hạn ngắn & Dự trù TT 22)
       ├──► [Phân Hệ 4: Chuỗi lạnh GSP] (Báo động mất điện & Biệt trữ vắc xin)
       └──► [Phân Hệ 5: Kiểm kê 31/12] (Đối soát QR buồng & Thanh lý NĐ 151)
       │
       ▼
[Sổ Kiểm Toán Bất Biến] (SHA256 Hash + FDA 21 CFR Part 11 + Dual-Witness)
```

---

## 3. Thể Chế Hóa Phân Quyền Lâm Sàng (Strict RBAC Isolation)

*Giao diện tự động lọc, chỉ hiển thị đúng phân hệ và tác vụ theo thẩm quyền:*

| Chức danh | Phân hệ hiển thị | Quyền thao tác | Khóa an toàn |
| :--- | :---: | :--- | :--- |
| **Điều Dưỡng Trực A9** | **1/5** | Sổ nợ tủ trực, Mượn khẩn, Thu vỏ TT 20 | Ẩn nút Hội đồng hủy vỏ |
| **Kỹ Sư Y Sinh (BME)** | **2/5** | Sự cố thiết bị, Kiểm kê tài sản | Khóa nút Thanh lý |
| **Dược Sĩ Kho Dược** | **3/5** | Sổ nợ, Kho Dược FEFO, Chuỗi lạnh GSP | Không can thiệp sửa máy |
| **Bác Sĩ Điều Trị** | **2/5** | Sổ nợ tủ trực, Sự cố thiết bị | Chuyển 'Chờ BME nghiệm thu' |
| **Ban Giám Đốc** | **5/5** | Toàn quyền 5 phân hệ lâm sàng & tài sản | **Độc quyền ký thanh lý tài sản** |

---

## 4. Phân Hệ 1: Tủ Trực Cấp Cứu — Mượn Khẩn & Hoàn Bù (TT 22)

- **Ghi nhận mượn khẩn trong 10 giây (Fast Logging):**
  - Điều dưỡng ra lệnh thoại / nhắn tin: *"Vừa lấy 2 lọ Morphin và 1 bộ dây truyền cấp cứu buồng 3"*.
  - AI tự động lập mã phiếu `PN-2026-089` gắn trạng thái **Đang nợ**.
- **Chuông nhắc giao ban 07:00 sáng:**
  - AI Cron Service chủ động bắn thông báo nhắc Bác sĩ và Điều dưỡng trưởng kê đơn bù trước khi BN xuất viện.
- **Hoàn bù khép kín & Tự động trừ kho FEFO:**
  - Dược sĩ duyệt đơn thuốc $\to$ Hệ thống xóa sổ nợ và **tự động trừ kho Dược bệnh viện** theo hạn gần xuất trước.

---

## 5. Phân Hệ 1 (Đặc Thù): Khóa Logic Vỏ Ống Morphin (TT 20)

- **Khóa hoàn bù (Narcotic Lockout):**
  - Điều 15 Thông tư 20/2017: Phải nộp lại vỏ ống rỗng sau khi tiêm.
  - Khi chưa nộp vỏ, nút "Hoàn bù" bị khóa cứng với nhãn:  
    `🔒 Khóa: Chờ nộp vỏ (TT 20)`.
- **Thu hồi vỏ ống vào khay kiểm soát:**
  - Điều dưỡng kiểm đếm vỏ ống, bấm *"Thu hồi vỏ"*, ký mã PIN $\to$ Chuyển sang `Đã nộp khay` $\to$ Mở khóa hoàn bù.
- **Hội đồng tiêu hủy vỏ ống (Dual-Witness):**
  - Dược sĩ chủ trì + Điều dưỡng trưởng đồng ký chứng kiến.
  - Ký kép xác thực lập biên bản nghiền nát vỏ ống thủy tinh xử lý chất thải nguy hại.

---

## 6. Phân Hệ 2: Sự Cố Thiết Bị, Rủi Ro C/D & Thử Tải (NĐ 98)

- **Báo hỏng phụ kiện & Phân loại rủi ro C/D:**
  - Chụp ảnh dây thở máy Bennett 840 bị xì khí hoặc cáp điện tim đứt $\to$ AI tạo Ticket khẩn cấp (Thiết bị sinh tồn Loại D).
- **Sổ lý lịch máy y tế điện tử (NĐ 98 & NĐ 07):**
  - Tra cứu Serial, hãng sản xuất, phụ tùng CO/CQ thay thế.
  - Nhắc nhở trước 30 ngày khi tem kiểm định đo lường (NIEMET) sắp hết hạn.
- **Bắt buộc "Thử tải an toàn điện" trước khi bàn giao buồng bệnh:**
  - Kỹ sư BME đo dòng rò vỏ máy ($< 100\mu A$), thử áp lực thông khí trên phổi giả.
  - Ký biên bản nghiệm thu kỹ thuật $\to$ Máy mới được dùng lại cho bệnh nhân.

---

## 7. Phân Hệ 3: Kho Dược FEFO & Dự Trù Mua Sắm (TT 36 GSP)

- **Nguyên tắc FEFO (First Expired, First Out):**
  - Bắt buộc lô có hạn dùng (EXP) hoặc hạn tiệt trùng ngắn hơn phải xuất trước.
  - *Ví dụ thực tế:* Chỉ phẫu thuật Catgut Lô `C624` (còn 36 ngày) xuất trước lô `C625` (còn 304 ngày).
- **Cảnh báo cạn kho (Min Stock):**
  - Tồn kho chạm ngưỡng tối thiểu $\to$ Bật nhãn hổ phách cảnh báo cạn kho cấp cứu.
- **Lập phiếu dự trù mua sắm bổ sung (TT 22):**
  - Tự động gom các lô cạn kho vào danh mục dự trù, Dược sĩ ký số gửi Ban Giám Đốc phê duyệt.

---

## 8. Phân Hệ 4: Chuỗi Lạnh 2-8°C & Biệt Trữ Vắc Xin (TT 36)

- **Sự cố mất điện tủ lạnh 2h sáng (Nhiệt độ vọt lên 11°C):**
  - Kích hoạt còi báo động khẩn cấp; AI tự động tạo Ticket sửa điện cho BME.
- **Kích hoạt quy chế Biệt trữ (Quarantine Mode - Điều 12 TT 36):**
  - Khi điện phục hồi (nhiệt độ về 4.5°C), **tuyệt đối không được tiêm ngay**.
  - Hệ thống tự động niêm phong biệt trữ 1.250 liều vắc xin.
- **Thẩm định chỉ thị VVM & Lệnh phóng thích lô (Batch Release):**
  - Tổ QA Dược kiểm tra chỉ thị màu VVM (Cấp 1 - Đạt) và tính Nhiệt độ Động học Trung bình ($MKT = 5.6^\circ\text{C}$).
  - Hội đồng Dược ký số kép giải phóng lô vắc xin đưa vào tiêm chủng an toàn.

---

## 9. Phân Hệ 5: Kiểm Kê 31/12 & Thanh Lý Tài Sản (NĐ 151)

- **Quét mã QR phát hiện máy lệch buồng bệnh:**
  - Quét máy thở Bennett 840 tại Phòng Mổ 2 $\to$ Hệ thống phát hiện sổ sách ghi ở Cấp cứu A9.
- **Biên bản Điều chuyển tài sản (Mẫu 01/TSC-ĐC theo NĐ 151):**
  - Ký số bàn giao giữa 2 khoa phòng $\to$ Đồng bộ vị trí thực tế trên sổ kế toán.
- **Thẩm quyền thanh lý độc quyền của Giám Đốc (NĐ 114/2024):**
  - Máy X-quang hỏng ngưng dùng trên 10 năm hao mòn 95%: Kỹ sư BME bị khóa (hiển thị `Chờ GĐ thanh lý`).
  - Ban Giám Đốc đăng nhập $\to$ Nút "Thanh lý" mở khóa để ký quyết định thành lập Hội đồng thanh lý tài sản nhà nước.

---

## 10. An Ninh Vận Hành Ngầm (Security by Design) & Giao Diện Thuần Y Tế

- **Trải nghiệm giao diện thuần túy y tế:**
  - Ẩn toàn bộ mã băm SHA-256 kỹ thuật và thuật ngữ mật mã phức tạp; nhân viên y tế chỉ tập trung vào dữ liệu lâm sàng: tên thuốc, bệnh nhân, liều lượng, số lô, CCHN.
- **Ký số có người làm chứng (Chứng thực kép):**
  - Bắt buộc 2 nhân viên y tế độc lập thuộc 2 chức danh cùng xác thực qua mã PIN/Thẻ khi hủy vỏ Morphin, bàn giao máy thở, giải phóng lô vắc xin (TT 20/2017 & NĐ 130).
- **Kiểm toán & Niêm phong ngầm bất biến:**
  - Mọi thao tác được hệ thống tự động băm SHA-256 và niêm phong ngầm vào sổ nhật ký lưu trữ cố định. Trạng thái hiển thị thân thiện: *Đã xác nhận & Khóa sổ*.

---

## 11. Tổng Kết Nghiệm Thu & Đánh Giá

1. **Chuẩn hóa nghiệp vụ y tế:** Giải quyết trọn vẹn 5 điểm nghẽn hiện trường theo chuẩn Thông tư 22, 20, 36, NĐ 98, NĐ 151.
2. **Kiểm thử tự động Playwright:** Đạt **100% PASS** tất cả các ca kiểm thử tích hợp và phân quyền.
3. **Mã nguồn sạch & Tối ưu:** Không có lỗi TypeScript (`npx tsc --noEmit` mã thoát 0), bản build Vite hoàn tất trong 560ms.
4. **Hồ sơ bàn giao đầy đủ:**
   - Ứng dụng Web & AI Copilot đang chạy tại `http://localhost:3000`.
   - Cẩm nang nghiệp vụ chi tiết & Báo cáo phân quyền RBAC.
   - Slide thuyết trình tương tác HTML5 & Markdown.
   - Video Walkthrough Full-HD 1080p ghi hình thực tế.
