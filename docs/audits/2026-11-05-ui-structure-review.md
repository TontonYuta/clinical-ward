# Rà soát tiêu đề và cấu trúc thao tác Clinical Ward

Bốn trang đang hoạt động dùng một header chung với tên trang và thao tác chính. Những nhãn đánh số, breadcrumb nhắc lại tên trang và dòng giới thiệu chung đã được gỡ. Biểu mẫu được mở rộng thành không gian có danh mục, hồ sơ nguồn và bản xem trước. Đợt UI đầu từng đối chiếu hash bản in; sau yêu cầu deepaudit, tám tài liệu được sửa thành bản nháp trung thực để loại dữ kiện/kết quả tự điền. Kiểm chứng hiện tại đối chiếu trường nguồn và phần chưa xác nhận, không khóa nội dung sai cũ bằng hash.

## Phạm vi và cách kiểm tra

Script `scripts/audit_ui_headers.mjs` phân tích AST toàn bộ TSX trong `src`, lần theo import thực sự được dùng trong JSX, rồi dùng Playwright đọc các tiêu đề đang render. Không đếm nhãn sidebar như lỗi lặp; không gỡ tên người bệnh, người chỉ định, mã hồ sơ hoặc tiêu đề chính thức trong tài liệu in. Các cặp giống từ ngữ là ứng viên rà soát, không phải lệnh tự động xóa.

Bản gốc quét 102 tệp TSX, 195 nút tiêu đề và thu được 89 trạng thái ở 1440px/375px. Có 49 cặp/dải ứng viên, không phải 49 lỗi độc lập. Một lần chụp danh mục thuốc desktop bị timeout; cùng thành phần vẫn được chụp trên mobile. Bản sau sửa dùng launcher kho dược ổn định hơn và thu đủ 90 trạng thái. Các thành phần không có đường render từ App được ghi riêng trong JSON; không suy diễn rằng chúng đang xuất hiện cho người dùng.

Audit UI dùng fixture đọc tường minh và lỗi có kiểm soát cho endpoint ngoài phạm vi; không gửi thông báo hay ghi hồ sơ lên máy chủ. Báo cáo không xác nhận tất cả trạng thái nghiệp vụ hoặc toàn bộ phân quyền backend.

## Những phần giữ và bỏ ở từng màn hình

