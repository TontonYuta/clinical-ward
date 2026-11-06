# Debug chatbot — 06/11/2026

## Trạng thái chạy thực tế

- Local UI `http://localhost:3000` và API `http://localhost:8000` chạy được. API được khởi động lại để nhận sửa đổi. Cả hai bind `0.0.0.0`; chưa xác minh kết nối từ một thiết bị LAN khác.
- Mở trình duyệt thật tại https://clinical-ward.vercel.app, mở chatbot và gửi duy nhất `Xin chào`: nhận trả lời qua `/api/v1/copilot/chat/stream`, HTTP 200, không ghi nhận lỗi JavaScript. Đây là kiểm tra kết nối và một lượt chào, không phải kiểm định lâm sàng trên production.
- Bản Vercel quan sát được gọi backend Render trực tiếp và dùng streaming. Checkout local dùng `/api/v1/copilot/chat` trả JSON. Giao diện và asset JS cũng khác. Chưa xác định SHA deployment; không được suy ra Vercel đã chứa các sửa đổi local này. Không triển khai production trong lần debug.

## Lỗi đã tái hiện và sửa

| Tình huống | Trước sửa | Sau sửa |
| --- | --- | --- |
| Hỏi Concor 5mg, sau đó `Thuốc này có tương tác với Ibuprofen không?` | Tra riêng hồ sơ Ibuprofen, bỏ Concor | Giữ cả hai tên và chuyển sang bộ tra tương tác. Cặp không có kết quả khớp thì từ chối kết luận, không xác nhận an toàn. |
| Thuốc đang hỏi là Warfarin; hỏi `Thuốc này có tương tác với Aspirin và Ibuprofen không?` | Bỏ Warfarin, chỉ xét hai thuốc được ghi rõ | Gửi đủ ba tên vào bộ tra. |
| Câu hỏi ghi rõ hai thuốc mới | Có thể giữ chủ thể đơn thuốc cũ cho lượt tiếp theo | Xóa chủ thể đơn cũ, lưu danh sách đang so sánh. `Thuốc này` sau đó cần làm rõ. |
| Không tìm thấy cảnh báo tương tác | Trả `retrieved_evidence`, confidence 1 và diễn đạt như đã thẩm định | Trả `safe_abstention`, `no_matching_interaction_evidence`, confidence 0; nêu rõ thiếu kết quả không xác nhận phối hợp an toàn. |
| `Metformin dùng cho bệnh gì?` | DAV ghi `Metformin.HCl`; so chuỗi với tên generic thất bại, áp nhầm chặn biệt dược | Dùng INN của chuyên luận đã liên kết cùng định danh canonical có sẵn để nhận diện tên generic. Không thêm nội dung y khoa hoặc ánh xạ muối mới. Không miễn kiểm tra chế phẩm cho Glucophage/Efferalgan. |
| Bấm `Làm mới phiên hội thoại` sau khi hỏi Concor | Chỉ xóa tin nhắn trên màn hình, `_clientSessionId` vẫn giữ ngữ cảnh Concor ở server | Tạo ID phiên mới và xóa trạng thái chống gửi trùng; hỏi lại không kế thừa thuốc cũ. Khóa nút trong lúc xử lý để phản hồi đang chạy không rơi vào phiên mới. |

Việc giữ tên Concor không đồng nghĩa đã xác minh được ánh xạ/phạm vi DDI cho Concor. Bộ chuẩn hóa hiện không bao phủ mọi biệt dược. Kết quả không khớp vì vậy vẫn dừng ở thiếu bằng chứng.

## Các ranh giới đã kiểm tra

- Câu tham chiếu được giải quyết trước khi LLM viết lại query hoặc luồng tra một thuốc đổi chủ thể.
- Phân biệt `nó` với `no` trong `uống lúc no`; không tự chèn Warfarin từ ngữ cảnh cũ vào câu hỏi Ibuprofen–thức ăn.
- Hỏi danh sách `thuốc này tương tác với thuốc nào?` vẫn đi vào tra chuyên luận/FSM, không bắt buộc nhập thuốc thứ hai.
- Ca bệnh nhiều thuốc có eGFR/suy thận tiếp tục đi qua luồng đánh giá ca bệnh hiện có; không bị kết quả DDI đơn thuần chặn trước. Test dùng kết quả giả đánh dấu luồng để chứng minh định tuyến, không xác nhận khuyến cáo của luồng ca bệnh.
- Efferalgan, Zithromax và Oresol vẫn từ chối hướng dẫn chế phẩm khi thiếu bằng chứng phù hợp; không nới guard để vượt các kỳ vọng cũ.
- Triệu chứng sốt của người bệnh không trở thành thuốc `Nhân trần` hoặc một hồ sơ thuốc không liên quan.

