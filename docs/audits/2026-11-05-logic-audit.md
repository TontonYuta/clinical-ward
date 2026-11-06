# Deep audit logic toàn repo — 05–06/11/2026

## Kết luận và phạm vi

Đã đối chiếu luồng UI → bộ chuyển đổi dữ liệu → API → database → phản hồi UI cho các nhóm tính năng bên dưới; thêm kiểm thử tái hiện và sửa các lỗi dữ liệu/an toàn đã xác nhận. Đây là kiểm toán phần mềm trong môi trường phát triển, không phải xác nhận đủ điều kiện vận hành bệnh viện hay chứng nhận tuân thủ pháp luật. Không thể chứng minh “không còn bất kỳ lỗi nào” bằng một đợt audit.

Danh mục máy đọc được: [54 thao tác router](2026-11-05-api-route-inventory.json), gồm **42 đang đăng ký, 12 đang tắt** trong `main.py`; chưa tính health, authentication và static PDF khai báo trực tiếp ở `main.py`. Không bật lại các phân hệ đã được ẩn trước đó.

Các bài kiểm thử dữ liệu dùng SQLite riêng, không chỉnh hồ sơ trong DB đang chạy. Kiểm thử thông báo dùng stub hoặc HTTP sink localhost; không gửi thông báo đến người thật. [Nhật ký kiểm chứng thủ công](2026-11-05-manual-feature-verification.md) phân biệt quan sát full-stack với kiểm thử mock. Giữ nguyên toàn bộ thay đổi UI đã được cho phép trước đợt audit này.

## Ma trận tính năng

| Nhóm | Điểm đã kiểm tra | Kết quả / phần còn giới hạn |
| --- | --- | --- |
| Tổng quan / điều hướng | Quyền xem tab, hành động nhanh, trạng thái modal và truy cập hồ sơ | Kiểm thử UI desktop/mobile; dữ liệu mẫu vẫn là chế độ trình diễn, không được coi là hoạt động bệnh viện thật. |
| Hồ sơ bệnh nhân | Tìm theo mã/tên; trùng tên; cập nhật hành chính; liên kết đơn thuốc | Sửa chọn nhầm do wildcard/tên một phần, mất dị ứng/eGFR khi bỏ trường, sai ID sau sửa tên. |
| Kê đơn CPOE | Nháp, quyền bác sĩ, ràng buộc loại/thời hạn, mã trùng, định danh, đường dùng/đơn vị, API adapter | Chỉ lưu nháp chưa ký; từ chối ID không tồn tại hoặc thông tin lệch; bảo toàn đường dùng/đơn vị/cân nặng/BHYT. Không có tích hợp ký số/phát hành thực. |
| Chi tiết đơn / dặn dò / MAR | Đúng người bệnh, dữ liệu khi mở lại, liều và đường dùng trên bản gửi/in | Bảo toàn chỉ định gốc; không tự tạo “1 viên sau ăn”. MAR là thao tác trong phiên trình diễn, chưa có sổ cấp thuốc bền vững. |
| Kho FEFO / dự trù | Số lượng, hết hạn, biệt trữ, đồng thời, tồn thực và cache | Sửa xuất âm, lô không khả dụng, mất cập nhật, tự tăng tồn khi dự trù; UI chờ API trước xác nhận. |
| Dây chuyền lạnh | Mất/khôi phục điện, cách ly, VVM/MKT, telemetry gần nhất, F5 | Sửa giải phóng trong sự cố; nối UI với API; kiểm tra xác nhận khớp dữ liệu. Mô hình nhiệt độ/VVM vẫn đơn giản, không chứng minh chất lượng từng vaccine. |
| Biểu mẫu hành chính | Đủ 8 loại, nguồn hồ sơ rõ ràng, bản in và mở lại | Đủ tám bản nháp giữ chi tiết nguồn và chỗ ghi nhận quan trọng; bỏ dữ kiện/kết quả/chữ ký tự bịa. Nguồn mô phỏng ghi rõ cả trên PDF. Chưa có workflow biểu mẫu được ký/phát hành thực. |
| SMS / Email | Cấu hình, sandbox, thất bại, lưu trước gửi, đúng người, lịch sử | Không báo đã giao khi thiếu provider/opaque response; phân biệt simulated/sent; ngăn gửi sau xung đột hồ sơ. Chưa kiểm thử delivery callback thực. |
| Xác nhận thao tác / phân quyền | Await async, hủy, người chứng kiến, vai trò đọc/ghi | Hủy không chạy timer còn treo; lỗi API giữ modal; RFID không bỏ xác nhận người thứ hai. Phiên đăng nhập thật dùng danh tính server và phương thức SESSION; PIN/RFID chỉ ở chế độ demo. Thao tác cần người thứ hai bị chặn nếu chưa tích hợp xác nhận độc lập. |
| Nhật ký kiểm toán | Chuỗi hash, cùng giây, đồng thời, metadata, gắn mutation/audit | UUID, thời gian chính xác, khóa append ở DB, hash metadata mới; tồn kho/giải phóng cách ly cùng transaction với audit. Không sửa lại lịch sử hỏng cũ. |
| Trợ lý / DDI / thẩm định | Severity, ngữ cảnh người bệnh, liều, hoạt chất và RAG | Sửa severity/safe synergy/polypharmacy, tính liều có điều kiện, sai chuyên luận và nhãn kiểm chứng quá mức. Có thêm chặn sai chủ đề/dạng bào chế và tra dị ứng đúng người; độ phủ nguồn/chất lượng dữ liệu vẫn còn giới hạn bên dưới. |
| Registry / tài liệu / MCP | Tìm thuốc, chuyên luận, stock join, API và tài liệu thiếu | Sửa ưu tiên chuyên luận liên kết chính xác. Chatstock yêu cầu đúng mã hàng/hàm lượng/dạng và loại lô bị giữ/hết hạn, giữ đơn vị riêng; đã khôi phục bảy PDF với provenance/hash. Không xác nhận toàn bộ đường MCP hoặc corpus đã đúng. |
| Nợ tủ trực / thiết bị / tài sản | Router, schema, chuyển trạng thái, quyền | Đã đọc và ghi lỗi; 12 API đang tắt nên không coi là luồng đang hoạt động. Sửa chính sách thanh lý chỉ giám đốc, không mở lại API. |

