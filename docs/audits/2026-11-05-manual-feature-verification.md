# Kiểm chứng từng phân hệ qua giao diện và dữ liệu thật — 05/11/2026

Theo yêu cầu của người dùng, kiểm tra từng bước có quan sát, đối chiếu dữ liệu lưu và bản in; không đánh dấu đạt chỉ từ việc đọc mã hoặc chạy mock.

## Môi trường và cách kiểm tra

- Server người dùng: UI3000/API8000, bind0.0.0.0. API được khởi động lại không dùng autoreload để giữ ổn định trong lúc sửa mã.
- Bản kiểm chứng riêng: Chromium → Vite3001 → FastAPI8001 → SQLite snapshot riêng. Snapshot tạo bằng SQLite backup từ DB đang chạy; thay liên hệ bằng `example.invalid` và số thử nghiệm. Không ghi thao tác thử vào DB phục vụ người dùng.
- Trình duyệt không giả lập API ứng dụng; chặn request ra ngoài localhost. Provider thực bị vô hiệu hóa. HTTP sink ởlocalhost8089 trả acknowledgment để quan sát payload và số lần gửi; không chứng minh thư đến hộp thư thật.
- Kiểm tra thủ công ở đây là điều khiển từng thao tác trình duyệt, đọc nội dung và xem ảnh/PDF bằng mắt; các test chạy tự động với intercepted API được ghi riêng trong báo cáo tổng.
- Vite3001 tắt HMR để không đóng form khi mã thay đổi. Sau mỗi đợt sửa phải khởi động lại Vite này; chỉ reload trình duyệt chưa đủ làm mới module khi file watcher đã tắt.
- Ảnh, PDF, phản hồi HTTP, nhật ký sink và DB thử nằm trong `artifacts/logic-audit/manual/` (gitignored). Không đưa DB/tài khoản cấu hình lên Git.

## Các tình huống đã quan sát

