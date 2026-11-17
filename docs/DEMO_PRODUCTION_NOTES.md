# Ghi chú bản demo production

- Bản demo hiện dùng API production đang để `AUTH_REQUIRED=false`; vì vậy trang đăng nhập không xuất hiện khi truy cập production.
- Tài khoản `admin/admin` hiện chỉ tồn tại trong cơ sở dữ liệu local, không được đưa vào mã nguồn hoặc cấu hình production.
- Nếu cần bật form đăng nhập demo, phải tạo/cấu hình tài khoản demo và bật xác thực ở backend qua biến môi trường, sau khi xác nhận cơ chế lưu dữ liệu tài khoản tồn tại ổn định qua lần deploy/restart.
- Trước khi dùng thật hoặc để người dùng bên ngoài truy cập, phải thay mật khẩu demo bằng mật khẩu mạnh và rà soát cấu hình quyền.
- Ảnh nền `public/images/login-locai-background.webp` do người dùng cung cấp; xác minh quyền sử dụng trước khi phát hành rộng rãi.