## Các lỗi đã sửa có bằng chứng tái hiện

P1 = có thể sai người bệnh, dữ liệu, quyền hoặc xác nhận an toàn; P2 = độ chính xác/trạng thái thao tác. Số dòng trong các báo cáo nhánh phản ánh thời điểm phát hiện; tên hàm và ca kiểm thử là mốc ổn định hơn sau sửa.

| ID | Mức | Trước sửa và nguyên nhân | Sau sửa / bằng chứng |
| --- | --- | --- | --- |
| INV-01 | P1 | `quantity:-4` xuất từ tồn 10 thành 14; chấp nhận 0/bool/string | Schema strict positive integer; `test_inventory_coldchain_invariants.py`. |
| INV-02 | P1 | Xuất được lô năm 2000 hoặc đang biệt trữ | Kiểm tra hạn thực/cách ly trước và trong SQL update. |
| INV-03 | P1 | Hai phiên cùng xem tồn 10 và xuất 7; tồn chỉ bị trừ một lần | Conditional decrement nguyên tử; phiên thứ hai bị từ chối, tồn còn 3. |
| INV-04 | P1 | Lập dự trù tự đưa tồn về max, kể cả làm giảm tồn vượt max | Chỉ ghi nhu cầu và audit; API/UI không thay đổi tồn vật lý. |
| INV-05 | P2 | days_left/cờ cận hạn lưu cứng trôi ngày | Tính lại theo ngày và tồn hiện tại khi trả dữ liệu. |
| INV-06 | P1 | API trả [] bị bỏ qua hoặc trộn lô mẫu, xuất kho UI không ghi DB | Tin danh sách máy chủ, chờ kết quả dispatch rồi cập nhật/cache. |
| CC-01 | P1 | Đang mất điện 11°C, VVM4/MKT99 vẫn giải phóng cách ly | Ràng buộc trạng thái và xác nhận số đo khớp; update kiểm tra lại khi ghi. |
| CC-02 | P2 | MKT lấy 20 mẫu cũ, không tính lại sau phục hồi; audit ghi cứng 1.250 liều | Lấy 20 mẫu mới nhất, tính mỗi mẫu một lần; số liều thực trong audit. |
| CC-03 | P1 | UI tự đổi trạng thái lạnh, F5 trở lại dữ liệu khác API | Tải trạng thái và thực thi mô phỏng/khôi phục/giải phóng qua API. |
| PAT-01 | P1 | `%`/tên một phần mở người đầu tiên; hai tên trùng không yêu cầu lựa chọn | Mã chính xác; tên chính xác duy nhất; mơ hồ trả 409. |
| PAT-02 | P1 | POST cập nhật hành chính thiếu trường ghi đè dị ứng thành “không ghi nhận”, eGFR thành90 | `exclude_unset=True` giữ lịch sử an toàn; kiểm thử cập nhật nhân khẩu học. |
| RX-01 | P1 | Sửa tên vẫn giữ ID/CCCD/DOB người trước; đóng mở giữ form cũ | Xóa các trường liên kết khi sửa tên; khởi tạo lại khi mở. |
| RX-02 | P1 | API lưu được ID người A với tên/CCCD người B | Kiểm tra hồ sơ khi có ID; nháp không ID là nháp chưa liên kết. |
| RX-03 | P2 | Loại đơn tùy ý và thời hạn âm vượt qua validator; mã trùng gây500 | Enum và giới hạn không âm/positive; xung đột mã trả409. Không tự điền30 ngày. |
| RX-04 | P1 | Callback trợ lý bỏ quyền, chữ ký lấy từ payload, báo thành công dù API từ chối | Chỉ bác sĩ; validation; ép nháp chưa ký; await API trước event/success. |
| RX-05 | P1 | Chuẩn hóa đường uống/khí dung thành IV; Gói/Bơm tiêm thành Ống | Giữ nguyên đường dùng/đơn vị thực; lựa chọn hiển thị được giá trị từ danh mục. |
| RX-06 | P2 | API adapter làm mất cân nặng/BHYT | Gửi xuyên suốt các trường được backend hỗ trợ. |
| RX-07 | P1 | Mở dặn dò không chỉ định đơn tự lấy đơn mẫu đầu tiên | Bắt buộc chọn đúng đơn đã tồn tại; không fallback. |
| RX-08 | P1 | Danh sách đơn bỏ qua[] và giữ đơn mẫu/đơn đã bị xóa | Danh sách máy chủ là nguồn chính thức kể cả[]; bỏ merge đơn local. |
| PAT-03 | P1 | Modal hồ sơ gộp đơn hai người trùng tên và không cập nhật lúc mở lại | Ưu tiên ID, tên chỉ fallback với đơn chưa liên kết và tên duy nhất; làm mới theo phiên mở/event. |
| MSG-01 | P1 | Thiếu eSMS hoặc provider chưa tích hợp vẫn trảdelivered; sandbox giả giao thật | 503/501; sandbox simulated; provider tiếp nhận làsent, dùng HTTPS. |
| MSG-02 | P1 | Backend thất bại nhưng fallbackno-cors opaque vẫn báo email gửi xong | Chỉ nhận phản hồi xác nhận được; không phát thêm request fallback không kiểm chứng. |
| MSG-03 | P1 | Dặn dò thiếu ID mặc địnhBN-8820; cùng mã đổi sang người khác làm lệch lịch sử | Bắt buộc ID; chặn tái gán; caller truyền ID cụ thể. |
| MSG-04 | P2 | Sửa dặn dò bỏ qua start/end/department/prescriptionId nhưng trả payload mới | Lưu đồng bộ các trường được cập nhật. |
| MSG-05 | P1 | Lưu bị409 nhưng gửi vẫn chạy; endpoint gửi chưa kiểm tra chủ sở hữu | Await lưu thành công; kiểm tra ID bệnh nhân trước provider; regression xác nhận provider không được gọi. |
| MSG-06 | P1 | Tự tạo1 viên sau ăn/2 lần/ngày khi tần suất không đủ dữ kiện | Không suy đoán giờ/liều; bản gửi/in vẫn có liều, đường, tần suất, thời hạn và lời dặn gốc; hiện “Chưa cấu hình giờ dùng”. |
| MSG-07 | P1 | []/401/403 có thể hiện lại cache dặn dò người cũ | [] là kết quả chính thức; không dùng cache khi bị từ chối quyền. |
| MSG-08 | P1 | Tên/lời dặn chèn trực tiếp vào HTML preview/print qua `dangerouslySetInnerHTML` | Escape toàn bộ trường văn bản; regression `<img onerror>`/script. |
| AUTH-01 | P1 | Modal đóng/phát thành công trước async callback; hủy rồi timer vẫn chạy | Await và giữ lỗi; cleanup timer theo phiên request. |
| AUTH-02 | P1 | RFID bỏ qua PIN/người chứng kiến độc lập và danh sách vai trò yêu cầu | Dùng cùng kiểm tra người chứng kiến cho hai phương thức. |
| AUTH-03 | P1 | Kỹ sư được đọc đơn/SMS bệnh nhân và phê duyệt thanh lý qua prefix chung | Giới hạn đọc dữ liệu lâm sàng; endpoint thanh lý chỉdirector khi AUTH_REQUIRED bật. |
| AUD-01 | P1 | Cùng giây chọn sai bản ghi cuối; count-basedID trùng; không hash tên hành động | UUID, microseconds/thứ tự ổn định; hash metadata phiên bản2, vẫn đọc bản cũ. |
| AUD-02 | P1 | Các request đồng thời chọn cùng previous_hash gây nhánh | Bảng khóa singleton ở DB trước SELECT → insert → commit; kiểm thử6 session SQLite đồng thời. |
| AUD-03 | P1 | Commit xuất kho/giải phóng trước audit; audit lỗi nhưng thao tác đã lưu | Cùng commit cho mutation và audit ở hai luồng này. |
| AI-01 | P1 | CONTRAINDICATED bị hạmajor do khác hoa thường; SAFE_SYNERGY thành nguy hiểm; thiếu polypharmacy | Giữ severity, bỏ cảnh báo nguy hiểm cho safe synergy, truyền ngữ cảnh và cảnh báo cộng dồn. |
| AI-02 | P1 | Tính liều bỏ số viên, nhiều dòng cùng hoạt chất; trẻ em dùng ngưỡng người lớn; eGFR0 bị bỏ | Chỉ tính dữ liệu tường minh, tổng hợp Paracetamol, không xác nhận liều chưa kiểm chứng; giữ0 là giá trị. |
| AI-03 | P1 | Insulin liên kết đúng nhưng lấy chuyên luận Insulin glargine vì dài hơn | Ưu tiên chuyên luận liên kết; fallback chỉ khớp chính xác không mơ hồ. |
| AI-04 | P1 | “không chống chỉ định” đối với nguồn “chống chỉ định” vẫn đượcPASS1.0 và100%verified | Phát hiện đảo phủ định tường minh trong câu tương ứng; nhãn nêu đối chiếu heuristic, không xác thực y khoa. Chưa phải bộ hiểu ngữ nghĩa đầy đủ. |
| INV-07 | P1 | Tồn kho lạnh xuất được khi tủ liên kết đang biệt trữ, hoặc chưa có ánh xạ lô–tủ | Chính sách chung đọc cấu hình ánh xạ tường minh, chặn thiếu/không hợp lệ và kiểm tra trạng thái trong lệnh ghi. UI/assistant cùng dùng cờ khả dụng. |
| INV-08 | P2 | Nút xuất/dự trù bị mất sau giản lược UI; từng xuất mặc định10 | Khôi phục điều khiển theo vai trò; nhập số nguyên dương/tồn, xác nhận riêng, không báo thành công trước ACK. Quan sát thực8→5, tải lại vẫn5. |
| CC-04 | P1 | Không có bản ghi vẫn trả tủ bình thường và lịch sử mẫu; khôi phục lặp làm trôi MKT | Không bịa trạng thái khi thiếu/mơ hồ; ràng buộc chuyển trạng thái, giữ lịch sử sự cố và VVM. |
| CC-05 | P2 | Telemetry ghi “mới nhất” nhưng lấy mẫu đầu; màn nhỏ vẫn bảng rộng | Lấy mẫu cuối, độẩm chưa có để chưa biết; thẻ lô trên mobile, lô hết hạn đỏ và thông tin giữ xuất rõ. |
| RX-09 | P1 | `clinicalNotes` có trênUI nhưng API/DB làm mất sau lưu | Cột/schema/adapter xuyên suốt; lưu thực, SQLite, reload, PDF và thông báo giữ marker ghi chú. |
| RX-10 | P1 | Bản in bịa cơ sở/địa chỉ/đường dùng/chữ ký/ngày, nội trú gắn ngoại trú | Bản in dựa dữ liệu gốc; trường thiếu ghi rõ; TT26 ngày30/06/2025; tháng tuổi và số lượng thuốc gây nghiện bằng số/chữ; không xác thực chữ ký caller. |
| RX-11 | P1 | Tab Paracetamol chèn hướng dẫn Opioid/Naloxon/testda không liên quan | Bỏ khối cứng không có nguồn cho đơn; tách Hoạt chất/Liều kê, giữ nguyên chỉ định thực. |
| AUTH-04 | P1 | AuthGate chưa bọc app, không biết trạng thái vẫn vào demo; danh tính demo trộn phiên thật | Bật kiểm tra server, lỗi thì đóng dữ liệu và cho thử lại; role hợp lệ, cache xóa khi đổi phiên, tên tài khoản thật. Kiểm tra năm vai trò qua HTTP thật. |
| AUTH-05 | P1 | App/auditor nói chữ ký hoặc hash đã kiểm chứng từ dữ liệu client | Bỏ nhãn xác minh, auditlocal chỉ mô phỏng; backend ghi tài khoản thực, phương thức phiên; dual witness chưa tích hợp thì chặn UI. |
| MSG-09 | P1 | Email thành công, SMS lỗi; retry gửi lại email | Outbox/fingerprint riêng từng kênh, claim trước side effect, commit từng kết quả; kết quả chưa rõ không tự retry. HTTP sink quan sát một email qua hai lần gửi. |
| MSG-10 | P1 | Mẫu SMS/email tự chèn bệnh viện/bác sĩ, ký số/quốc gia, giờ/liều/việnphí không có | Sinh từ hồ sơ thực, trạng thái nháp/mã nội bộ, không tự công bố phát hành; brand phải cấu hình. Dữ liệu null từ API không làm lỗi trim. |
| MSG-11 | P1 | SMTP/GAS/preview bỏ đường dùng/tần suất/ghi chú; scriptGAS thừa dấu ngoặc và không escapeHTML | Giữ toàn bộ chỉ định và `clinicalNotes`/`slot.note`; escapeHTML; kiểm thử SMTPfake/GASVM và UI/API thật qua sink. |
| FORM-01 | P1 | Tám mẫu điền sẵn tổ chức, quyết định, kết quả đạt, phép đo, đã cấp/ký chưa xảy ra | In bản nháp đúng nguồn, để chờ ghi phần chưa xác nhận; không bỏ danh sách để ép một trang. Xem đủ tám PDF, kiểm tra sourcepicker, keyboard/mobile/landscape. |
| AI-05 | P1 | Triệu chứng hoặc tên Trần thành Clioquinol/Trimethoprim/Nhântrần/Caolá | Tách chủ thể trước truy hồi, không dùng ADRthuốc không được hỏi để chẩn đoán; xóa thuốc cũ khi đổi ca. Thiếu nguồn thì hỏi thêm. |
| AI-06 | P1 | Câu hỏi bệnh chung chọn một thuốc IV; Oresol lấy liều glucose IV; link trống lấy nhầm nguồn | Yêu cầu hướng dẫn khớp chủ đề/nhóm người bệnh; không dùng liều thành phần làm liều chế phẩm; fallback duy nhất đúngINN và cùng đoạn dạng/hàm lượng, không ghép chéo. |
| AI-08 | P1 | Nguồn Efferalgan có dữ liệu nhưng trộn liều uống/đặt/IV, được gắn exactmatch cho chế phẩm | Chặn cả nguồn liên kết không rỗng khi dạng/đường dùng chưa khớp; từ chối có giải thích, không đưa liều chéo dạng. HTTP thật xác nhận trạng thái chưa xác minh chế phẩm; tra hoạt chất chung vẫn giữ. |
| AI-07 | P1 | Câu hỏi dị ứng người bệnh đi tìm thuốc “Võ Minh” hoặc ghép tên gần đúng | ID/tên đầy đủ chính xác duy nhất; chỉ báo dị ứng đã lưu và nêu audit chưa hoàn chỉnh, không bịa thuốc thay thế. |
| REG-02 | P2 | ScriptKB lỗi query/mấtCLI nhưng báo qua; thiếu PDF và ngưỡng dung lượng scan sai | Truy vấn readonly bằng Pythonstdlib và fail khi lỗi; kiểm tra PDF byte/hash/provenance, giữ phiên bản lịch sử rõ. Validation chuyên luận vẫn thất bại và được ghi bên dưới. |
| REG-01 | P1 | Seed registry bỏ đường dẫn file mới ngoài/tmp, âm thầm ghi sangDATABASE_URL | Đường dẫn được truyền rõ luôn có ưu tiên; regression path không tồn tại đi từfail sangpass. |