| Mã | Thao tác thực tế | Kết quả và đối chiếu | Bằng chứng |
| --- | --- | --- | --- |
| MAN-OV-01 | Mở tổng quan bằng phiên mới | Một h1, số lô cận hạn/tồn thấp, nhãn chế độ mô phỏng rõ; API đọc200 | `01-overview-initial.png` đã xem |
| MAN-RX-01 | Chọn BN8820 từAPI; kê Paracetamol500 mg,1 viên(500 mg),ngày2 lần,Uống,6 Viên,3 ngày; nhập ghi chú riêng | POST201; danh sách12→13; statusdraft. SQLite giữ đúng ID/tên/liều/đường/đơn vị/thời hạn/clinical_notes | `05-cpoe-filled-draft.png`; đơn `790013007271-C` chỉ trong DB thử |
| MAN-RX-02 | Tải lại, mở chính đơn vừa lưu, xuất PDF | Không mất ghi chú hoặc thay người bệnh. PDF một trang A4 chứa dữ liệu đã nhập, không tự điền cơ sở/địa chỉ/chữ ký | `06-cpoe-detail-after-reload.png`, `07-prescription-after-reload.pdf`, ảnh render đã xem |
| MAN-RX-03 | Đọc toàn bộ tab thuốc Paracetamol | Phát hiện khối Opioid/Naloxon/testda không liên quan; bỏ khối cứng và kiểm tra lại UI sau làm mới: không còn. Phát hiện nhãn hàm lượng dùng nhầm trường liều; tách thành Hoạt chất/Liều kê, regression fail→pass | `08-medication-instructions-after-reload.png` lưu trạng thái lỗi ban đầu; `detail-dose-red/green.log` |
| MAN-AUTH-01 | Bật AUTH_REQUIRED, mở UI khi đã có cache13 đơn | Chỉ có màn đăng nhập, không lộ cache lâm sàng; mật khẩu sai401, đúng200 | `09-auth-required-login.png`, `10-authenticated-pharmacist.png` |
| MAN-AUTH-02 | Đăng nhập dược sĩ và mở xác nhận thao tác | Hiện đúng `manual-pharmacist`, không giả chứng chỉ/PIN/RFID. Quyền kê đơn mới không xuất hiện. Phương thức audit thực là AUTHENTICATED_SESSION | UI và bản ghi SQLite sau xuất kho |
| MAN-CC-01 | Mở chuỗi lạnh có ánh xạ b-8→tủ1 | Chỉ một lô Vaxigrip thực từAPI, tồn200 Ống; không coi tổng1250 trên tủ là tồn lô; độẩm/VVMtừnglô chưa có được ghi rõ | `11-coldchain-mapped-inventory.png` |
| MAN-CC-02 | Mô phỏng mất điện quaUI | POST200, nhiệt độ11°C, biệt trữ; inventoryAPI bị giữ xuất. FEFO ban đầu không nổi bật lệnh giữ: đã sửa cột/cẻ thẻ trạng thái và nút xuất bị vô hiệu | `12-coldchain-outage-hold.png`, `13-pharmacy-live-cold-hold.png` phản ánh trước sửa |
| MAN-CC-03 | Mở khôi phục rồi Hủy; mở lại và xác nhận | Hủy không POST. Xác nhận POST200, nhiệt độ4.5°C, vẫn biệt trữ, stock200; telemetry hiển thị mẫu mới nhất16:05 thay vì mẫu cũ | `14-cold-restore-authenticated.png` |
| MAN-CC-04 | Mở xét giải phóng bằng tài khoản thật | Nêu rõ cần người chứng kiến độc lập; nút xác nhận bị chặn do chưa tích hợp xác nhận người thứ hai trên server. Không giả chữ ký | `15-release-needs-independent-witness.png` |
| MAN-INV-01 | Mở xuất lô thử MAN-RBAC-LOT: để trống, nhập9 khi tồn8, nhập3 rồi hủy | Có lỗi số lượng; không gửi lệnh khi chưa xác nhận; Hủy không làm thay đổi tồn | API events không có POST ở các bước này |
| MAN-INV-02 | Xuất3, xác nhận bằng tài khoản thật, tải lại | POST200; tồn8→5 và tải lại vẫn5; audit đúng username, lô, số lượng3 và tồn5 | `16-dispatch-stock-8-to-5.png`; SQLite audit_records |
| MAN-INV-03 | Dự trù5 mặt hàng tồn thấp và xác nhận | POSTrestock-proposal200; tồn thực không tăng. Gợi ý920/455/365/270/440 không bị coi là thực cấp | Phiếu xem trước và SQLite tồn sau thao tác |
| MAN-FORM-01 | Lần lượt chọn đủ8 loại, chọn nguồn khi bắt buộc, đọc và xuấtPDF | Nội dung chi tiết trong bảng dưới. Không tự chọn người/thiết bị đầu tiên khi nguồn chưa chọn; nút in bị chặn | `17-forms-restock-workspace.png`, `18-forms-shift-workspace.png`; PDF và từng trang render đã xem |
| MAN-MSG-01 | HTTP thật email+SMS qua localhost sink, SMS chưa cấu hình, gửi lại | Trước sửa sink nhận email2 lần; sau outbox2 attempt503 nhưng sink nhận1 email. Mỗi kênh có trạng thái riêng, kết quả chưa rõ không tự retry | `notification-requests.jsonl`; bảng advice_delivery_attempts |
| MAN-MSG-02 | Mở thông báo từ đơn nháp vừa tạo | Phát hiện mẫu tự chèn tên bệnh viện/bác sĩ, khẳng định ký số và linkcổngquốcgia. Đang sửa đồng bộ SMS/Email/GAS/SMTP; chưa coi bản quan sát cũ là đạt | Mẫu hiển thị và ca hồi quy riêng |
| MAN-AI-01 | Hỏi quaUI “Bệnh nhân Trần bị sốt cao là bệnh gì?” | POST200; yêu cầu bổ sung ca bệnh; không nhận Nhântrần/Caolá làm thuốc và không chẩn đoán từ ADR | `19-assistant-symptom-abstains.png`; nội dung phản hồi đọc trực tiếp |
| MAN-AI-02 | Chuỗi HTTP thật: Paracetamol→“thuốc này chống chỉ định gì”→triệuchứng→GSP→tồnVaxigrip→“cáinày” | Đúng ngữ cảnh Paracetamol khi hỏi tiếp; ca triệu chứng xóa thuốc trước; GSP báo đúng4.5°Cvàbiệttrữ; Vaxigrip không có tồn khả dụng đã xác nhận; đối tượng chưa rõ thì hỏi lại | `assistant-observed.json`; không có citationthuốclàmchứng cứ tồn |
| MAN-AUTH-03 | Đăng xuất từ Cài đặt | Nội dung lâm sàng bị gỡ ngay trong lúc chờ; POSTlogout200 và trở về form đăng nhập; không hiện đơn cache | `20-logout-hides-clinical-cache.png` chụp lúc đang chờ; nội dung form sau đó đọc trực tiếp |

## Tám biểu mẫu và PDF

Tất cả đều có dấu **DỰ THẢO — CHƯA XÁC MINH**. Căn cứ, thời điểm thực hiện, thành viên, kết quả và chữ ký chưa có không được suy diễn. Thuốc tủ trực/thiết bị/tài sản chưa nối backend được nêu rõ là nguồn mô phỏng cả trên bản in.

