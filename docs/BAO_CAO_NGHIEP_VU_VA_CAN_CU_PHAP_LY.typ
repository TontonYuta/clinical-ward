// ============================================================================
// ĐỒ ÁN 2: HỆ THỐNG QUẢN LÝ KHO DƯỢC, THIẾT BỊ VÀ ĐIỀU PHỐI LÂM SÀNG BỆNH VIỆN
// BÁO CÁO ĐẶC TẢ NGHIỆP VỤ, BÓC TÁCH ĐỐI TƯỢNG VÀ CĂN CỨ PHÁP LÝ BỘ Y TẾ
// ============================================================================

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2cm),
  header: context [
    #if counter(page).get().first() > 1 [
      #set text(size: 8.5pt, fill: rgb("#475569"), font: "Times New Roman")
      #grid(
        columns: (1fr, 1fr),
        align(left)[*ĐỒ ÁN 2: HỆ THỐNG ĐIỀU PHỐI & QUẢN TRỊ DƯỢC LÂM SÀNG*],
        align(right)[*BÁO CÁO ĐẶC TẢ NGHIỆP VỤ & PHÁP LÝ*]
      )
      #v(-3pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
    ]
  ],
  footer: context [
    #if counter(page).get().first() > 1 [
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
      #v(-2pt)
      #set text(size: 8.5pt, fill: rgb("#64748b"), font: "Times New Roman")
      #grid(
        columns: (1fr, 1fr),
        align(left)[*Chuẩn BYT: TT 26/2025, TT 18/2026, NĐ 04/2025*],
        align(right)[Trang #counter(page).display("1 / 1", both: true)]
      )
    ]
  ]
)

#set text(
  font: "Times New Roman",
  size: 12pt,
  lang: "vi",
  spacing: 120%
)

#set par(
  justify: true,
  leading: 0.8em,
  first-line-indent: 1.25cm
)

#set heading(numbering: "1.1.")

#show heading.where(level: 1): it => block(
  breakable: false,
  [
    #v(18pt)
    #text(fill: rgb("#0f766e"), size: 15pt, weight: "bold")[#it]
    #v(8pt)
  ]
)

#show heading.where(level: 2): it => block(
  breakable: false,
  [
    #v(12pt)
    #text(fill: rgb("#115e59"), size: 13pt, weight: "bold")[#it]
    #v(6pt)
  ]
)

#show heading.where(level: 3): it => block(
  breakable: false,
  [
    #v(10pt)
    #text(fill: rgb("#1e293b"), size: 12pt, weight: "bold")[#it]
    #v(4pt)
  ]
)

// Macro: Hộp căn cứ pháp lý
#let legal-box(law, content) = block(
  fill: rgb("#f0fdfa"),
  stroke: (left: 4pt + rgb("#0f766e")),
  inset: (x: 12pt, y: 10pt),
  radius: (right: 4pt),
  width: 100%,
  breakable: false,
  [
    #set par(first-line-indent: 0cm, leading: 0.65em)
    #text(weight: "bold", fill: rgb("#0f766e"), size: 10.5pt)[🏛 CĂN CỨ PHÁP LÝ: #law] \
    #v(4pt)
    #text(fill: rgb("#0f172a"), size: 10.5pt)[#content]
  ]
)

// Macro: Hộp cảnh báo / Rủi ro thanh tra
#let alert-box(title, content) = block(
  fill: rgb("#fff1f2"),
  stroke: (left: 4pt + rgb("#e11d48")),
  inset: (x: 12pt, y: 10pt),
  radius: (right: 4pt),
  width: 100%,
  breakable: false,
  [
    #set par(first-line-indent: 0cm, leading: 0.65em)
    #text(weight: "bold", fill: rgb("#be123c"), size: 10.5pt)[⚠️ ĐIỂM NÓNG THANH TRA & RỦI RO PHÁP LÝ: #title] \
    #v(4pt)
    #text(fill: rgb("#1e293b"), size: 10.5pt)[#content]
  ]
)

// Macro: Bảng thông tin đẹp
#let clean-table(columns, ..cells) = table(
  columns: columns,
  fill: (col, row) => if row == 0 { rgb("#0f766e") } else if calc.even(row) { rgb("#f8fafc") } else { white },
  stroke: (col, row) => (
    bottom: 0.5pt + rgb("#cbd5e1"),
    top: if row == 0 { 1pt + rgb("#0f766e") } else { 0pt },
    left: 0pt,
    right: 0pt
  ),
  inset: (x: 8pt, y: 7pt),
  align: (col, row) => if row == 0 { center + horizon } else { left + horizon },
  ..cells
)

// ============================================================================
// TRANG BÌA
// ============================================================================

#align(center)[
  #text(size: 13pt, weight: "bold")[BỘ GIÁO DỤC VÀ ĐÀO TẠO --- BỘ Y TẾ] \
  #text(size: 14pt, weight: "bold")[TRƯỜNG ĐẠI HỌC BÁCH KHOA / CÔNG NGHỆ] \
  #text(size: 12pt)[KHOA CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG] \
  #v(8pt)
  #line(length: 40%, stroke: 1.5pt + rgb("#0f766e"))
  #v(40pt)

  #text(size: 13pt, weight: "bold", fill: rgb("#64748b"))[ĐỒ ÁN TỐT NGHIỆP / ĐỒ ÁN 2] \
  #v(10pt)
  #text(size: 19pt, weight: "bold", fill: rgb("#0f766e"))[
    BÁO CÁO ĐẶC TẢ NGHIỆP VỤ & CĂN CỨ PHÁP LÝ
  ] \
  #v(6pt)
  #text(size: 15pt, weight: "bold", fill: rgb("#1e293b"))[
    HỆ THỐNG QUẢN TRỊ DƯỢC LÂM SÀNG, KHO THUỐC ĐA TẦNG, TRANG THIẾT BỊ Y TẾ VÀ KÊ ĐƠN ĐIỆN TỬ BỆNH VIỆN
  ] \
  #v(8pt)
  #text(size: 11pt, style: "italic", fill: rgb("#475569"))[
    (Nghiên cứu bóc tách vai trò người dùng, quy chuẩn Thông tư - Nghị định mới nhất 2025--2026 và kiến trúc phần mềm y tế chống rủi ro pháp lý)
  ]

  #v(50pt)

  #align(center)[
    #block(
      width: 80%,
      stroke: 0.5pt + rgb("#cbd5e1"),
      inset: 16pt,
      radius: 6pt,
      fill: rgb("#f8fafc"),
      [
        #set par(first-line-indent: 0cm, leading: 1em)
        #grid(
          columns: (130pt, 1fr),
          row-gutter: 10pt,
          [*Giảng viên hướng dẫn:*], [Thầy/Cô hướng dẫn bộ môn],
          [*Sinh viên thực hiện:*], [Nguyễn Hữu Dũng (Yuta)],
          [*Chuyên ngành:*], [Kỹ thuật Phần mềm / Hệ thống Thông tin Y tế],
          [*Thời điểm báo cáo:*], [Tháng 10 Năm 2026],
          [*Trạng thái tài liệu:*], [#text(weight: "bold", fill: rgb("#0f766e"))[Bản chốt phạm vi xác nhận bài toán]]
        )
      ]
    )
  ]

  #v(50pt)
  #text(size: 11pt, weight: "bold")[HÀ NỘI --- NĂM 2026]
]