Ca kiểm thử chính: `backend/tests/test_inventory_coldchain_invariants.py`, `test_logic_audit_identity_notifications.py`, `test_cpoe_identity_invariants.py`, `test_audit_safety_regressions.py`; `tests/test_frontend_mutation_regressions.mjs`, `test_clinical_auth_logic.mjs`, `prescription_advice_delivery.test.ts`, `test_prescription_html_safety.ts`.

## Các vấn đề còn mở / không được đánh dấu đã sửa

| Mức | Vấn đề còn giới hạn | Hướng xử lý / trạng thái |
| --- | --- | --- |
| P1 / dữ liệu | Kiểm tra nguồn chuyên luận chưa đạt:769 lỗi metadata trang/bổ sung và53 INN trùng; một số nguồn hiện đại chưa chứng minh provenance đầy đủ | [Báo cáo nguồn](2026-11-05-source-asset-verification.md). Không bịa trang/nguồn hoặc sửa assertion để xanh. Cần rà từng bản trích với tài liệu gốc trước dùng lâm sàng. |
| P1 / workflow | Xác nhận số đo VVM/MKT và tên chứng kiến ở API không thay thế hai tài khoản được xác thực độc lập hoặc đánh giá ổn định từng vaccine | UI thật chặn yêu cầu hai người khi chưa tích hợp. Cần workflow server, hồ sơ từng lô và chữ ký phù hợp. |
| P2 / độ phủ | Corpus chưa đủ hướng dẫn cho nhiều ca bệnh/triệu chứng; yêu cầu được hỗ trợ có thể phải hỏi lại hoặc từ chối | Chặn suy diễn sai chủ đề/dạng bào chế là bản sửa an toàn, không có nghĩa đã cung cấp phác đồ đầy đủ. Những assertion về intent/heading/protocol cũ chưa đồng bộ vẫn được giữ và công bố kết quả. |
| P2 / phân hệ tắt | Nợ tủ trực/thiết bị/tài sản:12 APIđang tắt còn số lượng âm, IDdựa rowcount, chuyển trạng thái lặp và transactionaudit cũ | Không mở lại. Dữ liệu trong biểu mẫu được ghi là mô phỏng; cần sửa/test workflow bền vững trước kích hoạt. |
| P1 / dữ liệu mẫu | Một số hồ sơ/vitals/default và cache/offline vẫn có nguồn mẫu; MAR chưa có sổ cấp thuốc bền vững; chưa rà từng đường MCP | Không coi dữ liệu mặc định là số đo thật; tách dữ liệu mẫu và phân quyền dữ liệu theo người dùng trước môi trường thực. |
| P2 / đồng thời SQLite | Lượt full dưới tải có một lỗi `database is locked` ở test sáu phiên append audit; chạy lại riêng qua nhưng không được xóa kết quả thất bại full | Khóa bảo vệ chuỗi không bảo đảm mọi request được nhận dưới contention. Cần chính sách busy timeout/retry toàn transaction và thử tải nhiều tiến trình; không retry riêng audit sau khi rollback mất mutation. |
| P2 / mô hình lạnh | MKT trọng số mẫu bằng nhau, thiếu timestamp phơi nhiễm đầy đủ; VVMchưa theo từng sản phẩm/lô | Chưa chứng minh chất lượng vaccine hay xác minh cảm biến. Cần sensor/timeweighting/validation nghiệp vụ. |
| P2 / thông báo | Chưa có deliverycallback, đối soát kết quả chưa rõ và vận hành outbox bởi người phụ trách; GASchưa có kiểm chứng triển khai thực | Sentlàprovider tiếp nhận, không phải đã tới hộp thư/thiết bị. Sink/VM không chứng minh deliverythực. |
| P2 / pháp lý | Metadata/nhãn cũ và dữ liệu seed còn viện dẫn văn bản lịch sử; healthresponse liệt kê “legal_compliance” không phải chứng nhận | Bản in đã bỏ khẳng định tự điền. Rà soát áp dụng văn bản hiện hành và phê duyệt nghiệp vụ riêng. |
| Triển khai | AUTH_REQUIRED mặc địnhfalse, PIN/RFID/đổi vai trò chỉ demo; chưa kiểm chứng PostgreSQL/cảm biến/chữ ký/LAN từ máy khác | RBACserver chỉ thực thi khi bật xác thực. Server phát triển đã bind0.0.0.0; chưa đủ căn cứ gọi là productionready. |

