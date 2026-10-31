# Kho Tri Thức Dược Lâm Sàng Bệnh Viện (Clinical Pharmacy Knowledge Base)
## Căn Cứ Pháp Lý & Y Học Chứng Cứ Chính Thức (Bộ Y Tế Việt Nam)

Tài liệu này tổng hợp cấu trúc, nguồn gốc pháp lý và nguyên tắc kế thừa dữ liệu lâm sàng cho 54.885 biệt dược đang lưu trữ tại cơ sở dữ liệu `clinical_hospital.db`.

---

### 1. Cấu Trúc Thư Mục Tri Thức
* **`ddi_interactions/` (Tương Tác Thuốc Chống Chỉ Định):**
  * `qd_5948_antibiotics_and_antiinflammatory.md`: Tương tác chống chỉ định Kháng sinh & Kháng viêm NSAID (Aceclofenac + Ketorolac, Ceftriaxon + Calci, Simvastatin + Macrolid, Ciprofloxacin + Theophyllin, Methotrexat + NSAID).
  * `qd_5948_cardiovascular_and_cns.md`: Tương tác chống chỉ định Tim mạch, Thần kinh & Huyết học (Nitrat + PDE5-i, Amiodaron + QT prolonging/Colchicin, Clopidogrel + PPI, ACEI/Spironolacton + KCl, Tramadol + MAOI).
* **`clinical_pharmacopoeia/` (chuyên luận nội bộ dẫn xuất):**
  * `core_inns_monographs.md`: Chuyên luận liều chuẩn người lớn, liều trẻ em, trần 24h, chỉnh liều suy thận ClCr và chống chỉ định các hoạt chất gốc (Paracetamol, Ceftriaxon, Morphin, Diazepam, Vancomycin, Metformin).
* **`regulatory_circulars/` (Quy Chế & Thông Tư Chuyên Môn Bệnh Viện):**
  * `tt51_2017_anaphylaxis_protocol.md`: Phác đồ xử trí cấp cứu phản vệ và liều tiêm bắp Adrenalin 1mg/1ml (TT 51/2017/TT-BYT).
  * `tt20_2017_narcotics_management.md`: Quy chế tủ 2 khóa thuốc gây nghiện, hướng thần, thu hồi và tiêu hủy 100% vỏ ống tiêm (TT 20/2017/TT-BYT).
  * `tt22_2011_hospital_pharmacy_ward.md`: Quy chế cơ số tủ trực cấp cứu khoa phòng và bàn giao ca trực (TT 22/2011/TT-BYT & TT 23/2011/TT-BYT).

---

### 2. Nguyên Lý Kế Thừa Hoạt Chất (INN-Level Inheritance)
* Cơ sở dữ liệu thương mại Cục Quản lý Dược (DAV) chứa **54.885 số đăng ký biệt dược**.
* Việc nhập thủ công liều lượng/tương tác cho từng biệt dược là bất khả thi và dễ sai sót.
* Các biệt dược chỉ được quy về INN khi mapping đã được duyệt; không suy diễn độ bao phủ từ tổng số đăng ký:
  $$\text{DAV Drug Record} \xrightarrow{\text{active\_ingredient (INN)}} \text{Clinical Knowledge Base}$$
* Việc ánh xạ biệt dược về INN chỉ được coi là hợp lệ khi bản ghi mapping đã được duyệt; không tự động suy ra an toàn hoặc liều dùng từ tên thương mại.

---

### 3. Kiểm soát provenance và giới hạn sử dụng
* Dữ liệu dẫn xuất phải giữ provenance và được validator kiểm tra; các bản ghi bổ sung nội bộ không được trình bày như trích nguyên văn PDF.
* Không dùng kho này như nguồn duy nhất để quyết định điều trị; mọi cảnh báo cần đối chiếu nguồn hiện hành và bối cảnh người bệnh.

---

### 4. Danh mục liên kết nguồn tham khảo
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
  * Dược thư Quốc gia lần xuất bản II (2015), QĐ 2033/QĐ-BYT: bản PDF nội bộ được định danh và băm trong `clinical_source_manifest.json`.
  * TT 51/2017/TT-BYT (Phác đồ Adrenalin phản vệ): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-51-2017-TT-BYT-huong-dan-phong-chan-doan-va-xu-tri-phan-ve-371587.aspx
  * TT 20/2017/TT-BYT (Thuốc gây nghiện & vỏ ống): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-20-2017-TT-BYT-huong-dan-Luat-duoc-ve-thuoc-phai-kiem-soat-dac-biet-349887.aspx
  * TT 22/2011/TT-BYT (Tủ trực Khoa Dược): https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-22-2011-TT-BYT-to-chuc-va-hoat-dong-cua-khoa-Duoc-benh-vien-124968.aspx
* **CSDL Dược Quốc tế Tham Chiếu (Mã ATC & Nhãn FDA):**
  * OpenFDA Drug Label API: https://api.fda.gov/drug/label.json?search=openfda.generic_name:ceftriaxone&limit=1
  * WHO Collaborating Centre for Drug Statistics Methodology (Mã phân loại ATC): https://www.whocc.no/atc_ddd_index/
  * NIH DailyMed: https://dailymed.nlm.nih.gov/dailymed/
