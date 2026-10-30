# Thiết kế: Catalog DAV bổ sung trong DB hiện tại

## Ý định

Thêm catalog chuẩn hóa DAV và các liên kết nguồn vào `backend/clinical_hospital.db` để có thể shadow-read và chuyển đổi từng bước. Bảng `dav_national_drugs`, dữ liệu lâm sàng, tồn kho và endpoint hiện hành tiếp tục hoạt động trong suốt giai đoạn này.

## Mục tiêu

- Lưu snapshot nguồn DAV và metadata/hash để truy xuất nguồn.
- Cung cấp catalog sản phẩm chuẩn hóa, duy nhất theo SĐK đã phân xử.
- Giữ hàng đợi/quan hệ bản ghi raw cho SĐK trùng hoặc chưa phân xử.
- Lưu thành phần thô, trạng thái tách, mapping INN và provenance độc lập khỏi dữ liệu hành chính.
- Tối ưu tra cứu SĐK và tìm kiếm tên/hoạt chất bằng index/FTS5.
- Cho phép rollback bằng cách ngừng đọc các bảng mới; không xóa hoặc sửa dữ liệu cũ.

## Ngoài phạm vi

- Không thay thế hoặc cập nhật `dav_national_drugs` trong bước này.
- Không tự gán INN cho thành phần chưa ánh xạ.
- Không tự tạo khuyến cáo tương tác thuốc từ phép khớp tên.
- Không bật catalog mới làm nguồn endpoint mặc định cho người dùng.

## Ràng buộc đã xác nhận

- DB ứng dụng mặc định là `backend/clinical_hospital.db`.
- Bảng cũ có 54.885 hồ sơ; 30.806 hồ sơ có liên kết chuyên khảo lâm sàng.
- Snapshot raw hiện có 55.005 dòng; 120 nhóm SĐK bị trùng. Có 119 nhóm có đề xuất chọn bản ghi và 1 nhóm còn mơ hồ.
- Canonical staging hiện có 54.884 hồ sơ, 12.879 mapping INN và 43.614 thành phần chưa ánh xạ.
- Các trường `isActive`, `isHetHan`, `isDaRutSoDangKy`, `isDeleted` được lưu đúng theo nguồn, không diễn giải `isDuocPhep` thành trạng thái pháp lý.
- Endpoint cũ trả cả bản ghi inactive/expired; mọi chế độ lọc mới phải được truyền tường minh.

## Các phương án

1. **Bảng bổ sung trong DB hiện tại (đề xuất):** bảo toàn ứng dụng và dữ liệu cũ, có thể shadow-read trên cùng snapshot; migration tăng dung lượng DB và cần theo dõi thời gian ghi/index.
2. **DB thuốc riêng:** cô lập catalog tốt hơn nhưng cần thêm lifecycle kết nối, đồng bộ và vận hành backup.
3. **Thay bảng cũ:** đơn giản về schema đích nhưng rủi ro cao do khác biệt dữ liệu và liên kết lâm sàng; không phù hợp giai đoạn hiện tại.

## Thiết kế đề xuất

Thêm các bảng có namespace riêng, không sửa bảng legacy:

- `dav_catalog_runs`: ID lần nhập, source URL, source hash, timestamp, counts, trạng thái run.
- `dav_source_records`: bản raw JSON theo `run_id` và `source_record_id`, có unique constraint theo nguồn.
- `dav_record_resolution`: SĐK chuẩn hóa, trạng thái `unique/selected/superseded/unresolved`, source ID được chọn và lý do.
- `dav_duplicate_groups`: các nhóm SĐK trùng, candidate count và trạng thái review.
- `dav_catalog_products`: hồ sơ chuẩn hóa, khóa chính nội bộ, `run_id`, source ID, SĐK, các trường DAV, flags và trạng thái nguồn; index SĐK, trạng thái, tên.
- `dav_product_ingredients`: chuỗi thành phần gốc, thứ tự, hàm lượng nếu tách được, trạng thái parser và lý do review.
- `dav_ingredient_mappings`: INN/ATC chỉ khi mapping được từ dictionary hoặc alias đã duyệt, kèm match type và dictionary version.
- `dav_product_search`: FTS5 cho SĐK, tên, thành phần raw và INN mapped; khóa source/product không bị tokenize.

Mỗi lần import dùng `run_id` mới. Nạp và kiểm tra trong transaction; chỉ đánh dấu run `ready` sau khi counts, unique SĐK canonical, foreign keys và hash xác minh đạt. Run trước được giữ để audit. Không xóa run cũ trong migration đầu tiên.

## Di trú và rollback

1. Backup SQLite bằng online backup API và kiểm tra `integrity_check`.
2. Tạo bảng mới và index trên bản sao; import canonical staging thành một run.
3. Kiểm tra counts, duplicate resolutions, mapping totals, foreign keys, FTS và tính toàn vẹn.
4. Chạy shadow-read song song với endpoint cũ cho truy vấn, bộ lọc, thứ tự và phân trang; chỉ ghi báo cáo, không đổi response production.
5. Rollback trước cutover: giữ nguyên DB cũ và xóa/bỏ qua `run_id` mới trên bản thử. Sau cutover trong tương lai: cấu hình chuyển về endpoint cũ; không xóa bảng cũ.

## Điều kiện trước khi bật đọc mới

- Chênh lệch hành chính được báo theo trường và có quy tắc nguồn rõ ràng.
- 1 nhóm SĐK unresolved không xuất hiện như một thuốc duy nhất trong kết quả canonical.
- Tìm kiếm exact code, FTS, trạng thái inactive/expired, filter, sort, pagination có parity được xác nhận hoặc sai khác được chấp nhận rõ ràng.
- Không giảm số liên kết clinical monograph/inventory ở endpoint cũ.
- Backup phục hồi được và rollback được diễn tập trên bản sao.

## Quyết định cần duyệt

Đề xuất thực hiện migration bổ sung trong cùng DB, nạp trước trên backup/staging copy, và chỉ bật endpoint mới sau shadow comparison riêng.