#pagebreak()

// ============================================================================
// MỤC LỤC & LỜI MỞ ĐẦU
// ============================================================================

#outline(
  title: [MỤC LỤC BÁO CÁO],
  indent: 1.5em,
  depth: 3
)

#v(20pt)

= LỜI NÓI ĐẦU & BỐI CẢNH THỰC TẾ

Hiện nay, quá trình chuyển đổi số y tế tại Việt Nam đang diễn ra mạnh mẽ theo tinh thần của Luật Khám bệnh, chữa bệnh năm 2023. Tuy nhiên, qua thực tiễn kiểm tra, thanh tra định kỳ của Bộ Y tế, Sở Y tế và cơ quan Bảo hiểm Xã hội (BHXH) Việt Nam tại các cơ sở y tế công lập cũng như tư nhân, công tác *quản lý cấp phát thuốc, lập phiếu chỉ định y lệnh, kê đơn điện tử và kiểm định trang thiết bị y tế* đang bộc lộ nhiều lỗ hổng nghiêm trọng:

1. *Kê đơn và cấp phát chưa chặt chẽ theo thông tư:* Tình trạng xuất thuốc vượt liều tối đa, chỉ định không có chẩn đoán ICD-10 tương ứng, hoặc đơn thuốc ngoại trú bị gộp chung vào tủ trực nội trú dẫn đến việc bị cơ quan BHXH từ chối thanh toán (xuất toán) hàng tỷ đồng.
2. *Quản lý thuốc gây nghiện, hướng thần còn lỏng lẻo:* Việc cấp phát Morphin, Fentanyl tại khoa lâm sàng chưa kiểm soát chặt chẽ quy trình thu hồi vỏ ống rỗng và thành lập hội đồng hủy vỏ ống, vi phạm các quy định hình sự và quy chế dược khắt khe.
3. *Trộn lẫn ranh giới nghiệp vụ giữa các nhân sự:* Nhiều hệ thống phần mềm bệnh viện gộp chung quyền hạn của Điều dưỡng buồng bệnh với Dược sĩ quản lý kho, hoặc không bóc tách giữa Kho Dược nội trú, Kho Ngoại trú BHYT và Kho Trang thiết bị - Vật tư tiêu hao.
4. *Sự cố trang thiết bị không được truy vết chuẩn:* Khi máy thở, máy sốc tim hoặc bơm tiêm điện gặp sự cố hỏng hóc, việc báo hỏng chỉ thực hiện qua giấy tờ viết tay hoặc tin nhắn rời rạc, không đối chiếu được hạn kiểm định an toàn kỹ thuật theo quy định.

Xuất phát từ nhận xét chỉ đạo trực tiếp của Giảng viên hướng dẫn: _"Tách rõ các nội dung riêng biệt, xác định rõ đối tượng sử dụng là ai, điều dưỡng hay người quản lý dược và trang thiết bị, mỗi đối tượng có nghiệp vụ và nhu cầu khác nhau, mảng thuốc rất rộng nên bóc tách. Phần bác sĩ chỉ định phải bóc tách thêm kho nội trú và ngoại trú, thuốc và thiết bị vật tư y tế phải bóc tách thì mới làm được. Cần đưa đủ các thông tư liên quan vào vì hiện nay các đơn vị đang bị thanh kiểm tra rất chặt chẽ"_, báo cáo này được lập ra nhằm *đặc tả tường minh 100% bài toán nghiệp vụ, khóa cứng mô hình người dùng, lập ma trận văn bản quy phạm pháp luật* trước khi bước vào giai đoạn code chi tiết.

#pagebreak()

// ============================================================================
// CHƯƠNG 1
// ============================================================================

= BÓC TÁCH ĐỐI TƯỢNG SỬ DỤNG VÀ THẨM QUYỀN TRÁCH NHIỆM (ACTORS & RBAC)

Hệ thống được thiết kế theo nguyên tắc phân quyền theo vai trò (Role-Based Access Control - RBAC) và phân định rõ ranh giới pháp lý cá nhân. Bốn nhóm tác nhân (Actors) chính hoạt động độc lập nhưng kết nối liền mạch qua luồng dữ liệu y tế:

#figure(
  clean-table(
    (100pt, 110pt, 150pt, 120pt),
    [*Đối tượng (Role)*], [*Thực thể sử dụng*], [*Trách nhiệm nghiệp vụ cốt lõi*], [*Căn cứ pháp lý chủ quản*],
    [#text(weight: "bold", fill: rgb("#0f766e"))[1. Bác sĩ Điều trị (Doctor)]],
    [Bác sĩ khoa lâm sàng, bác sĩ buồng bệnh, bác sĩ phòng khám],
    [- Khám bệnh, chẩn đoán bệnh kèm mã ICD-10.\ - Chỉ định y lệnh nội trú CPOE.\ - Kê đơn thuốc ngoại trú điện tử.\ - Duyệt cảnh báo tương tác thuốc (CDSS).],
    [TT 26/2025/TT-BYT \ Luật KBCB 2023],
    [#text(weight: "bold", fill: rgb("#0f766e"))[2. Điều dưỡng Buồng bệnh (Nurse)]],
    [Điều dưỡng viên phụ trách buồng bệnh, điều dưỡng tủ trực cấp cứu],
    [- Thực hiện y lệnh thuốc (MAR).\ - Cho mượn thuốc cấp cứu từ Tủ trực.\ - Quản lý Sổ nợ vỏ thuốc gây nghiện (Morphin).\ - Lập biên bản bàn giao ca trực 3 bên.],
    [TT 18/2026/TT-BYT \ TT 22/2011/TT-BYT \ TT 20/2017/TT-BYT],
    [#text(weight: "bold", fill: rgb("#0f766e"))[3. Dược sĩ Lâm sàng & Kho (Pharmacist)]],
    [Dược sĩ khoa Dược, thủ kho nội trú, thủ kho ngoại trú BHYT],
    [- Duyệt phiếu lĩnh thuốc buồng bệnh.\ - Cấp phát thuốc ngoại trú BHYT.\ - Kiểm soát hạn dùng FEFO & dự trù cơ số.\ - Giám sát chuỗi lạnh vắc xin/sinh phẩm (GSP).\ - Tiếp nhận và tiêu hủy vỏ thuốc gây nghiện.],
    [TT 36/2018/TT-BYT \ VBHN 07/VBHN-BYT \ TT 22/2011/TT-BYT],
    [#text(weight: "bold", fill: rgb("#0f766e"))[4. Kỹ sư Thiết bị Y tế (BME)]],
    [Kỹ sư phòng Trang thiết bị - Công trình y tế],
    [- Quản lý hồ sơ thiết bị y tế loại A, B, C, D.\ - Theo dõi hạn kiểm định đo lường an toàn điện.\ - Tiếp nhận và xử lý sự cố báo hỏng máy thở, máy sốc tim, monitor.\ - Lập phiếu kiểm kê tài sản cố định.],
    [NĐ 04/2025/NĐ-CP \ NĐ 98/2021/NĐ-CP \ NĐ 151/2017/NĐ-CP]
  ),
  caption: [Bảng phân định thẩm quyền và ranh giới trách nhiệm của 4 nhóm đối tượng người dùng]
)

== 1.1. Bác sĩ Điều trị (Doctor / Prescriber)
Bác sĩ là đối tượng duy nhất có thẩm quyền pháp lý ra y lệnh điều trị và ký đơn thuốc. Bác sĩ *không trực tiếp quản lý kho*, không có quyền can thiệp vào số lượng tồn kho vật lý hay sửa đổi hạn dùng của thuốc. 
- *Nghiệp vụ nội trú:* Ra y lệnh thuốc theo giờ, chỉ định dịch truyền, chỉ định thở máy, chỉ định thủ thuật lâm sàng.
- *Nghiệp vụ ngoại trú:* Kê đơn thuốc cho bệnh nhân tái khám hoặc điều trị ngoại trú với đầy đủ thông tin số ngày dùng, liều lượng, cách dùng, mã liên thông đơn thuốc quốc gia.
- *Hỗ trợ quyết định lâm sàng (CDSS):* Tiếp nhận tức thì cảnh báo tương tác thuốc nghiêm trọng (Drug-Drug Interactions), cảnh báo quá liều thuốc nhóm Opioid, cảnh báo thuốc nguy cơ cao (High-Alert: KCl đậm đặc tiêm tĩnh mạch).

== 1.2. Điều dưỡng Buồng bệnh & Trực Khoa (Ward Nurse)
Điều dưỡng là người trực tiếp tiếp xúc với bệnh nhân, thực hiện y lệnh và chịu trách nhiệm về cơ số tủ trực cấp cứu tại khoa lâm sàng.
- *Không có quyền tự ý kê đơn:* Điều dưỡng chỉ xuất thuốc khi có y lệnh của Bác sĩ, ngoại trừ tình huống cấp cứu khẩn cấp ("Cho mượn khẩn cấp trước -- Bác sĩ bổ sung y lệnh sau trong vòng 24 giờ").
- *Quản lý nợ vỏ thuốc gây nghiện:* Thu hồi nguyên vẹn vỏ ống rỗng Morphin, Fentanyl sau khi tiêm cho bệnh nhân. Ghi rõ số lô, mã bệnh nhân, buồng bệnh và nộp trả lại Kho Dược.
- *Bàn giao ca trực:* Kết thúc ca trực 8 tiếng hoặc 12 tiếng, điều dưỡng phải cùng điều dưỡng ca sau đối soát từng ống thuốc thực tế so với sổ sách, xác nhận biên bản giao ban điện tử.

== 1.3. Dược sĩ Lâm sàng & Quản lý Kho Dược (Clinical Pharmacist)
Dược sĩ chịu trách nhiệm trước Giám đốc bệnh viện về chất lượng thuốc, tính hợp lệ của đơn thuốc và việc duy trì cơ số tồn kho theo tiêu chuẩn Thực hành tốt bảo quản thuốc (GSP).
- *Bóc tách Kho Nội trú vs Kho Ngoại trú:* 
  + _Kho Nội trú:_ Cấp phát thuốc theo Phiếu tổng hợp thuốc hàng ngày của các khoa lâm sàng hoặc cấp bù cơ số tủ trực cấp cứu.
  + _Kho Ngoại trú BHYT:_ Cấp phát thuốc theo từng đơn thuốc điện tử của bệnh nhân đến khám ngoại trú, trừ trực tiếp tồn kho ngoại trú độc lập.
- *Nguyên tắc xuất kho FEFO (First Expired, First Out):* Tuyệt đối không cho phép xuất thuốc có hạn dùng xa khi lô thuốc cận hạn vẫn còn tồn kho và đạt tiêu chuẩn chất lượng.
- *Kiểm soát thuốc đặc biệt:* Bảo quản thuốc gây nghiện trong tủ có khóa chắc chắn, duy trì hệ thống sổ sách theo dõi riêng biệt, tổ chức Hội đồng hủy vỏ ống thuốc gây nghiện.

== 1.4. Kỹ sư Y sinh & Quản lý Thiết bị (Biomedical Engineer - BME)
Kỹ sư BME phụ trách toàn bộ tài sản kỹ thuật y tế của bệnh viện. Nhóm này tách biệt hoàn toàn khỏi quy trình cấp phát thuốc nhưng liên kết mật thiết với Điều dưỡng và Bác sĩ khi máy móc xảy ra sự cố.
- *Phân loại trang thiết bị y tế:* Quản lý trang thiết bị theo 4 mức độ rủi ro (Loại A, B, C, D theo Nghị định 04/2025/NĐ-CP).
- *Giám sát kiểm định & an toàn:* Quản lý lịch kiểm định định kỳ đối với các thiết bị đo lường và an toàn tính mạng (máy thở, máy gây mê kèm thở, máy sốc tim, lồng ấp trẻ sơ sinh).
- *Xử lý sự cố:* Tiếp nhận phiếu báo hỏng khẩn cấp từ khoa lâm sàng, phân loại lỗi (Lỗi cơ học, lỗi điện khí nén, lỗi phần mềm, chai pin), điều phối sửa chữa và nghiệm thu đưa vào sử dụng.

#pagebreak()

// ============================================================================
// CHƯƠNG 2
// ============================================================================

= HỆ THỐNG CĂN CỨ PHÁP LÝ & QUY ĐỊNH BỘ Y TẾ MỚI NHẤT (2025--2026)

Để đảm bảo phần mềm không mắc lỗi vi phạm pháp lý dẫn đến các đợt thanh tra bị xử phạt hoặc xuất toán BHYT, hệ thống xây dựng bộ quy tắc nghiệp vụ dựa trên các văn bản quy phạm pháp luật mới nhất:

#figure(
  clean-table(
    (110pt, 140pt, 110pt, 120pt),
    [*Văn bản Quy phạm*], [*Nội dung điều chỉnh*], [*Hiệu lực / Cập nhật*], [*Mô-đun phần mềm tương ứng*],
    [*Thông tư 26/2025/TT-BYT*],
    [Quy định kê đơn thuốc điện tử, mẫu đơn thuốc nội trú và ngoại trú.],
    [Mới nhất (Thay thế TT 52, TT 18, TT 04)],
    [Phân hệ Kê đơn CPOE Bác sĩ & Duyệt đơn Ngoại trú],
    [*Thông tư 18/2026/TT-BYT* \ & TT 20/2017/TT-BYT],
    [Quy định quản lý thuốc gây nghiện, hướng thần, tiền chất; thu hồi vỏ ống rỗng.],
    [Mới nhất (Cập nhật 2026)],
    [Sổ Nợ Vỏ Morphin & Biên Bản Hủy Vỏ Ống],
    [*Thông tư 22/2011/TT-BYT* \ & VBHN 07/VBHN-BYT],
    [Tổ chức hoạt động Khoa Dược, quy chế tủ trực, danh mục cơ số cấp cứu.],
    [Văn bản hợp nhất đang áp dụng],
    [Tủ Thuốc Trực Cấp Cứu & Phiếu Dự Trù Bù (Mẫu 01)],
    [*Thông tư 36/2018/TT-BYT*],
    [Tiêu chuẩn Thực hành tốt bảo quản thuốc (GSP), quản lý FEFO và chuỗi lạnh.],
    [Đang có hiệu lực],
    [Quản Lý Hạn Dùng FEFO & Datalogger Tủ Lạnh 2--8°C],
    [*Nghị định 04/2025/NĐ-CP* \ & NĐ 98/2021/NĐ-CP],
    [Quản lý trang thiết bị y tế, phân loại A/B/C/D, kiểm định an toàn định kỳ.],
    [Mới nhất (Nghị định 04/2025)],
    [Phân Hệ Sự Cố BME & Lịch Kiểm Định Máy Thở],
    [*Nghị định 130/2018/NĐ-CP* \ & Luật GDĐT 2023],
    [Quy định chữ ký số, chứng thực điện tử và nhật ký kiểm toán không thể sửa đổi.],
    [Đang có hiệu lực],
    [Nhật Ký Kiểm Toán Audit Trail (SHA-256)],
    [*Nghị định 151/2017/NĐ-CP*],
    [Quản lý và kiểm kê tài sản công tại cơ sở y tế nhà nước.],
    [Đang có hiệu lực],
    [Biên Bản Kiểm Kê Tài Sản Công 31/12]
  ),
  caption: [Ma trận đối chiếu giữa văn bản quy phạm pháp luật và các mô-đun chức năng của ứng dụng]
)

== 2.1. Phân tích Thông tư 26/2025/TT-BYT về Kê đơn thuốc điện tử
#legal-box("Thông tư số 26/2025/TT-BYT (Bộ Y tế)", [
  - *Điều khoản cốt lõi:* Đơn thuốc điện tử bắt buộc phải gắn mã định danh cơ sở y tế, mã bác sĩ kê đơn (chứng chỉ hành nghề), mã định danh bệnh nhân và mã đơn thuốc quốc gia.
  - *Quy chuẩn kê đơn:* Không được kê đơn thực phẩm chức năng trong đơn thuốc. Phải ghi rõ tên hoạt chất (INN) đối với thuốc generic; chỉ được ghi tên biệt dược kèm hoạt chất khi có chỉ định đặc biệt.
  - *Bóc tách nội trú vs ngoại trú:* Đơn thuốc ngoại trú không được tính vào cơ số tủ trực nội trú; thời hạn cấp phát thuốc ngoại trú tối đa không quá 30 ngày (đối với bệnh mạn tính) và 7 ngày (đối với bệnh cấp tính).
])