Xem chi tiết nguồn/cách tái hiện và giới hạn từng nhánh:

- [Backend](2026-11-05-backend-logic-findings.md).
- [Frontend](2026-11-05-frontend-logic-findings.md).
- [Trợ lý / RAG / thẩm định](2026-11-05-assistant-logic-findings.md).
- [Audit UI và căn cứ pháp lý trước đó](2026-11-05-ui-structure-review.md).

## Kiểm chứng

Baseline backend: **318 passed, 20 failed** trong338 ca; danh sách thất bại gốc lưu ở phần tiếp theo. Baseline frontend: chatbot69 ca và các nhóm model/DDI chạy qua, dừng tại PDF thiếu; ca voice chạy riêng. Không thay đổi assertion để biến lỗi routing thành thành công.

Một lần chạy full sau sửa trên `/tmp` bị lỗi diskI/O do tmpfs1.7 GB đầy bởi DB/WAL của kiểm thử. Lần đó không dùng để đánh giá chất lượng bản sửa; đã chuyển DB và thư mục pytest sang ổ đĩa `artifacts/logic-audit/` rồi chạy lại.

Kết quả cuối ở phần cập nhật bên dưới; các lượt chạy bị ngắt vì thay đổi nguồn giữa chừng không dùng làm kết luận cuối. Log và DB thử nghiệm nằm trong `artifacts/logic-audit/` (gitignored); không đưa DB hay thông tin cấu hình bí mật lên Git.

