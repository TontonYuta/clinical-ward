# Chatbot Grounded Orchestration Design

## Intent
Nâng chatbot trợ lý lâm sàng thành một luồng trả lời có nguồn kiểm chứng, giữ tác vụ vận hành deterministic và không biến việc không tìm thấy dữ liệu thành kết luận an toàn.

## Goals
- Tra cứu thuốc trả về trạng thái nguồn rõ ràng: DAV chính xác, chuyên luận Dược thư, gợi ý tồn kho gần đúng, hoặc từ chối an toàn.
- DDI luôn ưu tiên API backend QĐ 5948 và phân biệt có tương tác, chưa có trong chỉ mục, lỗi nguồn.
- Câu hỏi lâm sàng có trích dẫn và metadata có cấu trúc để UI hiển thị nhất quán.
- Giữ action card nghiệp vụ tại local/backend deterministic.
- Bảo toàn ngữ cảnh thuốc trong câu hỏi tiếp nối cùng session.

## Non-goals
- Không tuyên bố bao phủ toàn bộ mọi tương tác thuốc.
- Không tự động đưa ra chẩn đoán hoặc thay thế quyết định của bác sĩ/dược sĩ.
- Không thay đổi dữ liệu nguồn PDF/DAV trong phạm vi chatbot này.

## Constraints
- Giữ FastAPI + SQLAlchemy ở backend và React/Vite ở frontend.
- Không thêm dịch vụ AI bắt buộc; Gemini chỉ là fallback sau nguồn nội bộ.
- Mọi đầu ra đi qua guardrail hiện có.
- DDI không tìm thấy phải ghi rõ “chưa được lập chỉ mục”, không dùng “an toàn”.

## Architecture
1. Frontend guardrail và local intent xử lý nghiệp vụ có action card.
2. Backend /copilot/chat xử lý tra cứu thuốc, DDI, RAG và session context.
3. Gemini chỉ chạy khi backend không trả lời được câu hỏi tự do.
4. CopilotResponse bổ sung metadata nguồn/trạng thái nhưng giữ tương thích các trường hiện có.

## Acceptance criteria
- Tra cứu chính xác có citation nguồn và trạng thái exact_match.
- Thuốc không tồn tại trả safe_abstention và không sinh liều/chỉ định.
- Gợi ý gần đúng ghi rõ là gợi ý tồn kho, không phải kết quả DAV.
- DDI Bảng 3.1/3.2 hiển thị nguồn; không tìm thấy hiển thị giới hạn bao phủ.
- Câu hỏi “thuốc này/thuốc đó” dùng đúng active medication của session.
- Test backend, frontend, lint, build và kiểm tra nguồn đều đạt.