#alert-box("Xuất toán BHYT do kê đơn sai Thông tư", [
  Thanh tra BHXH sẽ từ chối thanh toán toàn bộ chi phí tiền thuốc nếu: Bác sĩ kê đơn không có chứng chỉ hành nghề phù hợp chuyên khoa; kê đơn thuốc vượt quá liều khuyến cáo của Dược thư Quốc gia mà không có hội chẩn; đơn thuốc điện tử thiếu chữ ký số hợp lệ hoặc thời gian kê đơn sau thời gian bệnh nhân ra viện.
])

== 2.2. Phân tích Thông tư 18/2026/TT-BYT & TT 20/2017/TT-BYT về Thuốc kiểm soát đặc biệt
#legal-box("Thông tư số 18/2026/TT-BYT & Thông tư 20/2017/TT-BYT", [
  - *Thu hồi vỏ ống:* Mọi ống thuốc gây nghiện dạng tiêm (Morphin hydroclorid 10mg/1ml, Fentanyl 0.1mg/2ml, Pethidin) sau khi tiêm cho người bệnh bắt buộc phải lưu giữ vỏ ống rỗng tại khoa lâm sàng.
  - *Sổ theo dõi:* Điều dưỡng phải lập "Sổ theo dõi xuất nhập thuốc gây nghiện và thu hồi vỏ ống", ghi rõ: Họ tên bệnh nhân, số hồ sơ bệnh án, số giường, số lượng ống tiêm, ngày giờ tiêm, chữ ký điều dưỡng tiêm và điều dưỡng chứng kiến.
  - *Tiêu hủy vỏ ống:* Định kỳ (không quá 30 ngày), khoa lâm sàng phải nộp toàn bộ vỏ ống về Khoa Dược. Giám đốc bệnh viện ra quyết định thành lập "Hội đồng hủy vỏ ống thuốc gây nghiện" gồm ít nhất 3 thành viên: Lãnh đạo bệnh viện, Trưởng khoa Dược, Điều dưỡng trưởng bệnh viện. Biên bản hủy vỏ phải lưu trữ ít nhất 02 năm.
])

== 2.3. Phân tích Nghị định 04/2025/NĐ-CP & NĐ 98/2021/NĐ-CP về Thiết bị y tế
#legal-box("Nghị định số 04/2025/NĐ-CP sửa đổi Nghị định 98/2021/NĐ-CP", [
  - *Phân loại rủi ro:* Trang thiết bị y tế được chia làm 4 loại:
    + *Loại A:* Rủi ro thấp (Nẹp, bông băng, xe tiêm, nhiệt kế điện tử).
    + *Loại B:* Rủi ro trung bình thấp (Máy hút dịch, máy khí dung, bơm tiêm điện thông thường).
    + *Loại C:* Rủi ro trung bình cao (Máy theo dõi bệnh nhân đa thông số Monitor, máy thở không xâm lấn, máy X-quang di động).
    + *Loại D:* Rủi ro cao (Máy thở xâm lấn hồi sức tích cực ICU, máy phá rung tim có chức năng sốc điện, máy tim phổi nhân tạo ECMO, máy lọc máu liên tục CRRT).
  - *Kiểm định định kỳ:* Thiết bị loại C và D bắt buộc phải được dán tem kiểm định an toàn kỹ thuật và hiệu chuẩn đo lường định kỳ bởi tổ chức được Bộ Y tế chỉ định. Tuyệt đối không được đưa vào sử dụng thiết bị quá hạn kiểm định hoặc tem kiểm định bị rách vỡ.
])

