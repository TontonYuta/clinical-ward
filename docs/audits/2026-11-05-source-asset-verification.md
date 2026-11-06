# Tài liệu nguồn và kiểm tra dữ liệu — 05–06/11/2026

Đã đóng gói bảy PDF mà giao diện và kiểm thử tham chiếu. Manifest [source-provenance.json](../../public/pdf/source-provenance.json) ghi nguồn tải, định danh, ngày, số trang, byte và SHA256. Kiểm tra byte giúp phát hiện file bị thay/cắt; không chứng minh nội dung chuyên luận được trích đúng hoặc văn bản còn hiệu lực.

| Tài liệu | Số trang | Nguồn và giới hạn |
| --- | --- | --- |
| TT26/2025/TT-BYT | 26 | Bản chính thức Chính phủ; byte trùng bản tham chiếu sẵn trong repo. Ngày ban hành30/06/2025. |
| Dược thư Quốc gia lần II | 1.668 | Giữ nguyên file sẵn có; bìa ghi tái bản lần thứ nhất có sửa chữa năm2018, quyết định2033 năm2015 ở trong sách. Chưa biết URL tải gốc; không tuyên bố đã xác minh nguồn tải mới. |
| QĐ5948/QĐ-BYT | 176 | Bản đầy đủ từ Trung tâm DI&ADR Quốc gia, có cả bảng3.1/3.2. Loại bản tin bệnh viện8 trang vì đó không phải toàn văn. Không tuyên bố xác minh chữ ký số PDF; metadata chữ ký trên bản phân phối không qua kiểm tra digest. |
| TT51/2017/TT-BYT | 20 | Bản scan từ website trường y tế công lập, khớp hash đã ghi trước; kiểm tra trang đầu/ngày29/12/2017 và phụ lục. |
| TT20/2017/TT-BYT | 58 | Bản Công báo gốc2017. File văn bản685.089 byte là bản thật nhỏ hơn bản scan cũ; không thay bằng VBHN2021. Đây là nguồn lịch sử, không gắn nhãn quy định hiện hành. |
| TT22/2011/TT-BYT | 41 | Công báo Chính phủ, có các mẫu/phụ lục; khớp hash cũ. |
| TT23/2011/TT-BYT | 21 | Công báo Chính phủ, có các mẫu/phụ lục; khớp hash cũ. |

Các URL và phương pháp định danh cụ thể nằm trong manifest. Khi CDN thiếu intermediatecertificate, việc tải dùng chuỗi GlobalSign đã đối chiếu với hệ thống tin cậy; không bỏ xác minh TLS. Những phản hồi HTML400 hoặc tài liệu tóm tắt sai định danh không được đóng gói.

`tests/test_pdf_files_integrity.ts` kiểm tra PDFmagic/EOF/byte/hash của đúng artifact có nguồn, thay ngưỡng dung lượng scan tùy ý. `.gitignore` chỉ mở đúng bảy file cần dùng, không đưa tất cả PDF tải về lên Git.

## Kết quả chưa đạt của dữ liệu chuyên luận

`npm run validate:sources` vẫn thất bại **822 mục kiểm tra**:

- 769 lỗi thiếu trường trang có cấu trúc hoặc chứng cứ bổ sung mà validator yêu cầu. Cả771 dòng thiếu `start_page`; hai dòng được miễn vì nhãn bổ sung nội bộ tường minh. Trong đó760 dòng đã có chữ “Trang N” trong `source`, chưa được đối chiếu và chuyển thành metadata có cấu trúc; không được suy ra760 dòng đó không có nguồn chỉ từ việc validator thất bại.
- 53 dòng trùng INN theo quy tắc validator, đã trừ ngoại lệ salbutamol có sẵn.
- Không còn lỗi thiếu/copy/hash PDF trong lượt kiểm tra này.

Không bịa số trang, đổi INN, gán nguồn mới hoặc nới assertion để làm xanh. Chín dòng còn lại không có vị trí trang và không thuộc hai bổ sung nội bộ cần rà soát đặc biệt. Việc xác minh trích đoạn, phiên bản và tính đúng của hướng dẫn y khoa từng chuyên luận còn mở.

## Kiểm tra database

Script KB trước kia gọi lệnh `sqlite3` ngoài hệ thống, ghi lỗi query nhưng vẫn trả thành công. Nay dùng Pythonstdlib với URI SQLite `mode=ro`, truy vấn tham số, và trả thất bại nếu DB được chỉ định không tồn tại, file hỏng, thiếu interpreter hoặc thiếu hoạt chất yêu cầu. Kiểm thử riêng xác nhận đường dẫn có dấu nháy không làm sai lệnh và byte DB không đổi. Khi không chỉ định DB và không có DB cục bộ, script ghi rõ chỉ kiểm tra tài liệu; không coi đó là mappingDAVđã được xác nhận.

Kiểm traHTTPcuối: bảy file ở UI`/pdf/` và API`/api/v1/pdf/` đều200, Content-Type PDF và Content-Length khớp manifest. Bảy blob đã stage trênGit giữ đúngSHA256; `.gitattributes` khai báoPDF binary để không đổi xuống dòng của nguồn.
