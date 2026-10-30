# Kho dược gọn hơn và tra cứu danh mục nhanh

## Intent
Giảm khoảng trống giữa các thành phần của các tab, tinh gọn danh sách Kho dược và làm dữ liệu tồn kho bệnh viện trong Kho dược Quốc gia chính xác, nhanh khi truy cập lại.

## Goals
- Thu gọn khoảng đệm khung nội dung và các hàng bảng/card mà vẫn giữ khả năng đọc.
- Bảng kho tách tồn kho và vị trí; bỏ hành động Xuất khỏi danh sách; bỏ nút Dược thư riêng vì tên thuốc mở chi tiết.
- Đối soát kho bệnh viện trên toàn bộ danh sách thuốc bằng SĐK đã chuẩn hóa, không so khớp gần đúng theo tên.
- Kết quả cache được hiển thị tức thì khi quay lại; độ mới được xác thực bằng revision dữ liệu danh mục và tồn kho trước khi đánh dấu là hiện hành.

## Non-goals
- Không thay đổi dữ liệu nguồn hoặc quy tắc nghiệp vụ xuất/nhập kho.
- Không suy đoán SĐK từ tên thuốc.

## Approaches
- Ghép tồn kho trên frontend với các trang hiện có: ít thay đổi nhưng không thể lọc chính xác toàn bộ danh mục và phải chuyển dữ liệu batch lớn xuống client.
- Endpoint backend trả trang thuốc kèm aggregate tồn kho theo SĐK và lọc kho toàn danh mục (được chọn): một nguồn đối soát chính xác, cache theo query/revision; cần bổ sung revision thay đổi rõ ràng.
- Tải toàn bộ registry và cache client: vào lại nhanh sau lần đầu nhưng tải nặng và khó invalidation chính xác.

## Implementation calls
- Chuẩn hóa SĐK bằng trim, Unicode normalization và lowercase; gộp các batch cùng SĐK, cộng lượng chỉ trong cùng đơn vị; nếu cùng SĐK có nhiều đơn vị, không cộng sai đơn vị mà trả chi tiết theo đơn vị/đánh dấu cần xử lý.
- Backend lọc trạng thái có tồn sau aggregate và trả tổng số thuốc có tồn trên tập kết quả trước phân trang.
- Cache phía client phân biệt danh mục và tồn kho. Cache hiển thị ngay; gọi revision nhẹ tới CSDL. Revision khớp thì giữ cache như hiện hành, khác thì nạp trang mới; mất kết nối thì báo chưa cập nhật được.
- Thu gọn spacing có chọn lọc cho container/tab, bảng và card; không làm nhỏ cỡ chữ mặc định.

## Verification
Chạy lint/build, kiểm tra truy vấn API theo SĐK và bộ lọc kho trên nhiều trang, cache hit/revision mismatch, cùng Playwright desktop/mobile cho bảng kho và các tab.