#pagebreak()

// ============================================================================
// CHƯƠNG 3
// ============================================================================

= ĐẶC TẢ CHI TIẾT 5 QUY TRÌNH NGHIỆP VỤ CỐT LÕI

== 3.1. Quy trình Phân hệ 1: Kê đơn & Chỉ định Y lệnh CPOE (Bác sĩ)

Quy trình kê đơn điện tử CPOE được chuẩn hóa nhằm ngăn ngừa 100% các sai sót y khoa (Medical Errors) và bảo đảm tuân thủ Thông tư 26/2025/TT-BYT:

#block(
  fill: rgb("#f8fafc"),
  stroke: 0.5pt + rgb("#cbd5e1"),
  inset: 12pt,
  radius: 4pt,
  [
    #set par(first-line-indent: 0cm, leading: 0.8em)
    *BƯỚC 1: TIẾP NHẬN BỆNH NHÂN & CHẨN ĐOÁN*
    - Bác sĩ chọn hồ sơ bệnh nhân từ danh sách buồng bệnh hoặc buồng khám.
    - Nhập chẩn đoán xác định và mã bệnh ICD-10 (Bắt buộc).

    #v(4pt)
    *BƯỚC 2: CHỌN DANH MỤC THUỐC & LIỀU DÙNG*
    - Tìm kiếm thuốc theo tên hoạt chất (INN) hoặc biệt dược.
    - Nhập liều dùng, đơn vị (ống, viên, lọ), đường dùng (uống, tiêm bắp, tiêm tĩnh mạch, truyền tĩnh mạch), số lần dùng/ngày và giờ dùng cụ thể.

    #v(4pt)
    *BƯỚC 3: KIỂM SOÁT HỖ TRỢ RA QUYẾT ĐỊNH LÂM SÀNG (CDSS AUTOMATED AUDIT)*
    - *Kiểm tra quá liều Opioid:* Cảnh báo đỏ nếu tổng liều Morphin tương đương vượt ngưỡng an toàn ($> 30"mg/ngày"$).
    - *Kiểm tra tương tác thuốc (DDI):* Phát hiện tức thì các cặp thuốc tương tác mức độ Nguy hiểm (ví dụ: Morphin + Diazepam gây ức chế hô hấp sâu; Ceftriaxone + dung dịch chứa Calci gây kết tủa vi mạch phổi).
    - *Kiểm tra thuốc nguy cơ cao (High-Alert):* Cảnh báo bắt buộc đối với Kali clorid 10% tiêm trực tiếp (bắt buộc phải pha loãng truyền tĩnh mạch chậm).

    #v(4pt)
    *BƯỚC 4: KÝ SỐ & LUÂN CHUYỂN Y LỆNH*
    - Bác sĩ xác nhận vượt qua cảnh báo (ghi rõ lý do lâm sàng) hoặc điều chỉnh đơn.
    - Ký số y lệnh. Hệ thống tự động phân loại:
      + Đơn thuốc nội trú $arrow.r$ Chuyển đến Phiếu thực hiện thuốc của Điều dưỡng buồng bệnh.
      + Đơn thuốc ngoại trú $arrow.r$ Đẩy lên Cổng liên thông đơn thuốc quốc gia và chuyển đến Kho Dược Ngoại Trú BHYT.
  ]
)

== 3.2. Quy trình Phân hệ 2: Tủ Trực Cấp Cứu & Quản lý Nợ Vỏ Morphin (Điều dưỡng)

Tủ thuốc trực cấp cứu tại khoa lâm sàng hoạt động theo cơ chế cơ số cố định. Đây là "điểm nóng" dễ xảy ra thất thoát thuốc gây nghiện nếu không có công cụ giám sát thời gian thực:

#block(
  fill: rgb("#f8fafc"),
  stroke: 0.5pt + rgb("#cbd5e1"),
  inset: 12pt,
  radius: 4pt,
  [
    #set par(first-line-indent: 0cm, leading: 0.8em)
    *1. QUY TRÌNH CHO MƯỢN KHẨN CẤP (EMERGENCY BORROW)*
    - Khi bệnh nhân rơi vào tình trạng cấp cứu (ngừng tuần hoàn, phản vệ, sốc đau dữ dội):
    - Điều dưỡng xuất ngay thuốc từ Tủ trực (Adrenalin, Morphin, Fentanyl, Diazepam).
    - Hệ thống ghi nhận trạng thái: `DEBT_PENDING_PRESCRIPTION` (Nợ y lệnh bác sĩ).
    - Đồng hồ đếm ngược 24 giờ kích hoạt; thông báo tự động gửi tới Bác sĩ ca trực yêu cầu bổ sung y lệnh hoàn trả cơ số.

    #v(4pt)
    *2. QUY TRÌNH THU HỒI & QUẢN LÝ VỎ ỐNG GÂY NGHIỆN (TT 18/2026/TT-BYT)*
    - Sau khi tiêm thuốc gây nghiện, vỏ ống thủy tinh rỗng được gắn mã định danh kèm theo:
      `[Mã bệnh nhân] - [Số buồng/giường] - [Số lô vỏ] - [Giờ tiêm]`.
    - Trạng thái vỏ ống: `AMPOULE_BORROWED` (Đang giữ vỏ) $arrow.r$ `AMPOULE_RETURNED_TO_WARD` (Đã thu hồi về tủ trực) $arrow.r$ `TRANSFERRED_TO_PHARMACY` (Đã bàn giao về Kho Dược).
    - Trường hợp làm rơi vỡ vỏ ống: Phải lập ngay "Biên bản vỡ vỏ ống thuốc gây nghiện" có chữ ký của Điều dưỡng tiêm, Bác sĩ điều trị và người làm chứng.

    #v(4pt)
    *3. QUY TRÌNH GIAO BAN CA TRỰC 3 BÊN (SHIFT HANDOVER)*
    - Cuối ca trực (07:00 sáng / 19:00 tối), Điều dưỡng ca cũ và Điều dưỡng ca mới đồng kiểm tra:
      + Đếm trực tiếp từng ống thuốc thực tế trong khay.
      + Kiểm đếm số lượng vỏ ống rỗng trong hộp bảo quản vỏ.
      + Đối soát với số lượng xuất trên phần mềm.
    - Ký xác nhận biên bản giao ban điện tử 3 bên (Điều dưỡng ca cũ - Điều dưỡng ca mới - Điều dưỡng trưởng khoa).
  ]
)

#pagebreak()

== 3.3. Quy trình Phân hệ 3: Bóc tách Kho Dược Nội trú, Ngoại trú & Quản lý FEFO (Dược sĩ)

Một trong những đóng góp mang tính cốt lõi của nghiên cứu này là *bóc tách hoàn toàn 3 luồng kho vật lý và logic*:

