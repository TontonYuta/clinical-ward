# Clinical Feature Flags Design

## Intent

Cho phép hội đồng/quản trị viên bật hoặc ẩn các tab chức năng của Clinical Ward từ Monitor mà không phải sửa mã nguồn hoặc build lại frontend. Cấu hình áp dụng đồng nhất cho sidebar, mobile navigation, overview actions và điều hướng từ chatbot.

## Goals

- Backend/database là nguồn cấu hình chính cho trạng thái tab.
- Frontend dùng bản cấu hình đã tải gần nhất khi backend tạm thời offline.
- Quyền theo vai trò vẫn được áp dụng; một tab chỉ hiện khi vừa được bật toàn hệ thống vừa được phép bởi vai trò.
- Điều hướng trực tiếp hoặc action card tới tab bị tắt phải chuyển về tab hợp lệ an toàn.
- Monitor có màn hình bật/tắt, hiển thị nhãn và trạng thái lưu thành công/lỗi.

## Non-goals

- Không thay đổi quyền RBAC, dữ liệu nghiệp vụ hoặc nội dung y khoa.
- Không cho phép feature flag thay thế kiểm soát quyền người dùng.
- Không tự động bật lại tab đã bị quản trị viên tắt khi offline.

## Approach

Sử dụng bảng `clinical_feature_flags` với định danh tab ổn định, nhãn hiển thị, mô tả, trạng thái bật/tắt và thời điểm cập nhật. API admin cung cấp danh sách và cập nhật toàn bộ trạng thái theo phiên bản. Clinical app tải cấu hình một lần khi khởi động và lưu cache local theo phiên bản; nếu tải lỗi thì dùng cache, nếu chưa có cache thì dùng cấu hình mặc định an toàn đã khai báo trong module metadata.

## Contract

- `GET /api/v1/admin/feature-flags` → `{version, flags[]}`
- `PUT /api/v1/admin/feature-flags` nhận `{version, flags:[{key, enabled}]}` và trả cấu hình mới; từ chối version cũ.
- Tab keys dùng `DashboardTab`; `overview` luôn bật và không cho tắt.
- Frontend export `loadFeatureFlags()` và `getEffectiveAllowedTabs(role, flags)`.

## Offline behavior

Cache hợp lệ được dùng khi API không truy cập được. Nếu không có cache, dùng metadata mặc định; không hiển thị tab ngoài danh sách quyền của vai trò.

## Acceptance

- Tắt `bhyt_audit` trên Monitor làm tab biến mất khỏi desktop/mobile và chặn action card điều hướng vào tab đó.
- Bật lại tab trên Monitor làm tab xuất hiện sau lần tải cấu hình kế tiếp.
- Backend từ chối cập nhật version cũ.
- Frontend vẫn khởi động và giữ cấu hình gần nhất khi API offline.