## Danh sách thất bại backend trước sửa

```text
FAILED tests/test_backend_security_guardrails.py::test_coldchain_telemetry_vs_emergency_intent
FAILED tests/test_backend_security_guardrails.py::test_out_of_database_knowledge_boundary
FAILED tests/test_backend_security_guardrails.py::test_chatbot_provenance_metadata_contract
FAILED tests/test_backend_security_guardrails.py::test_self_symptom_prompt_without_case_context_asks_for_clinical_case
FAILED tests/test_backend_security_guardrails.py::test_patient_fever_query_is_framed_as_clinician_reference
FAILED tests/test_chatbot_evaluation.py::test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only
FAILED tests/test_clinical_enrichment.py::test_clinical_drug_enrichment_and_empty_handling
FAILED tests/test_duty_cycle_3_cases.py::test_gerd_reflux_management - Assert...
FAILED tests/test_duty_cycle_4_production_fixes.py::test_oresol_hydration_guidance_not_anaphylaxis
FAILED tests/test_duty_cycle_5_production_fixes.py::test_hypertension_in_ckd_guidance_not_morphine_or_ceftriaxone
FAILED tests/test_duty_cycle_5_production_fixes.py::test_hypertension_in_pregnancy_guidance_not_tetanus_serum
FAILED tests/test_duty_cycle_5_production_fixes.py::test_general_hypertension_choice_guidance
FAILED tests/test_duty_cycle_6_production_fixes.py::test_fever_with_nausea_symptom_inquiry_protocol
FAILED tests/test_duty_cycle_6_production_fixes.py::test_personal_fever_inquiry_has_helpful_chips
FAILED tests/test_prescription_advice.py::test_copilot_clinical_scenarios - A...
FAILED tests/test_production_mined_cases.py::test_mined_production_query[\u0111 au b\u1 ee5 ng, \u0111 i ngo\xe0 i, m\u1 ea5 t n\u01 b0\u1 edbc l\xe0 bi\u1 ec3 u hi\u1 ec7 n c\u1 ee7 a g\xec-CLINICAL_AI_CONSULTATION-expected_snippets14]
FAILED tests/test_production_mined_cases.py::test_mined_production_query[tri\u1 ec7 u ch\u1 ee9 ng \u0111 au b\u1 ee5 ng, bu\u1 ed3 n n\xf4 n, s\u1 ed1 t cao l\xe0 bi\u1 ec3 u hi\u1 ec7 n c\u1 ee7 a g\xec-CLINICAL_AI_CONSULTATION-expected_snippets19]
FAILED tests/test_production_mined_cases.py::test_mined_production_query[Bi\u1 ec3 u hi\u1 ec7 n bu\u1 ed3 n n\xf4 n, s\u1 ed1 t cao th\xec n\xean s\u1 eed d\u1 ee5 ng thu\u1 ed1 c n\xe0 o-CLINICAL_AI_CONSULTATION-expected_snippets33]
FAILED tests/test_production_mined_cases.py::test_clinical_rag_gatekeeper_blocks_unqualified_queries
FAILED tests/test_suggested_chips_integrity.py::test_all_suggested_chips_are_accurately_answered[Ki\u1 ec3 m tra kho l\u1 ea1 nh GSP]
```