| Màn hình | Phần lặp trước sửa | Cấu trúc đã áp dụng | Thông tin giữ nguyên |
|---|---|---|---|
| Tổng quan | Header Trạm lâm sàng / Tổng quan; dải 01 Góc nhìn vận hành; tiêu đề Một nhịp làm việc rõ ràng | Header Tổng quan duy nhất; bên dưới là lối tắt và việc cần chú ý | Số lô cần chú ý, tồn tối thiểu, nhiệt độ và đường mở hồ sơ/thuốc |
| Đơn thuốc | Breadcrumb Đơn thuốc; 02 Điều trị & kê đơn; Đơn thuốc; Danh sách đơn thuốc | Header Đơn thuốc + Kê đơn mới; toolbar tìm/lọc; dòng số hồ sơ | Mã đơn, người bệnh, chẩn đoán, loại đơn, trạng thái; đầy đủ thuốc/liều và ghi chú trong chi tiết |
| Kho dược | Breadcrumb Kho dược; 03 Tồn kho & hạn dùng; Kho dược | Header Kho dược + Tra cứu thuốc; tìm/lọc ngay dưới | Thuốc, hàm lượng/dạng, số lô, hạn dùng, tồn/đơn vị và vị trí |
| Chuỗi lạnh | Breadcrumb Chuỗi lạnh; 04 Bảo quản & giám sát; Chuỗi lạnh | Header Chuỗi lạnh + Biên bản; tab dữ liệu và chỉ số gọn | Nhiệt độ, độ ẩm, thời điểm, lô, hạn, đơn vị và trạng thái |
| Nhật ký nhiệt độ | Tab Nhật ký nhiệt độ và caption cùng tên | Tab giữ tên; caption chỉ số bản ghi và phạm vi dữ liệu | Toàn bộ các dòng nhật ký, kể cả dòng cuối trên điện thoại |
| Chi tiết đơn | Tên cửa sổ và nhóm Đơn thuốc nhắc lại cùng ngữ cảnh | Một header chứa nhận diện đơn; nhóm Thông tin / An toàn / Theo dõi; Tóm tắt / Thuốc bên trong | Chẩn đoán, bác sĩ, định danh/BHYT, ghi chú, các đợt cấp và người nhận |
| Hành chính người bệnh | Tab Hành chính và heading Hành chính người bệnh | Giữ tab; vào thẳng hai nhóm trường dữ liệu | Định danh, liên hệ, khoa, buồng/giường và thời điểm tiếp nhận |
| Thực hiện y lệnh | Tên tab và tiêu đề phiếu lặp chức năng | Tiêu đề phần Tiến độ dùng thuốc làm rõ nội dung | Thuốc, liều, đường dùng, các cữ, người thực hiện và tiến độ |
| Hướng dẫn AI | Tab AI và tiêu đề phần nhắc lại AI lâm sàng | Tiêu đề phần Tra cứu và đối chiếu nguồn | Hướng dẫn và các bước bên trong |
| Thư viện, Nhật ký, Soạn đơn | Eyebrow nhắc lại chức năng ngay trên tiêu đề | Giữ một tên cửa sổ; bỏ nhãn trang trí lặp | Nguồn tài liệu, bản ghi hoạt động và các trường soạn đơn |
| Biểu mẫu | Header dài; tám tab ngang; dải ngữ cảnh; nhắc A4 ở nhiều nơi; hướng dẫn zoom và footer lặp | Một header Biểu mẫu; danh mục có tìm kiếm; vùng hồ sơ nguồn; bản xem trước | Cả tám loại phiếu, chi tiết nguồn và các trường nghiệp vụ quan trọng; dữ kiện tự bịa được bỏ |

Tên người chỉ định, chẩn đoán và tên biểu mẫu in không bị coi là nhãn trang trí. Những tiêu đề kết quả như Chưa có kết quả thẩm định cần được giữ để báo trạng thái, dù có từ giống tên tab.

## Bố cục Biểu mẫu

```text
Biểu mẫu                                  [In / Lưu PDF] [⋯] [Đóng]
──────────────────────────────────────────────────────────────────
Danh mục có tìm kiếm     Loại phiếu đang chọn
                         Hồ sơ nguồn [chọn đúng phiếu/thiết bị]
Thuốc và tủ trực         Lưu ý nguồn dữ liệu hoặc thiếu hồ sơ
Thiết bị và tài sản      ────────────────────────────────────────
Bảo quản và bàn giao ca  Bản xem trước A4                  [100%]
                         Nội dung tài liệu đầy đủ, có thể cuộn
```

Desktop mở rộng gần toàn màn hình, tối đa 1660px. Mobile/tablet mở danh mục bằng nút Chọn phiếu; bàn phím được giữ trong danh mục khi nó mở và trả về nút mở khi đóng. Màn hình thấp có thể cuộn tới bản xem trước. Fit tính từ chiều rộng thực tế, thay cho hệ số 0.88 cố định.

Luồng ngắn từ menu: chọn loại phiếu → chọn hồ sơ nếu phiếu cần nguồn riêng → kiểm tra bản xem → In / Lưu PDF. Đây là các vùng trong một không gian, không phải wizard nhiều trang. Luồng mở từ một hồ sơ có thể nhận đúng nguồn được truyền vào. Launcher chung không tự chọn bản ghi đầu tiên; mở lại không giữ nhầm người bệnh từ phiên trước.