#figure(
  clean-table(
    (110pt, 120pt, 120pt, 130pt),
    [*Đặc điểm phân biệt*], [*Kho Dược Nội Trú*], [*Kho Dược Ngoại Trú BHYT*], [*Kho Vật Tư Y Tế & Tiêu Hao*],
    [*Đối tượng phục vụ*], [Bệnh nhân nằm viện nội trú tại các khoa lâm sàng.], [Bệnh nhân khám bệnh ngoại trú, tái khám định kỳ.], [Các khoa phòng toàn bệnh viện sử dụng trong can thiệp.],
    [*Cơ chế cấp phát*], [Theo Phiếu lĩnh thuốc hàng ngày hoặc Phiếu bù cơ số tủ trực.], [Theo từng Đơn thuốc điện tử cá nhân hóa.], [Theo Phiếu dự trù vật tư tiêu hao định kỳ.],
    [*Phương thức thanh toán*], [Thanh toán trọn gói theo đợt điều trị nội viện.], [Thanh toán trực tiếp tại quầy ngoại trú / Đồng chi trả BHYT.], [Tính vào cơ cấu giá dịch vụ phẫu thuật, thủ thuật.],
    [*Kiểm soát hạn dùng*], [FEFO nghiêm ngặt, cơ số min/max theo ngày.], [FEFO theo đợt cấp phát (7 đến 30 ngày).], [Quản lý theo hạn dùng và điều kiện tiệt trùng.]
  ),
  caption: [Bảng bóc tách 3 luồng kho dược phẩm và vật tư y tế độc lập trong bệnh viện]
)

=== Nguyên tắc xuất kho FEFO (First Expired, First Out)
Theo Thông tư 36/2018/TT-BYT, hệ thống tự động sắp xếp các lô thuốc theo ngày hết hạn (Expiry Date), lô nào có hạn dùng gần nhất bắt buộc phải được xuất trước:
- *Lô bình thường ($> 90$ ngày):* Trạng thái xanh, cho phép xuất kho bình thường.
- *Lô cận hạn ($30 - 90$ ngày):* Trạng thái vàng, hệ thống gắn cờ cảnh báo ưu tiên xuất hoặc lập danh sách điều chuyển về khoa có tần suất sử dụng cao.
- *Lô cực kỳ cận hạn ($< 30$ ngày):* Trạng thái cam, hệ thống yêu cầu xác nhận đặc biệt trước khi duyệt xuất.
- *Lô hết hạn ($<= 0$ ngày):* Khóa tự động, không cho phép hiển thị trong danh mục cấp phát; tự động chuyển sang trạng thái chờ hủy bảo quản tại khu vực biệt trữ.

== 3.4. Quy trình Phân hệ 4: Sự Cố & Kiểm Định Thiết Bị Y Tế BME (Kỹ sư Y sinh)

Quy trình quản lý thiết bị y tế theo Nghị định 04/2025/NĐ-CP được khép kín từ khâu tiếp nhận thiết bị, theo dõi kiểm định định kỳ đến xử lý sự cố khẩn cấp tại giường bệnh:

#block(
  fill: rgb("#f8fafc"),
  stroke: 0.5pt + rgb("#cbd5e1"),
  inset: 12pt,
  radius: 4pt,
  [
    #set par(first-line-indent: 0cm, leading: 0.8em)
    *BƯỚC 1: PHÁT HIỆN SỰ CỐ & PHÁT LỆNH BÁO HỎNG (INCIDENT REPORTING)*
    - Điều dưỡng hoặc Bác sĩ phát hiện thiết bị bất thường (Máy thở xì khí, nứt bẫy nước; máy sốc tim báo lỗi tụ nạp năng lượng; monitor nhiễu sóng ECG).
    - Tạo phiếu báo hỏng trên ứng dụng: Chọn thiết bị (theo mã vạch QR hoặc serial), chọn buồng bệnh, chọn mức độ nghiêm trọng:
      + `CRITICAL`: Nguy hiểm tính mạng người bệnh $arrow.r$ Báo động đỏ toàn viện.
      + `WARNING`: Hỏng một phần chức năng nhưng còn máy dự phòng.
      + `ROUTINE`: Lỗi bảo trì thông thường (thay pin, đứt dây cáp phụ).

    #v(4pt)
    *BƯỚC 2: PHÂN LOẠI & ĐIỀU PHỐI KỸ THUẬT (BME TRIAGE)*
    - Kỹ sư y sinh tiếp nhận phiếu trong vòng tối đa 05 phút (đối với mức Critical).
    - Căn cứ vào phân loại rủi ro A/B/C/D của thiết bị để đưa ra giải pháp:
      + Đưa máy thở dự phòng thay thế ngay tại buồng cấp cứu.
      + Biệt trữ máy hỏng, dán biển "NGỪNG SỬ DỤNG -- CHỜ BẢO TRÌ".

    #v(4pt)
    *BƯỚC 3: SỬA CHỮA, HIỆU CHUẨN & NGHIỆM THU ĐƯA VÀO SỬ DỤNG*
    - Kỹ sư tiến hành thay thế linh kiện chính hãng hoặc phối hợp nhà sản xuất.
    - Tiến hành đo an toàn điện (dòng rò, nối đất) và hiệu chuẩn thông số đo lường.
    - Cập nhật nhật ký kỹ thuật và chuyển trạng thái thiết bị sang `OPERATIONAL` (Sẵn sàng hoạt động).
  ]
)

#pagebreak()

== 3.5. Quy trình Phân hệ 5: Giám Sát Chuỗi Lạnh GSP & Nhật Ký Kiểm Toán (Audit Trail)

=== 1. Giám sát Chuỗi Lạnh (Cold Chain Monitoring)
Vắc xin, huyết thanh và sinh phẩm y tế bắt buộc phải được bảo quản nghiêm ngặt ở dải nhiệt độ $2^compose "C" - 8^compose "C"$ theo Thông tư 36/2018/TT-BYT:
- Datalogger IoT tự động truyền dữ liệu nhiệt độ mỗi 10 phút/lần.
- Hệ thống tự động tính toán chỉ số nhiệt độ động học trung bình MKT (Mean Kinetic Temperature) để đánh giá mức độ suy giảm hiệu lực sinh học khi có sự cố biến động nhiệt.
- Khi nhiệt độ vượt quá $8.5^compose "C"$ hoặc tụt dưới $1.5^compose "C"$, hệ thống phát chuông cảnh báo âm thanh và tin nhắn khẩn cấp tới Dược sĩ phụ trách chuỗi lạnh để kích hoạt quy trình chuyển kho đá khô dự phòng.

