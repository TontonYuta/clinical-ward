# Thiết kế tab ngang cho chi tiết thuốc

## Mục tiêu

Giảm cảm giác rối mắt trong chi tiết thuốc bằng cách gom các trường hiện có theo mục đích tra cứu và chỉ hiển thị một nhóm tại một thời điểm. Không thay đổi dữ liệu, logic truy vấn hoặc nguồn trích dẫn.

## Bố cục đề xuất

- Giữ phần đầu modal gọn với tên thuốc, hoạt chất, hàm lượng, SĐK và thao tác tải lại.
- Dùng thanh tab ngang: **Tổng quan**, **An toàn**, **Liều dùng**, **Thông tin đăng ký** và **Lô bệnh viện**.
- Tổng quan hiển thị thông tin nhận diện và cách dùng cơ bản.
- An toàn gom chống chỉ định, thận trọng, thai kỳ, tác dụng phụ, tương tác, xử trí quá liều và thuốc giải độc.
- Liều dùng gom liều người lớn/trẻ em và hiệu chỉnh thận, gan; giữ các chỉ số liều nhanh đang có.
- Thông tin đăng ký gom phân loại, dạng bào chế, quy cách, tiêu chuẩn, hạn lưu hành, cơ sở sản xuất/xuất xứ và tài liệu HDSD/nhãn.
- Lô bệnh viện chỉ xuất hiện khi mở chi tiết từ một lô; hiển thị số lô, hạn dùng, tồn, định mức và vị trí.
- Nội dung nguồn chuyên luận/PDF nằm cùng nhóm thông tin lâm sàng, không nhân bản thành các khối rời ở ngoài tab.
- Trên màn hình nhỏ, thanh tab cuộn ngang; phần nội dung vẫn cuộn dọc trong modal.

## Phương án đã cân nhắc

- **Tab ngang theo nhóm (đề xuất):** giảm lượng nội dung đồng thời và giúp chuyển thẳng tới nhóm cần tra cứu; các tab lâm sàng hiện có được nhập vào cấu trúc nhóm cấp cao.
- Accordion trên một trang: vẫn để nhiều nhóm kéo dài theo chiều dọc, khó định vị nhanh khi chuyên luận dài.
- Giữ hai cột hiện tại: ít thay đổi nhưng tiếp tục duy trì mật độ khối thông tin gây rối mắt.

## Ràng buộc và tiêu chí hoàn thành

- Giữ nguyên nguồn dữ liệu, thứ tự ưu tiên dữ liệu live/hồ sơ thuốc/lô và hành vi cập nhật hiện có.
- Không làm mất liên kết PDF, cổng DAV, thông báo tải hoặc khả năng đóng modal.
- Khi không có dữ liệu cho một nhóm, hiển thị trạng thái trống gọn, không để tab trắng khó hiểu.
- Kiểm tra modal cả khi mở từ danh mục quốc gia (không có lô bệnh viện) và khi mở từ một lô kho.
