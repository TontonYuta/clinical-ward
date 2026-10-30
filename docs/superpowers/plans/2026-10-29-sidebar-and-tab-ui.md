# Sidebar và tab UI implementation plan

## Task 1: Khung điều hướng và tiện ích toàn cục
- Bỏ header hiện tại có tên tab và menu toggle.
- Bỏ header và cỡ chữ.
- Chuyển lựa chọn vai trò xuống avatar cuối sidebar; chuyển nút thu/mở vào trạng thái hover logo; giữ đóng drawer trên mobile.
- Bỏ phân hệ Thuốc/TBYT và hiển thị mọi tab được phép độc lập.
- Chuyển trợ lý AI ra nút nổi phải dưới và làm cửa sổ chat kéo được/phóng to.

## Task 2: Kho dược
- Bỏ heading và hàng phân kho riêng.
- Đưa tất cả/nội trú/ngoại trú, danh mục, trạng thái, nhóm dược lý, quy chế, search và mở registry vào một toolbar ngang cuộn được.
- Giữ modal và semantics/accessibility của điều khiển.

## Task 3: Rà soát tab khác
- Bỏ heading trùng ở tab nợ và sự cố; giữ KPI quan trọng.
- Kiểm tra tab chuỗi lạnh, kiểm kê, kê đơn để giữ thông tin riêng nhưng tránh title trùng với sidebar.
- Chuẩn hóa các thanh search/filter liên quan ở desktop và mobile mà không đổi hành vi.

## Task 4: Xác minh
- Chạy `npm run lint` và `npm run build`.
- Kiểm tra diff và các selectors/labels điều hướng quan trọng.