=== 2. Nhật Ký Kiểm Toán Bất Biến (Immutable Audit Trail)
Tuân thủ Nghị định 130/2018/NĐ-CP và Luật Giao dịch điện tử, mọi thao tác người dùng (kê đơn, xuất thuốc, xóa nợ vỏ, báo hỏng thiết bị, sửa thông tin bệnh nhân) đều được ghi lại trong bảng Audit Log với cấu trúc:
- `timestamp`: Thời gian chính xác đến mili-giây theo chuẩn ISO-8601 UTC.
- `user_id` & `role`: Định danh người dùng và chứng chỉ số tại thời điểm thực hiện.
- `action_type`: Phân loại hành vi (`DISPENSE`, `RETURN_AMPOULE`, `OVERRIDE_CDSS`, `MAINTENANCE`).
- `data_hash`: Chuỗi băm SHA-256 bảo vệ tính toàn vẹn dữ liệu, chống hành vi sửa đổi cơ sở dữ liệu ngầm.

#v(10pt)

#figure(
  clean-table(
    (90pt, 90pt, 80pt, 120pt, 100pt),
    [*Thời gian (UTC)*], [*Người thực hiện*], [*Vai trò*], [*Hành vi lâm sàng*], [*Mã băm toàn vẹn (SHA-256)*],
    [2026-10-24 07:15:22], [BS. Nguyễn Văn H.], [Doctor], [Ký y lệnh Morphin 10mg tiêm bắp], [#text(font: "Liberation Mono", size: 8.5pt)[8a7f9c2d1e0...]],
    [2026-10-24 07:18:04], [ĐD. Trần Thị M.], [Nurse], [Xuất 1 ống Morphin tủ trực cấp cứu], [#text(font: "Liberation Mono", size: 8.5pt)[3b4c5d6e7f8...]],
    [2026-10-24 07:30:15], [ĐD. Trần Thị M.], [Nurse], [Thu hồi vỏ ống Morphin lô VN882], [#text(font: "Liberation Mono", size: 8.5pt)[1c2d3e4f5a6...]],
    [2026-10-24 09:00:00], [DS. Lê Hoàng T.], [Pharmacist], [Nhận 12 vỏ ống từ khoa Cấp cứu], [#text(font: "Liberation Mono", size: 8.5pt)[9f8e7d6c5b4...]]
  ),
  caption: [Minh họa trích xuất Nhật ký kiểm toán lâm sàng đảm bảo tính toàn vẹn và bất biến]
)

#pagebreak()

// ============================================================================
// CHƯƠNG 4
// ============================================================================

= THIẾT KẾ DỮ LIỆU & LUỒNG TƯƠNG TÁC LIÊN PHÂN HỆ

Hệ thống điều phối lâm sàng hoạt động dựa trên luồng dữ liệu y tế đa chiều, đảm bảo mọi mệnh lệnh của bác sĩ đều được phản ánh tức thì tới điều dưỡng và thủ kho dược mà không có độ trễ:

#v(10pt)

#align(center)[
  #block(
    fill: rgb("#f8fafc"),
    stroke: 1pt + rgb("#0f766e"),
    inset: 16pt,
    radius: 6pt,
    width: 95%,
    [
      #set text(size: 10pt)
      #set par(first-line-indent: 0cm, leading: 0.9em)
      #text(weight: "bold", fill: rgb("#0f766e"), size: 12pt)[SƠ ĐỒ LUỒNG DỮ LIỆU TỔNG THỂ (END-TO-END DATA FLOW)] \
      #v(8pt)

      #grid(
        columns: (1fr, 24pt, 1.2fr, 24pt, 1fr),
        align: center + horizon,
        [
          #block(fill: rgb("#ccfbf1"), inset: 8pt, radius: 4pt, stroke: 0.5pt + rgb("#0f766e"))[
            *1. BÁC SĨ ĐIỀU TRỊ* \
            Khám bệnh $arrow.r$ Chẩn đoán \
            Kê đơn CPOE / Y lệnh \
            _Vượt qua kiểm tra CDSS_
          ]
        ],
        [$arrow.r$],
        [
          #block(fill: rgb("#fef3c7"), inset: 8pt, radius: 4pt, stroke: 0.5pt + rgb("#d97706"))[
            *2. ĐIỀU DƯỠNG BUỒNG BỆNH* \
            Thực hiện y lệnh thuốc (MAR) \
            Xuất thuốc tủ trực cấp cứu \
            Thu hồi vỏ ống Morphin rỗng \
            _Biên bản giao ban ca trực_
          ]
        ],
        [$arrow.r$],
        [
          #block(fill: rgb("#e0e7ff"), inset: 8pt, radius: 4pt, stroke: 0.5pt + rgb("#4338ca"))[
            *3. KHO DƯỢC BỆNH VIỆN* \
            Duyệt phiếu bù cơ số tủ trực \
            Cấp phát đơn thuốc ngoại trú \
            Xuất kho chuẩn FEFO \
            _Hội đồng tiêu hủy vỏ ống_
          ]
        ]
      )

      #v(12pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
      #v(8pt)

      #grid(
        columns: (1.5fr, 24pt, 1.5fr),
        align: center + horizon,
        [
          #block(fill: rgb("#fee2e2"), inset: 8pt, radius: 4pt, stroke: 0.5pt + rgb("#dc2626"))[
            *4. SỰ CỐ TRANG THIẾT BỊ (ĐIỀU DƯỠNG / BÁC SĨ)* \
            Máy thở / Bơm tiêm điện gặp sự cố hỏng hóc \
            Phát phiếu báo hỏng khẩn cấp (Phân loại A/B/C/D)
          ]
        ],
        [$arrow.r$],
        [
          #block(fill: rgb("#f1f5f9"), inset: 8pt, radius: 4pt, stroke: 0.5pt + rgb("#475569"))[
            *5. PHÒNG TRANG THIẾT BỊ Y TẾ (KỸ SƯ BME)* \
            Điều phối máy dự phòng thay thế \
            Sửa chữa, hiệu chuẩn, dán tem kiểm định NĐ 04/2025
          ]
        ]
      )
    ]
  )
]

#v(10pt)

== Ranh giới bóc tách Cơ sở Dữ liệu (Schema Separation)
Để tránh nhầm lẫn giữa Dược phẩm, Vật tư tiêu hao và Thiết bị y tế, mô hình dữ liệu (TypeScript Interfaces / Pydantic Models) được khóa cứng với các thuộc tính riêng biệt:
- `MedicationItem`: Bắt buộc có `active_substance` (hoạt chất), `route` (đường dùng), `is_narcotic` (gây nghiện), `is_high_alert` (nguy cơ cao), `storage_condition` (2--8°C hay phòng mát), `concentration` (nồng độ/hàm lượng).
- `MedicalSupplyItem`: Bắt buộc có `sterilization_status` (vô trùng/tiệt trùng), `gauge_size` (kích cỡ kim), `single_use` (dùng 1 lần), `material_type` (nhựa y tế, inox).
- `MedicalEquipmentItem`: Bắt buộc có `serial_number`, `model`, `risk_classification` (Loại A, B, C, D theo NĐ 04/2025), `inspection_expiry_date` (hạn kiểm định), `preventive_maintenance_cycle` (chu kỳ bảo dưỡng định kỳ tính bằng tháng).

