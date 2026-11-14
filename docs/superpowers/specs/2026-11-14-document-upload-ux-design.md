# Thiết kế UX upload tài liệu

## Mục tiêu
Làm cho thao tác thêm PDF dễ hiểu và gọn: hộp thoại có vùng kéo thả/chọn file, thông tin file đã chọn, metadata ngắn gọn, trạng thái nạp rõ ràng, hiển thị gần toàn màn hình trên mobile.

## Phương án
Giữ hộp thoại hiện tại và nâng cấp thành dropzone/form có phản hồi ngay. Đây là phương án người dùng chọn; panel bên phải không được chọn vì mobile cần một bố cục riêng và modal bảo toàn ngữ cảnh thư viện.

## Ràng buộc
- Chỉ nhận PDF; không thay đổi API ingestion hoặc metadata hiện có.
- Cho phép chọn file qua input và kéo-thả.
- Hiển thị tên, dung lượng, và lỗi file trước khi upload.
- Trạng thái loading thành công/thất bại tiếp tục dùng kết quả từ backend indexing.
- Trên mobile, dialog gần toàn màn hình; desktop giữ kích thước vừa phải.
