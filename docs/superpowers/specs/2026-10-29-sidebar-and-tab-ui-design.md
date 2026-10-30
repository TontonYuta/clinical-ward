# Sidebar và thanh công cụ tab

## Ý định
Giảm tiêu đề và thanh điều hướng lặp lại, dành thêm không gian cho nội dung tab, theo mẫu sidebar có nút thu gọn tích hợp ở đầu như ChatGPT web.

## Mục tiêu
- Bỏ header toàn cục đang lặp tên tab; giữ các tiện ích toàn cục cần thiết trong một thanh tiện ích gọn.
- Đưa nút thu gọn/mở rộng vào vùng logo sidebar; bỏ nút thu gọn ở chân sidebar. Trên mobile, nút vẫn đóng/mở drawer.
- Sidebar là nơi duy nhất đặt tên tab. Xóa heading trùng trong nội dung Kho dược, Sổ nợ, Sự cố thiết bị và các màn tương tự nếu có.
- Kho dược dùng một thanh công cụ gồm tìm kiếm và các chọn kho (tất cả/nội trú/ngoại trú), danh mục, trạng thái tồn, nhóm dược lý, quy chế và mở Kho Dược Quốc Gia.
- Rà soát các tab khác để sửa tiêu đề lặp và bộ lọc/tìm kiếm bị chia thành các hàng không cần thiết, giữ nguyên thao tác nghiệp vụ.

## Không mục tiêu
- Không thay đổi dữ liệu, logic lọc, phân quyền hoặc quy trình nghiệp vụ.
- Không ép các màn không có tìm kiếm/lọc vào một toolbar giả tạo.

## Cách tiếp cận
Chỉnh khung ứng dụng trước, sau đó thống nhất từng toolbar phù hợp. Giữ điều khiển toàn cục đang có (vai trò, cỡ chữ, âm thanh, trợ lý, cảnh báo) trong thanh tiện ích mỏng bên trên nội dung; bỏ tiêu đề tab và nút menu khỏi thanh này. Đưa toggle sidebar vào header của sidebar, cạnh logo.

## Quyết định triển khai
- Sidebar desktop vẫn có hai trạng thái rộng/thu gọn và lưu lựa chọn hiện tại. Mobile giữ drawer và nút đóng.
- Logo sidebar luôn hiện. Khi hover vùng logo, logo chuyển thành nút thu/mở; trên sidebar thu gọn, hover logo hiện nút mở rộng.
- Xóa thanh tiện ích trên cùng; chuyển chọn vai trò xuống avatar cuối sidebar, font mặc định lớn; bỏ tùy chỉnh cỡ chữ.
- Bỏ chọn phân hệ Thuốc/TBYT. Các tab dược và thiết bị đều điều hướng độc lập và chỉ lọc theo quyền truy cập.
- Trợ lý AI dùng nút nổi cố định góc phải dưới, tooltip khi hover, cửa sổ chat di chuyển bằng kéo header và có chế độ phóng to.
- Toolbar kho đặt lựa chọn nội trú/ngoại trú dưới dạng select cùng các bộ lọc khác và search. Trên màn hình hẹp toolbar có thể cuộn ngang.
- Các tab chỉ giữ một tiêu đề ở sidebar; heading nội dung chỉ giữ KPI nếu có giá trị riêng.
- Giữ trạng thái cảnh báo lạnh và các hành động nghiệp vụ trong nội dung liên quan.

## Kiểm tra
Chạy lint/build; kiểm tra diff để bảo đảm không còn title lặp hiển nhiên, toolbar kho có đủ lựa chọn, sidebar toggle hoạt động và các tiện ích toàn cục còn truy cập được.
