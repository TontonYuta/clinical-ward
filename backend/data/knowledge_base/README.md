# Kho Tri Thức Dược Lâm Sàng Bệnh Viện (Clinical Pharmacy Knowledge Base)
## Căn Cứ Pháp Lý & Y Học Chứng Cứ Chính Thức (Bộ Y Tế Việt Nam)

Tài liệu này tổng hợp cấu trúc, nguồn gốc pháp lý và nguyên tắc kế thừa dữ liệu lâm sàng cho 54.885 biệt dược đang lưu trữ tại cơ sở dữ liệu `clinical_hospital.db`.

---

### 1. Cấu Trúc Thư Mục Tri Thức
* **`ddi_interactions/` (Tương Tác Thuốc Chống Chỉ Định):**
  * `qd_5948_antibiotics_and_antiinflammatory.md`: Tương tác chống chỉ định Kháng sinh & Kháng viêm NSAID (Aceclofenac + Ketorolac, Ceftriaxon + Calci, Simvastatin + Macrolid, Ciprofloxacin + Theophyllin, Methotrexat + NSAID).
  * `qd_5948_cardiovascular_and_cns.md`: Tương tác chống chỉ định Tim mạch, Thần kinh & Huyết học (Nitrat + PDE5-i, Amiodaron + QT prolonging/Colchicin, Clopidogrel + PPI, ACEI/Spironolacton + KCl, Tramadol + MAOI).
* **`clinical_pharmacopoeia/` (Dược Thư Quốc Gia - Dược Điển Lâm Sàng):**
  * `core_inns_monographs.md`: Chuyên luận liều chuẩn người lớn, liều trẻ em, trần 24h, chỉnh liều suy thận ClCr và chống chỉ định các hoạt chất gốc (Paracetamol, Ceftriaxon, Morphin, Diazepam, Vancomycin, Metformin).
* **`regulatory_circulars/` (Quy Chế & Thông Tư Chuyên Môn Bệnh Viện):**
  * `tt51_2017_anaphylaxis_protocol.md`: Phác đồ xử trí cấp cứu phản vệ và liều tiêm bắp Adrenalin 1mg/1ml (TT 51/2017/TT-BYT).
  * `tt20_2017_narcotics_management.md`: Quy chế tủ 2 khóa thuốc gây nghiện, hướng thần, thu hồi và tiêu hủy 100% vỏ ống tiêm (TT 20/2017/TT-BYT).
  * `tt22_2011_hospital_pharmacy_ward.md`: Quy chế cơ số tủ trực cấp cứu khoa phòng và bàn giao ca trực (TT 22/2011/TT-BYT & TT 23/2011/TT-BYT).

---

### 2. Nguyên Lý Kế Thừa Hoạt Chất (INN-Level Inheritance)
* Cơ sở dữ liệu thương mại Cục Quản lý Dược (DAV) chứa **54.885 số đăng ký biệt dược**.
* Việc nhập thủ công liều lượng/tương tác cho từng biệt dược là bất khả thi và dễ sai sót.
* Toàn bộ 54.885 biệt dược quy về **~743 hoạt chất gốc (INN)** theo Dược thư Quốc gia Việt Nam 2022:
  $$\text{DAV Drug Record} \xrightarrow{\text{active\_ingredient (INN)}} \text{Clinical Knowledge Base}$$
* Nhờ cơ chế này, khi bác sĩ kê đơn bất kỳ biệt dược nào (vd: *Hapacol 650, Panadol Extra, Efferalgan*), hệ thống tự động ánh xạ về chuyên luận `Paracetamol` để kiểm tra liều trần 4g/ngày và kiểm tra tương tác thuốc tự động.

---

### 3. Cam Kết Xác Thực & Phòng Chống Bịa Đặt Dữ Liệu (Zero-Hallucination)
* 100% dữ liệu trong kho tri thức này được trích xuất trực tiếp từ các văn bản quy phạm pháp luật và chuyên môn của Bộ Y tế Việt Nam.
* Tuyệt đối không sinh số liệu giả định về liều dùng hoặc cảnh báo lâm sàng.