## Bằng chứng xác minh

Các lần thử trước sửa được lưu ở `artifacts/chatbot-debug-20261106/red-*.log`. Kiểm thử được viết và quan sát thất bại trước các sửa tương ứng.

| Kiểm tra | Kết quả |
| --- | --- |
| Bảy tệp backend về chủ thể, ngữ cảnh, tương tác, nguồn và cách dùng chế phẩm | **102 passed**, gồm 15 ca ngữ cảnh tương tác |
| Năm kiểm thử ASGI hiện có về hỏi tiếp, đổi thuốc và cách ly phiên | **5 passed**, dùng DB riêng |
| `npm run test:chat-session` | Qua: trình duyệt kiểm tra ID request đổi khi reset, gửi lại cùng câu hỏi ngay, giữ ID cho hỏi tiếp, khóa reset khi đang chờ. Auth, dữ liệu đọc và trả lời chat được mock rõ ràng. |
| Trình duyệt với API thật, DB riêng, đăng nhập bác sĩ thử nghiệm | **9 lượt hỏi + 2 lượt tái hiện reset đều qua**, HTTP 200, không ghi nhận lỗi JavaScript |
| `npm test`, `npm run lint`, `npm run build`, `git diff --check` | Qua |
| Rà soát độc lập bản sửa | Không còn phát hiện Critical/Important trong phạm vi diff đã rà soát; chạy riêng nhóm ngữ cảnh/nguồn và test reset trên UI 3001 |

11 lượt qua UI thực gồm: chỉ định Metformin; hỏi tiếp chống chỉ định; hồ sơ Concor; hỏi tiếp Concor–Ibuprofen; cảnh báo Warfarin–Aspirin; tham chiếu thiếu chủ thể; hỏi lại ngay sau reset; Efferalgan thiếu nguồn đúng chế phẩm; ca sốt thiếu dữ liệu; và hai lượt riêng chứng minh Concor không còn được kế thừa sau reset. Việc hiện cảnh báo Warfarin–Aspirin kiểm tra phần mềm giữ quy tắc hiện có, không tái thẩm định nội dung quy tắc đó.

API thử nghiệm `127.0.0.1:8001`, UI `127.0.0.1:3001`, DB `artifacts/chatbot-debug-20261106/debug.sqlite` được tách khỏi DB server chính. Không gọi nhà cung cấp AI, SMS/email hoặc lưu đơn thuốc trong các ca local. Tài khoản thử và DB không đưa vào Git.

Bằng chứng tại `artifacts/chatbot-debug-20261106/`: `affected-tests.log`, `integration-tests.log`, `green-reset-ui.log`, `manual-chat.log/json`, `green-reset-real.log/json`, `vercel-chat.json`, `local-concor-pair.png`, `npm-test.log`, `lint.log`, `build.log`. Các artifact này bị Git ignore.

## Phần chưa được xác nhận

- Không chạy lại toàn bộ backend trong lần sửa này. Kết quả toàn bộ **479 passed / 30 failed** trước đó là mốc lịch sử, không phải kết quả của HEAD hiện tại. Xem [phân loại lỗi trước đó](2026-11-05-backend-failure-classification.md).
- Chưa rà soát lại toàn bộ chuyên luận, trích dẫn trang và quy tắc y khoa. Nhánh thời điểm uống trong `copilot_drug_formatter.py` còn các chuỗi hướng dẫn theo thuốc và hướng dẫn mặc định cần đối chiếu nguồn riêng; các test định tuyến không chứng minh những nội dung đó đúng.
- Các thiếu hụt nguồn chế phẩm, metadata và xác thực nêu trong [báo cáo liên quan](2026-11-06-relevance-review.md) vẫn phải theo dõi. Sửa nhận diện Metformin không xác nhận đúng mọi dạng giải phóng, liều hoặc cách dùng của các sản phẩm Metformin.
- Kiểm tra Vercel chỉ chứng minh lượt chào hoạt động trên deployment đang có. Các sửa đổi trong báo cáo này phải được triển khai và kiểm tra lại mới có thể nói đã áp dụng ở đó.

Đây là kết quả debug phần mềm và kiểm tra phạm vi bằng chứng, không phải xác nhận chatbot đủ điều kiện đưa ra quyết định y khoa hoặc đáp ứng đầy đủ pháp luật y tế Việt Nam.