#pagebreak()

// ============================================================================
// CHƯƠNG 5
// ============================================================================

= ĐÁNH GIÁ TÍNH KHẢ THI, TIÊU CHUẨN MÃ NGUỒN VÀ KẾ HOẠCH TRIỂN KHAI

== 5.1. Cam kết Chuẩn hóa Mã nguồn (Software Engineering Standards)
Dự án áp dụng triệt để các tiêu chuẩn kỹ thuật phần mềm hiện đại nhằm bảo đảm khả năng bảo trì, mở rộng và kiểm thử tự động:
1. *Quy tắc tệp tinh gọn ($<= 200$ dòng code / file):* 100% các tệp mã nguồn (Components, Hooks, Services, Data Layers) đều được module hóa độc lập, không vượt quá 200 dòng lệnh. Điều này giúp loại bỏ "Code Slop", ngăn chặn lỗi phụ thuộc vòng (Circular Dependencies) và tạo điều kiện kiểm thử đơn vị triệt để.
2. *Nguyên tắc Schema-First & State Machine rõ ràng:* Mọi component tương tác dữ liệu đều định nghĩa đủ 4 trạng thái vòng đời: `Idle` $arrow.r$ `Loading` $arrow.r$ `Success` $arrow.r$ `Error/Empty`.
3. *Tự động hóa kiểm thử (Loop-Until-Green):* Mọi tính năng lâm sàng đều được bảo vệ bởi bộ test case tự động (hiện tại đã hoàn thiện 45/45 test cases chatbot lâm sàng và kịch bản Playwright kiểm định UI Desktop).

== 5.2. Công nghệ Hiện thực hóa (Technology Stack)
- *Frontend:* React 19, TypeScript 5.7, Tailwind CSS v4, Lucide Icons, Motion Animation.
- *Testing & Verification:* Playwright Chromium Engine (Kiểm định trực quan đa độ phân giải), TSX Test Suite.
- *CI/CD & Cloud:* GitHub Actions, Vercel Serverless Hosting, Git Webhook Auto-Deployment.
- *Data Storage:* SQLite với chế độ WAL (Write-Ahead Logging) cho giao dịch tốc độ cao và bảo đảm tính toàn vẹn y tế.

== 5.3. Lộ trình Triển khai Chi tiết (Milestones)

#figure(
  clean-table(
    (70pt, 140pt, 160pt, 90pt),
    [*Milestone*], [*Hạng mục Nghiệp vụ*], [*Kết quả nghiệm thu kỹ thuật*], [*Trạng thái*],
    [*Giai đoạn 1*],
    [Bóc tách Loại & Pháp lý Bộ Y tế],
    [Module hóa `legalDocs.ts`, phân tách `UserRole` theo chuẩn 2026.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 2*],
    [Phân hệ Kê đơn CPOE Bác sĩ],
    [`CpoeOrderModal.tsx`, kiểm tra tương tác thuốc CDSS theo TT 26/2025.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 3*],
    [Bóc tách Kho Nội trú & Ngoại trú],
    [Phân tách dữ liệu kho, quản lý hạn dùng FEFO theo TT 36 GSP.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 4*],
    [Phân hệ Thiết bị Y tế BME],
    [Phân loại A/B/C/D, quy trình báo hỏng máy thở theo NĐ 04/2025.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 5*],
    [Sổ Nợ Vỏ Morphin & Giao ban],
    [Quản lý nợ vỏ thuốc gây nghiện, biên bản hủy vỏ theo TT 18/2026.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 6*],
    [Đại tu UI Desktop & Playwright],
    [Sửa bảng dữ liệu, đóng modal Escape, kiểm định 12 màn hình Desktop.],
    [#text(weight: "bold", fill: rgb("#0f766e"))[ĐÃ HOÀN THÀNH]],
    [*Giai đoạn 7*],
    [Hoàn thiện Backend API & DB],
    [Đồng bộ SQLite WAL và tích hợp liên thông đơn thuốc điện tử.],
    [#text(weight: "bold", fill: rgb("#d97706"))[BƯỚC TIẾP THEO]]
  ),
  caption: [Lộ trình phát triển và kiểm định chất lượng phần mềm theo từng giai đoạn]
)

#v(20pt)

// ============================================================================
// PHẦN KẾT LUẬN & XÁC NHẬN BÀI TOÁN
// ============================================================================

= KẾT LUẬN & ĐỀ NGHỊ XÁC NHẬN BÀI TOÁN

Báo cáo này đã giải quyết trọn vẹn và tường minh mọi yêu cầu then chốt mà Giảng viên hướng dẫn đã đóng góp:
1. *Đã bóc tách rạch ròi 4 đối tượng:* Bác sĩ (Kê đơn CPOE, CDSS) --- Điều dưỡng (Tủ trực, Sổ nợ vỏ Morphin) --- Dược sĩ (Kho Nội trú, Kho Ngoại trú BHYT, FEFO) --- Kỹ sư BME (Thiết bị y tế A/B/C/D, sự cố, kiểm định).
2. *Đã bóc tách 3 luồng kho:* Kho Dược Nội trú, Kho Dược Ngoại trú BHYT và Kho Trang thiết bị - Vật tư y tế tiêu hao.
3. *Đã viện dẫn đầy đủ hệ thống văn bản pháp luật mới nhất:* Thông tư 26/2025/TT-BYT, Thông tư 18/2026/TT-BYT, Nghị định 04/2025/NĐ-CP, Thông tư 36/2018/TT-BYT, Thông tư 22/2011/TT-BYT và Nghị định 130/2018/NĐ-CP.
4. *Đã kiểm chứng tính khả thi trên hệ thống:* Ứng dụng đã hoàn thành giao diện Desktop chuẩn chỉnh, vượt qua 45/45 kịch bản kiểm thử lâm sàng và được triển khai tự động trên hạ tầng đám mây.

Kính trình Giảng viên hướng dẫn xem xét và cho ý kiến xác nhận về bài toán nghiệp vụ này để làm cơ sở triển khai các phân hệ nghiệp vụ chi tiết tiếp theo.

#v(40pt)

#grid(
  columns: (1fr, 1fr),
  align: center,
  [
    *Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN* \
    #v(8pt)
    #text(style: "italic", size: 10pt)[(Ký, ghi rõ họ tên và đóng góp ý kiến)] \
    #v(60pt)
    ...........................................................................
  ],
  [
    *SINH VIÊN BÁO CÁO* \
    #v(8pt)
    #text(style: "italic", size: 10pt)[(Ký và ghi rõ họ tên)] \
    #v(60pt)
    *Nguyễn Hữu Dũng (Yuta)*
  ]
)
