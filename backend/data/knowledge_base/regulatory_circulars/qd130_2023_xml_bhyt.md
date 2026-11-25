# Chuẩn Và Định Dạng Dữ Liệu Đầu Ra Giám Định, Thanh Toán BHYT (XML)
## Căn Cứ: Quyết Định 130/QĐ-BYT ngày 18/01/2023 của Bộ Y Tế

Căn cứ pháp lý:
* **Quyết định số 130/QĐ-BYT ngày 18 tháng 01 năm 2023 của Bộ trưởng Bộ Y tế** quy định chuẩn và định dạng dữ liệu đầu ra phục vụ việc quản lý, giám định, thanh toán chi phí khám bệnh, chữa bệnh và giải quyết các chế độ liên quan (chính thức áp dụng từ **01/09/2023**, thay thế hoàn toàn Quyết định 4210/QĐ-BYT ngày 20/09/2017).

---

### Điều 1. Các Bảng Chỉ Tiêu Dữ Liệu Đầu Ra XML & Bộ Mã UTF-8 (Quyết định 130/QĐ-BYT)
* **13 bảng chỉ tiêu dữ liệu đầu ra theo định dạng XML (mã phông chữ UTF-8):**
  1. Bảng chỉ tiêu dữ liệu trạng thái khám bệnh, chữa bệnh (**Bảng check-in**).
  2. **Bảng 1 (XML1):** Chỉ tiêu tổng hợp khám bệnh, chữa bệnh.
  3. **Bảng 2 (XML2):** Chỉ tiêu chi tiết thuốc.
  4. **Bảng 3 (XML3):** Chỉ tiêu chi tiết dịch vụ kỹ thuật và vật tư y tế.
  5. **Bảng 4 (XML4):** Chỉ tiêu chi tiết dịch vụ cận lâm sàng.
  6. **Bảng 5 (XML5):** Chỉ tiêu chi tiết diễn biến lâm sàng.
  7. **Bảng 6 (XML6):** Chỉ tiêu hồ sơ bệnh án chăm sóc và điều trị HIV/AIDS.
  8. **Bảng 7 (XML7):** Chỉ tiêu dữ liệu giấy ra viện.
  9. **Bảng 8 (XML8):** Chỉ tiêu dữ liệu tóm tắt hồ sơ bệnh án.
  10. **Bảng 9 (XML9):** Chỉ tiêu dữ liệu giấy chứng sinh.
  11. **Bảng 10 (XML10):** Chỉ tiêu dữ liệu giấy chứng nhận nghỉ dưỡng thai.
  12. **Bảng 11 (XML11):** Chỉ tiêu dữ liệu giấy chứng nhận nghỉ hưởng bảo hiểm xã hội.
  13. **Bảng 12 (XML12):** Chỉ tiêu dữ liệu giám định y khoa.
* **Khóa liên kết (`MA_LK`):** Mã đợt điều trị duy nhất (chuỗi tối đa 100 ký tự), là `PRIMARY KEY` dùng để liên kết giữa Bảng 1 (XML1) và tất cả các bảng còn lại trong cùng một lần khám bệnh, chữa bệnh.

---

### Điều 2 & Điều 3. Mục Đích Áp Dụng & Quy Định Gửi Dữ Liệu Lên Cổng Giám Định BHYT (Quyết định 130/QĐ-BYT)
* **Bảng check-in:** Gửi lên Cổng Tiếp nhận dữ liệu giám định BHYT (`https://gdbhyt.baohiemxahoi.gov.vn`) **ngay sau khi có phát sinh chi phí KCB đầu tiên** của người bệnh để thông báo trạng thái khám chữa bệnh.
* **Bảng 1 đến Bảng 5 (XML1–XML5):** Cung cấp dữ liệu điện tử chi tiết về khám chữa bệnh (tổng hợp, thuốc, DVKT/VTYT, cận lâm sàng, diễn biến lâm sàng) phục vụ quản lý, giám định, thanh toán, quyết toán chi phí KCB BHYT.
* **Bảng 6 (XML6):** Quản lý điều trị người nhiễm HIV theo Thông tư 28/2018/TT-BYT.
* **Bảng 7 đến Bảng 11 (XML7–XML11):** Tạo lập chứng từ điện tử giải quyết chế độ BHXH theo Thông tư 56/2017/TT-BYT và TT 18/2022/TT-BYT; gửi lên Cổng BHXH theo Điều 6, 7 Thông tư 48/2017/TT-BYT.
* **Bảng 12 (XML12):** Cơ sở giám định y khoa nhập trực tiếp trên Cổng Tiếp nhận dữ liệu BHXH.

---

### Điều 4 & Điều 5. Lộ Trình Áp Dụng Chính Thức & Thay Thế Quyết Định 4210/QĐ-BYT (Quyết định 130/QĐ-BYT)
* **Kiểm thử:** Thực hiện kiểm thử gửi/nhận dữ liệu XML theo QĐ 130/QĐ-BYT từ ngày **31/03/2023** (song song với QĐ 4210/QĐ-BYT).
* **Áp dụng chính thức:** Từ ngày **01/09/2023**, các cơ sở KCB và cơ quan BHXH chính thức gửi/nhận dữ liệu điện tử XML theo Quyết định 130/QĐ-BYT làm căn cứ giám định, thanh toán BHYT; đồng thời **chấm dứt hiệu lực** Quyết định 4210/QĐ-BYT kể từ ngày 01/09/2023.