## Kết quả kiểm chứng chốt — 06/11/2026

| Lệnh / phạm vi | Kết quả quan sát | Giới hạn |
| --- | --- | --- |
| `npm test` | PASS, gồm chatbot69 ca, KBreadonly, model/DDI, registry, bảy PDF và voiceUI | Không phải kiểm định nội dung y khoa hoặc toàn corpus |
| `npm run lint` / `npm run build` | PASS; bundle chính765.03 kB, gzip199.97 kB | Buildfrontend không chứng minh nghiệp vụ backend |
| `npm run test:workspace` / `test:logic` | PASS; auth, mutation, advice, print, FEFO, nguồn dữ liệu, notification/GAS | Ca dùng mock được tách khỏi quan sát APIthật |
| `npm run test:ui` / `test:ui-structure` | PASS trên bản frontend cuối; sáu kích thước màn hình, dialog/mobile, sourcepicker, tám bản nháp, bàn phím/landscape | Không bao phủ mọi tổ hợp dữ liệu/thiết bị |
| `audit:ui-headers -- --label current --check` | 111 tệpTSX,62 reachable,171 headingnodes,90 trạng thái ở 1440/375; **0 ứng viên lặp, 0 lỗi thu thập** | Heuristic có ngoại lệ cho nhận diện, điều hướng và bản in; không chứng minh mọi trạng thái động |
| Toàn bộ backend trước bản sửa context cuối | **479 passed / 30 failed / 509 ca**,421.08 giây | Giữ nguyên toàn bộ30 thấtbại, không gắn nhãn toàn bộ đều lỗi cũ/khác câu chữ |
| Delta backend sau sửa context cuối | **59 passed** trênsnapshot DB riêng, gồm ca FSM gốc và các kiểm tra subject/stock/grounding/relevance | Không chạy lại toàn bộ 509 ca sau bản sửa hẹp này; không tuyên bố mọi followup/profile cũ đã qua |
| Registryfixture theo ngày hiện tại | **4 passed**; lô kiểm tra revision còn hạn, test chặn hết hạn riêng giữ nguyên | Thay fixture hết hạn cố định không làm nới luật xuất kho |
| `validate:sources` | **FAIL822 mục**:769 trang/bổ sung +53 INN trùng;0 lỗi PDF | Đây là vấn đề nguồn/dữ liệu còn mở, không được che bằng npmtestPASS |
| PDF qua HTTP / Git blob | Bảy file UI`/pdf/` và API`/api/v1/pdf/` trả200/PDF/đúngbyte; bảy Git blobgiữSHA256 đúngmanifest | Nguồn DTQGcó sẵn chưa biết URLtải gốc; không xác minh chữ kýPDF hay hiệu lực mọi văn bản |
| Quan sát thực | CPOEnháp→DB→reload→PDF; kho8→5; hủy không ghi; phục hồi lạnh vẫn biệt trữ; ma trận vai trò5 vai; notifyHTTPsinkmột lần; đăng xuất ẩn cache; tám PDF đã xem | Provider/cảm biến/chữký/LANngoàimáy chưa được xác minh |
| Review / Git | Review độc lập và regressiondelta cho từng lỗi quan trọng đã xác nhận; `git diff --check` qua; không có DB/env/token trong file chuẩn bị commit | Branch là bản sửa và bằng chứng audit, không phải chứng nhận sẵn sàng vận hành y tế |

[Phân loại ca thất bại](2026-11-05-backend-failure-classification.md) giữ tên từng test; [review relevance cuối](2026-11-06-relevance-review.md) phân biệt mất độ phủ chức năng, hợp đồng kết quả và lỗi context đã sửa. Chặn nguồn không đúng chế phẩm làm nhiều câu hỏi biệt dược chuyển sang yêu cầu làm rõ. Đây là **giảm độ phủ có thật**, không được gọi là giữ nguyên mọi tính năng; cả câu hỏi hoạt chất như “Metformin dùng cho bệnh gì?” vẫn có ca cần rà soát identity/source. Không nới kiểm tra hoặc bịa nội dung để khôi phục profile chưa có nguồn phù hợp.

Các lượt full cũ bị ngắt khi nguồn còn thay đổi hoặc tmpfs đầy không được dùng làm kết quả cuối. Các log được nêu ở trên lưu trong `artifacts/logic-audit/` và không được đưa lênGit. Server người dùng được giữ riêng ở3000/8000; mọi thao tác ghi khi kiểm chứng dùng DB riêng.
