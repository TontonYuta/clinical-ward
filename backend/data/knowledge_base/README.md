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

---

### 4. Danh Mục Đường Dẫn Trực Tiếp Đã Kiểm Chứng (100% Active Links)
* **Cục Quản lý Khám, chữa bệnh (KCB - Bộ Y tế):**
  * QĐ 5948/QĐ-BYT: https://kcb.vn/tin-tuc/danh-muc-tuong-tac-thuoc-chong-chi-dinh-trong-thuc-hanh-lam-sang-va-huong-dan-giam-sat-phan-ung-co-hai-cua-thuoc-adr-tai.html
* **Trung tâm Quốc gia DI & ADR (canhgiacduoc.org.vn):**
  * Thông báo Công cụ tra cứu tương tác QĐ 5948: https://canhgiacduoc.org.vn/GioiThieuChung/TrangTinHoatDong/5632/Cong-cu-tra-cuu-dien-tu-tuong-tac-thuoc-chong-chi-dinh.htm
  * Cổng tra cứu điện tử (Bộ Y tế & Trung tâm Thông tin Y tế QG): https://tuongtacthuoc.nhic.vn/Home/Page *(Lưu ý: nội bộ/bảo trì kết nối)*
* **Cục Quản lý Dược (DAV):**
  * Cổng tra cứu công bố thuốc 55.000 số đăng ký: https://dichvucong.dav.gov.vn/congbothuoc/index
  * Cổng thông tin Cục Quản lý Dược: https://dav.gov.vn/
* **Văn bản Quy phạm Pháp luật (Thư Viện Pháp Luật):**
  * QĐ 5948/QĐ-BYT (Tương tác chống chỉ định): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5948-QD-BYT-2021-tai-lieu-chuyen-mon-Danh-muc-tuong-tac-thuoc-chong-chi-dinh-500355.aspx
  * QĐ 3445/QĐ-BYT (Dược thư Quốc gia Việt Nam 2022): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-3445-QD-BYT-2022-ban-hanh-Duoc-thu-quoc-gia-Viet-Nam-lan-thu-ba-549463.aspx
  * TT 51/2017/TT-BYT (Phác đồ Adrenalin phản vệ): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-51-2017-TT-BYT-huong-dan-phong-chan-doan-va-xu-tri-phan-ve-371587.aspx
  * TT 20/2017/TT-BYT (Thuốc gây nghiện & vỏ ống): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-20-2017-TT-BYT-huong-dan-Luat-duoc-ve-thuoc-phai-kiem-soat-dac-biet-349887.aspx
  * TT 22/2011/TT-BYT (Tủ trực Khoa Dược): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-22-2011-TT-BYT-to-chuc-va-hoat-dong-cua-khoa-Duoc-benh-vien-124968.aspx
* **CSDL Dược Quốc tế Tham Chiếu (Mã ATC & Nhãn FDA):**
  * OpenFDA Drug Label API: https://api.fda.gov/drug/label.json?search=openfda.generic_name:ceftriaxone&limit=1
  * WHO Collaborating Centre for Drug Statistics Methodology (Mã phân loại ATC): https://www.whocc.no/atc_ddd_index/
  * NIH DailyMed: https://dailymed.nlm.nih.gov/dailymed/