HTML chuyển vào menu phụ. Bỏ nút trước/sau để tránh đổi sang loại phiếu khác do nhấn nhầm. Không thêm nút Lưu hay Ký điện tử vì cửa sổ hiện chỉ có chức năng xem/in/xuất HTML.

| Loại phiếu | Dữ liệu để thao tác | Khối nội dung được giữ trong bản in |
|---|---|---|
| Hủy vỏ thuốc kiểm soát đặc biệt | Danh sách nguồn; cần đối chiếu vỏ thực tế | Thuốc, số lượng vỏ, lô/hạn, hồ sơ sử dụng, hội đồng và chữ ký |
| Dự trù thuốc tủ trực | Danh sách dưới tồn tối thiểu | Danh mục thuốc, tồn/cơ số, số lượng đề nghị và người duyệt |
| Bàn giao thiết bị | Chọn tài sản cụ thể | Mã, thiết bị, số sê-ri, đơn vị giao/nhận, tình trạng và chữ ký |
| Phiếu mượn khẩn | Chọn hồ sơ xuất mượn cụ thể | Người bệnh, buồng/giường, phiếu, thuốc, số lượng, thời điểm, giao nhận |
| Kiểm định và bàn giao thiết bị | Chọn hồ sơ thiết bị cụ thể | Định danh máy, sự cố, các mục kiểm tra, kết quả và xác nhận |
| Kiểm kê tài sản | Danh sách tài sản | Danh mục, số lượng, tình trạng, đối chiếu và xác nhận |
| Sự cố chuỗi lạnh | Dữ liệu tủ và nguồn trong mẫu | Diễn biến, các lô, thông số và các mục ý kiến/xử lý |
| Bàn giao ca | Danh sách công việc và thiết bị | Ca trực, tồn đọng, người giao/nhận và chữ ký |

Bản hiện tại ghi DỰ THẢO — CHƯA XÁC MINH. Cơ sở, căn cứ pháp lý, người ký, phép đo, thực cấp và kết quả chưa có đều chờ ghi; dữ liệu miền chưa nối backend được ghi rõ là mô phỏng cả trên PDF. Bản nháp không xác nhận nghiệp vụ đã hoàn tất hay đủ điều kiện dùng thật.

## Quy tắc màu và phân cấp

- Đỏ: hết hạn, nguy hiểm, trạng thái cần chặn.
- Cam: cần kiểm tra, cận hạn, chưa có chữ ký hoặc thiếu hồ sơ.
- Xanh dương: thông tin nguồn và hướng dẫn.
- Xanh lá: trạng thái hoàn tất đã được ghi nhận; không dùng làm chứng nhận an toàn.
- Xám: thông tin phụ, không cần hành động.

Màu luôn đi với chữ/biểu tượng. Các cặp chữ/nền cảnh báo được kiểm tra tương phản; kiểm tra này không thay thế audit WCAG toàn bộ ứng dụng. Thể thức và màu đen của tài liệu in được giữ tách khỏi màu điều khiển UI.

## Skill đã cài và cách áp dụng

UI UX Pro Max được cài bằng skill-installer từ `nextlevelbuilder/ui-ux-pro-max-skill`, commit `ccce51cba388476d4f403091ddb91636d5cd9fed`, vào `/home/ubuntu/.codex/skills/ui-ux-pro-max`.

Đã đọc SKILL.md, tra UX Color Only / Color Contrast / Form Labels / Inline Validation / Submit Feedback, và hướng dẫn React về state dẫn xuất. Hai lần sinh hệ thống thiết kế trả về cấu trúc landing page bán hàng không phù hợp; các cấu trúc đó không được áp dụng. Các hướng dẫn Accessible & Ethical, Minimalism & Swiss Style và quy tắc tương tác được chọn theo đúng bối cảnh workstation nội bộ. Quyết định đã lưu ở `design-system/clinical-ward/MASTER.md`.

## Chạy lại kiểm tra

Mở server bằng `npm run dev:web`, sau đó:

```bash
npm run audit:ui-headers -- --label current
npm run audit:ui-headers -- --label current --check
npm run test:ui-structure
npm run test:ui
npm run lint
npm run build
```

Script tạo `artifacts/ui-header-audit/<label>/report.json`, `report.md` và screenshot. Dùng `--static-only` nếu chỉ cần kiểm kê source; bản đó không xác nhận lỗi trên màn hình thực tế. `--check` thất bại nếu còn ứng viên độ tin cậy cao hoặc lỗi thu thập.

`tests/test_printable_forms_layout.mjs` hiện kiểm tra đầy đủ tám loại theo nguồn, loại kết luận bịa, dữ liệu rỗng, xuấtHTML và printisolation. [Kiểm chứng thủ công](2026-11-05-manual-feature-verification.md) ghi từng PDF đã render và xem.

## Các giới hạn đã quan sát

- Lỗi thiếu PDF của baseline đã được xử lý bằng bảy artifact có nguồn/hash; `npm test` hiện qua. `validate:sources` chuyên luận vẫn thất bại, xem báo cáo auditlogic.
- Gói danh mục thuốc ngoại tuyến hiện nặng khoảng 83MiB nén, 415MB sau giải nén. Điều này làm kiểm thử đầy đủ danh mục chậm; test bố cục dùng một phần dữ liệu thực từ danh mục đóng gói để kiểm tra giải nén và render. Không thay dữ liệu production bằng tập nhỏ, và không tuyên bố đã tối ưu tải danh mục.
- Các mẫu in và các quyền backend cần quy trình kiểm tra riêng; thay đổi này tập trung vào bố cục, đọc hiểu và thao tác UI.

## Kết quả kiểm chứng cuối

- Audit sau sửa: 111 tệp TSX, 62 tệp trên cây render JSX, 171 nút tiêu đề, 90 trạng thái desktop/mobile; **0 ứng viên lặp theo bộ quy tắc và 0 lỗi thu thập**. Không suy rộng kết quả thành bảo đảm cho mọi dữ liệu, vai trò và trạng thái động chưa chạy.
- Audit mặc định chặn hai gói gzip nặng để dùng đường fallback danh mục thiết yếu thực tế có sẵn trong repo. Chạy thêm `--full-catalog` nếu chủ đích cần tải toàn bộ danh mục; phép thử đó có chi phí bộ nhớ/thời gian lớn. Chế độ dữ liệu được ghi trong `scope.catalogMode` của JSON.
- `npm run lint`, `npm run build`, `npm run test:workspace`, `npm run test:ui-structure`, `npm run test:ui`: **PASS**.
- Test bố cục chạy bốn trang tại 1440, 1366, 1024, 768, 390 và 375px. Test riêng kiểm tra một header, cảnh báo có tương phản, tám bản nháp đúng nguồn, nguồn hồ sơ không tự chọn, reset khi mở lại, preview màn hình ngang và focus danh mục bằng bàn phím.
- Review độc lập phát hiện ba điểm quan trọng: launcher còn tự truyền bản ghi đầu tiên, preview bị cắt khi màn hình thấp và focus chạy sau danh mục. Cả ba đã tái hiện bằng test thất bại, sửa và chạy qua lại.
- `npm test`: **PASS** sau khôi phục PDF và sửa kiểm tra database readonly; không suy ra validation nguồn chuyên luận đã đạt.
- `git diff --check`: PASS; PDF được khai báo binary để giữ đúng byte nguồn. Việc commit/push theo yêu cầu tiếp theo được ghi trong báo cáo logic, không phải deploy.

Ảnh kiểm tra tại `/tmp/clinical-workspace-redesign/refined/`: `1440-cpoe.png`, `1440-forms.png`, `1920-forms.png`, `375-forms.png`, `812-forms.png`. Nhật ký và bằng chứng máy đọc được ở `artifacts/ui-header-audit/after/`.
