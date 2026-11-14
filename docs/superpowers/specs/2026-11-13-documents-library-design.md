# Thiết kế: Thư viện tài liệu độc lập

## Mục tiêu
Thêm trang **Tài liệu** riêng trong ứng dụng để lưu, tìm kiếm và mở các PDF như Nghị định, Thông tư, Dược thư. Trang không dùng lại modal pháp lý cũ hay bố cục tab nghiệp vụ. Người dùng có thể tải PDF mới; backend lưu tài liệu, đưa văn bản trích xuất vào chỉ mục chatbot và trả tài liệu trong danh mục để mở lại.

## Phạm vi và giới hạn
- Danh mục, loại tài liệu, số hiệu, năm và tiêu đề lấy từ dữ liệu backend/metadata người nhập; không tạo danh sách văn bản cố định ở FE.
- Giao diện gồm header, tìm kiếm, bộ lọc loại hình lấy từ danh mục hiện có, danh sách/thẻ tài liệu và nút đọc PDF.
- Luồng tải lên yêu cầu PDF, tiêu đề, loại tài liệu, căn cứ/số hiệu và năm; hiển thị kết quả/lỗi nạp.
- Không sửa modal `LegalDocsModal` hoặc xóa dữ liệu/logic tài liệu cũ khác.
- Không thêm xóa/sửa metadata hoặc xử lý OCR PDF scan trong phần này.

## Phương án
1. Giữ modal cũ rồi thêm liên kết: nhanh nhưng không tạo được trải nghiệm thư viện độc lập; không chọn.
2. Trang FE riêng, API upload hiện có, thêm API danh mục và xem PDF đã lưu: chọn vì tận dụng ingestion hiện tại và hoàn thành vòng đời xem lại.
3. Xây dịch vụ lưu trữ tài liệu mới: trùng lặp với kho PDF/manifest và tăng rủi ro đồng bộ; không chọn.

## Thiết kế kỹ thuật
- Sidebar callback điều hướng sang trang thư viện độc lập thay vì mở `LegalDocsModal`.
- Component thư viện gọi API danh mục và API upload, lọc danh mục ở client theo metadata trả về; mở PDF qua URL từ backend.
- Backend đọc manifest nguồn hiện tại để liệt kê tài liệu đã ingest, trả metadata an toàn và đường dẫn PDF; tài liệu upload được lưu ổn định vào kho PDF backend/public và vẫn được index vào FTS.
- PDF được truy cập qua route tĩnh hiện có, dựa trên tên file đã sanitize.

## Tiêu chí hoàn tất
- Chọn Tài liệu từ sidebar mở trang độc lập trên desktop/mobile.
- Tài liệu đã có trong manifest hiện ra và có thể mở PDF.
- Upload PDF thành công thì tài liệu xuất hiện trong danh mục và nội dung searchable bởi RAG.
- Tìm kiếm/lọc hoạt động với metadata động. Upload lỗi hiển thị rõ, không làm mất trang.