| Loại | Nguồn kiểm tra | Chi tiết quan trọng được giữ | PDF quan sát |
| --- | --- | --- | --- |
| Hủy vỏ kiểm soát đặc biệt | Hai phiếu trả nguồn debt-3/debt-7 | ID/mã, thuốc, lượng/đơn vị, người bệnh/vị trí; số vỏ thực kiểm, cách hủy và kết quả để chờ ghi | `form-01-ampoule.pdf`,1 trang |
| Dự trù thuốc | Năm lô dưới ngưỡng API | Lô/hạn/tồn/min/max/gợiý/vịtrí; SLduyệt/thựccấp để chờ ghi | `form-02-restock.pdf`,1 trang |
| Mượn khẩn | Chọn debt-2, không lấy debt-1 ngầm | PhiếuPN-2026-090, BN8820, Kali2 ống, lýdo/vịtrí/ngườimượn trên nguồn; thực giao/nhận chưa xác nhận | `form-03-borrow.pdf`,1 trang |
| Bàn giao thiết bị | Chọn asset-6 | CRRT/Prismaflex,serial,đơnvịnguồn; giátrị/phụkiện/thựcgiao/kếtquả không tự điền | `form-04-transfer.pdf`,1 trang |
| Kiểm định/bàn giao | Chọn eq-4 | Mãphiếu/thiếtbị/serial/sựcố/đơnvị/lịchnguồn; phépđo/kếtquả/chứngthư chưa có | `form-05-inspection.pdf`,1 trang |
| Kiểm kê tài sản | Đủ12 tài sản nguồn | Mã/serial/vịtrísổ/vịtríghi nhận/tìnhtrạng; SLthựckiểm/chênhlệch/kếtluận để chờ ghi | `form-06-inventory.pdf`,2 trang, headerbảng lặp khi ngắt |
| Sự cố lạnh | Tủ1,6 log và lôb-8 | Cả log11°Cvà4.5°C, biệttrữ/VVM/MKT, tổngtủ1250 ghi chưa đối soát, lô200 Ống riêng | `form-07-coldchain.pdf`,1 trang |
| Bàn giao ca | Các mục nguồn còn mở | Phiếu thuốc/thiết bị/tài sản cần đối chiếu, lô tồn thấp, trạng thái tủ; không bịa ca07:00/sốbệnhnhân/diễnbiến | `form-08-shift.pdf`,3 trang; không cắt danh sách để ép một trang |

Không thấy nút điều khiển, launcherAI hoặc sidebar lọt vào các PDF đã render. Kiểm thử keyboard/mobile/landscape với API giả lập được ghi trong báo cáo tổng, không thay thế bảng quan sát ở trên.

## Ma trận quyền qua HTTP thật

Chạy với AUTH_REQUIRED=true trên snapshot, năm tài khoản thử khác nhau. Payload cố đưa tên/vai trò caller khác không thay thế danh tính phiên đăng nhập.

| Endpoint / hành động | Bác sĩ | Điều dưỡng | Dược sĩ | Kỹ sư | Giám đốc |
| --- | --- | --- | --- | --- | --- |
| Đăng nhập/đăngxuất | 200 | 200 | 200 | 200 | 200 |
| Patients/CPOE/history | 200 | 200 | 200 | 403 | 200 |
| DDI/MCP tools | 200 | 200 | 200 | 403 | 200 |
| Ledger | 403 | 403 | 200 | 403 | 200 |
| Xuất tồn thử | 403 | 403 | 200 | 403 | 200 |
| Endpoint riêng sau logout | 401 | 401 | 401 | 401 | 401 |

Hai lệnh xuất được phép trong kiểm tra quyền làm tồn thử10→8; thao tác UI sau đó8→5. Không chạy lại script mutation để lấy lại ảnh. Lượt DDI đầu gửi sai schema422 đã được ghi nhận và thử lại riêng với `{drugs:[...]}`. Đây là kiểm tra quyền phần mềm, không xác minh giấy phép hành nghề.

## Căn cứ và giới hạn

Bản in ngoại trú đối chiếu [TT26/2025/TT-BYT chính thức](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/26-byt.pdf), ngàybanhành30/06/2025; không gắn nhãn mẫu ngoại trú lên y lệnh nội trú. Chi tiết kiểm tra nguồn/hash được ghi riêng; không coi việc tải đúng PDF là chứng nhận đúng nghiệp vụ.

Chưa kiểm chứng cảm biến thật, chữ ký số, người chứng kiến thứ hai trên server, PostgreSQL, callbackdelivery và truy cập LAN từ một máy khác. MAR/nợtủtrực/thiếtbị/tàisản chưa thành sổ nghiệp vụ bền vững chỉ vì UI có bản nháp. Các lỗi và thiếu coverage của trợ lý còn được phân loại trong báo cáo tổng.

