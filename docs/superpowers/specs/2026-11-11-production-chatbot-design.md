# Thiết kế chatbot production

## Mục tiêu
Chatbot lâm sàng có workflow evidence-grounded, không nhúng tri thức/từ vựng lâm sàng vào code, đo token cost, báo đúng online/local/offline, nhận PDF qua quy trình có provenance. Icon chatbot nháy chậm, dễ truy cập và tôn trọng reduced motion.

## Kiến trúc đích
Admin upload PDF → xác thực/trích xuất → chunk có trang/mục và provenance → embedding + chỉ mục → review/publish phiên bản tri thức.
Câu hỏi + session tối thiểu → kiểm tra an toàn chung → một kết quả NLU có schema → chọn nguồn (kho tài liệu và/hoặc CSDL/API vận hành live) → hybrid retrieval → xếp hạng/khử trùng/ngân sách context → sinh claims có cấu trúc từ evidence → kiểm tra claim/citation/provenance/số liệu → trả lời có dẫn chứng hoặc hỏi lại/abstain.
Health backend/DB/index/provider → API trạng thái → UI. Glow icon độc lập với trạng thái kết nối.
Telemetry: token provider báo, số lần gọi, cache, evidence ID, chất lượng, latency, mode.

Ba mode: online_ai (backend và provider được xác nhận khả dụng), local_only (backend/index local khả dụng, cloud không dùng được; chỉ trả lời trong năng lực local có chứng cứ), offline (backend không truy cập được). Có trạng thái checking/unknown nhưng không hiển thị online. Retrieval local không đồng nghĩa có model sinh local; tổng hợp tự do khi mất mạng là năng lực local riêng cần đánh giá mô hình/phần cứng.

## Nguyên tắc
- Không có facts lâm sàng, danh sách trigger nghiệp vụ hoặc câu trả lời y khoa viết sẵn trong application code. Thuật toán chung, schema, bảo mật, giới hạn tài nguyên vẫn có thể là code/config.
- Mọi factual claim grounded gắn evidence ID/citation tới tài liệu, phiên bản/hash, trang/mục và chunk đã gửi vào generation. Thiếu/mâu thuẫn evidence thì bỏ claim, hỏi lại hoặc abstain.
- Citation không tự chứng minh claim đúng; cần kiểm provenance và hỗ trợ ngữ nghĩa.
- API key chỉ ở server; key hiện diện không có nghĩa provider online.
- Tồn kho, bệnh nhân, đơn thuốc, thiết bị và cold-chain lấy từ DB/API vận hành có phân quyền, không thay bằng PDF snapshot.
- PDF chỉ thành tri thức production sau kiểm tra chất lượng và publish; lỗi reindex không làm mất index đang chạy.
- Offline không tạo evidence giả hoặc trình bày cache cũ như dữ liệu mới.
- UI status có chữ/icon, không chỉ màu; animation tôn trọng prefers-reduced-motion.

## Hướng đã cân nhắc
1. Giữ handler hiện tại và thêm status/UI: nhanh nhưng còn keyword routing, model call trùng và bypass evidence.
2. Gửi mọi câu hỏi qua một lần gọi LLM rồi dựa vào prompt: đơn giản nhưng không đủ an toàn cho dữ liệu live, hành động, citation và offline.
3. Khuyến nghị: một orchestrator/response contract; structured NLU; tách document retrieval khỏi DB/API vận hành; kiểm claim-evidence; availability mode tường minh. Di chuyển handler dần, gỡ sau parity tests.

## Lựa chọn triển khai
- Giữ React/Vite, FastAPI, SQLAlchemy/SQLite, provider abstraction và BM25/vector hiện có; chưa thêm model dependency đến khi có số đo.
- Local-only chỉ trả lời trong năng lực retrieval/generation local thực có. Không evidence thì abstain.
- Provider health check giới hạn tần suất, có last-checked time; API status không trả bí mật.
- Làm trên production checkout; không commit/push/deploy trong phạm vi này.

## Tiêu chí thành công
- Inventory mọi response path; mỗi path có evidence contract hoặc được xác định là giao tiếp/clarification/tác vụ vận hành.
- Tri thức và từ vựng lâm sàng là dữ liệu có nguồn, không còn hardcode nghiệp vụ ẩn.
- Không thể trả grounded nếu claim thiếu evidence hợp lệ.
- UI báo đúng backend/index/provider; glow chậm, accessible, giảm theo reduced-motion.
- Offline không giả evidence/freshness.
- PDF giữ provenance/version/preview/review/publish/rollback; lỗi ingest không gián đoạn index hoạt động.
- Chi phí giảm đo được mà không hạ retrieval/citation/abstention/safety.
- Có release gate và rollback trước deployment.