## Kiểm chứng lại sau sửa — 06/11/2026

Luồng thông báo được chạy lại trên UI3001/API8001 có xác thực thật, không giả lập API. Đã tái hiện thêm lỗi `facilityName:null` từ response khiến `.trim()` làm hỏng thao tác; regression null fail→pass, sau đó thao tác lại:

- Mở đơn nháp790013007271-C; SMS và Email đều giữ trạng thái bản nháp/mã nội bộ, liều1 viên(500 mg),ngày2 lần,Uống,3 ngày và marker `MANUAL-NOTES-20261105`. Không còn tự chèn bệnh viện hoặc linkcổngquốcgia. Tên người kê là tên đã lưu trên chính hồ sơ, không tự thay bằng người đang xem.
- Bấm gửi Email: POST lưu và POSTsend-email200; localhostsink nhận đúng **một** request mới. Payload giữ thuốc/đường/tần suất/ghi chú; doctorHospitalrỗng khi nguồn không có, không sinh lịch/đợt điều trị mới. Đây là ACKtừsink, không phải bằng chứng email thật đến người nhận.
- Đăng xuất200 rồi chỉ còn form đăng nhập, không còn nút/mã đơn trong DOM; không có lỗi JavaScript trình duyệt.
- Ảnh `22-final-email-source.png`, `23-final-email-accepted-local-sink.png`, `24-final-logout-login-only.png` đã xem trực tiếp. Kết quả và payload lưu `final-ui-observed.json`, log `final-ui-nov06-3.log`.

MAN-MSG-02 ở bảng trên đã được sửa và kiểm chứng lại đạt trong phạm vi nội dung/ACKlocal. Các lỗi timeout do bộ điều khiển đọc form trước khi effect dựng xong, hoặc do server kiểm chứng chưa khởi động xong, được giữ trong log cũ; không được tính là lỗi delivery hay ghi đè các quan sát thành công này.

## Đối chiếu lại nguồn trợ lý qua HTTP — 06/11/2026

Sau bản sửa cuối, các câu hỏi “Thuốc điều trị hen phế quản” và “Thuốc hạ huyết áp cho người suy thận” trả yêu cầu bổ sung vì chưa có hướng dẫn đúng chủ đề; không trả một chuyên luận IV bất kỳ. Oresol chỉ trả thông tin đăng ký và yêu cầu đúng tờ hướng dẫn chế phẩm, không dùng liều glucose IV. Hỏi dị ứng Võ Minh Trí trả đúng BN8820 và dị ứng đã lưu, đồng thời nêu chưa thẩm định đơn, không tự đề xuất kháng sinh khác.

Ca Efferalgan đã tái hiện nguồn liên kết không rỗng nhưng bị gắn nhãn chế phẩm trong khi chứa cả đường uống/đặt/IV. Sau guard về chế phẩm/dạng/đường dùng, HTTP200 trả `unverified_product_specific_clinical_evidence`, không đưa liều chéo dạng, không gắn citation chuyên luận giả thành đúng chế phẩm và confidence 0. Tra cứu hoạt chất Paracetamol và câu hỏi tiếp nối vẫn hoạt động. Đây là kiểm tra chặn sai phạm vi nguồn, không xác thực y khoa mọi nội dung Paracetamol trong corpus.

Log `assistant-final-verified.log` và `assistant-observed.json` lưu phản hồi thật trên snapshot; tất cả request đều tới localhost. Việc thắt chặt có thể từ chối cả câu hỏi hợp lệ khi metadata nguồn còn thiếu; giới hạn độ phủ này được giữ rõ trong báo cáo.

## Server phục vụ người dùng — kiểm tra chỉ đọc

Bốn trang chính được mở lại trên chính UI3000/API8000 ở desktop1440 vàmobile375, không giả lập API. Cả tám lượt có một h1, không tràn ngang và không lỗi JavaScript. CPOEgiữ12 đơn, kho20 lô, kho lạnh1 lô; không có `MAN-RBAC-LOT`/ghi chú thử nghiệm từ DBkiểm chứng. Sau khi sang06/11, lô hết hạn05/11 được đánh đỏ đúng; kho lạnh chưa ánh xạ tủ trên server chính vẫn hiện giữ để kiểm tra, không ngầm coi là đã xác minh. Ảnh `live-375-coldchain.png` và `live-1440-fefo.png` đã xem trực tiếp; toàn bộ quan sát ở `user-server-observed.json`. Không thực hiện mutation trên server này trong lượt kiểm tra.
