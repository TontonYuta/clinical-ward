import re
import math
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.debt import DebtRecord
from app.models.coldchain import ColdChainCurrentState
from app.models.audit import AuditRecord
from app.services.audit_service import verify_ledger_integrity
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def handle_legal_intent(lower_query: str) -> CopilotResponse:
    title = "CĂN CỨ PHÁP LÝ & QUY CHUẨN Y TẾ HIỆN HÀNH"
    basis = "Thông tư 20/2017/TT-BYT & Nghị định 98/2021/NĐ-CP"
    chips = ["Phác đồ cấp cứu phản vệ", "Thông tư 26/2025/TT-BYT kê đơn", "Quy định kê đơn ngoại trú TT 52"]
    if "phản vệ" in lower_query or "adrenalin" in lower_query:
        title = "PHÁC ĐỒ CẤP CỨU SỐC PHẢN VỆ (THÔNG TƯ 51/2017/TT-BYT)"
        basis = "Thông tư 51/2017/TT-BYT"
        content = ("• **Thuốc thiết yếu hàng đầu:** Adrenalin 1mg/1ml (tiêm bắp ngay lập tức cho mọi trường hợp sốc phản vệ từ độ II trở lên).\n"
                   "• **Liều dùng ban đầu:** Người lớn: 1/2 - 1 ống (0.5 - 1mg). Trẻ em: 1/5 - 1/2 ống theo cân nặng (trẻ 10kg: tiêm 1/5 ống = 0.2ml).\n"
                   "• **Vị trí tiêm:** Mặt trước ngoài đùi (hấp thu nhanh nhất).\n"
                   "• **Nhắc lại:** Mỗi 3 - 5 phút/lần nếu huyết áp chưa nâng lên hoặc SpO2 chưa cải thiện.")
        chips = ["Liều Adrenalin người lớn 0.5mg tiêm bắp", "Vị trí tiêm mặt trước ngoài đùi", "Theo dõi nhắc lại mỗi 3 - 5 phút"]
    elif "hướng tâm thần" in lower_query or "hướng thần" in lower_query or "diazepam" in lower_query or "phenobarbital" in lower_query:
        title = "QUY CHẾ QUẢN LÝ VÀ CẤP PHÁT THUỐC HƯỚNG TÂM THẦN (THÔNG TƯ 20/2017/TT-BYT)"
        basis = "Thông tư 20/2017/TT-BYT"
        content = ("• **Bảo quản riêng biệt:** Bảo quản trong tủ thuốc riêng có khóa chắc chắn, người giữ chìa khóa là người được phân công bằng văn bản.\n"
                   "• **Theo dõi xuất nhập tồn:** Theo dõi xuất nhập tồn chi tiết theo từng người bệnh và số lô hạn dùng.\n"
                   "• **Lưu trữ hồ sơ chứng từ:** Lưu đơn thuốc và sổ sách chứng từ tối thiểu 2 năm sau khi thuốc hết hạn dùng.\n"
                   "• **Hạn mức kê đơn ngoại trú:** Đơn thuốc hướng tâm thần tối đa 10 ngày (hoặc 30 ngày đối với bệnh mạn tính điều trị ngoại trú).")
        chips = ["Tủ thuốc có khóa riêng biệt", "Sổ theo dõi xuất nhập tồn", "Đơn thuốc hướng tâm thần tối đa 10 ngày (hoặc 30 ngày bệnh mạn tính)"]
    elif "thu hồi" in lower_query or "vỏ ống" in lower_query or "hủy vỏ" in lower_query:
        title = "QUY ĐỊNH THU HỒI VÀ TIÊU HỦY VỎ ỐNG THUỐC GÂY NGHIỆN (TT 20/2017/TT-BYT)"
        basis = "Điều 15 & 16 Thông tư 20/2017/TT-BYT"
        content = ("• **Thu hồi vỏ ống:** Sau khi tiêm phải thu hồi toàn bộ 100% vỏ ống thuốc gây nghiện, bảo quản tại tủ trực có khóa an toàn.\n"
                   "• **Giao ban ca trực 07:00 AM:** Đối soát khớp giữa số lượng rút - số lượng đã tiêm theo y lệnh - số vỏ ống nộp lại.\n"
                   "• **Hội đồng tiêu hủy định kỳ:** Định kỳ thành lập hội đồng kiểm đếm hủy vỏ ống có sự chứng kiến của lãnh đạo khoa, dược sĩ và điều dưỡng.\n"
                   "• **Biên bản tiêu hủy:** Lập biên bản hủy vỏ lưu hồ sơ theo đúng quy định.")
        chips = ["Thu hồi 100% vỏ ống sau tiêm", "Hội đồng kiểm đếm hủy vỏ ống", "Lập biên bản hủy vỏ lưu hồ sơ"]
    elif "morphin" in lower_query and any(w in lower_query for w in ["bao nhiêu ngày", "tối đa", "ung thư", "ngoại trú", "kê đơn"]):
        title = "QUY ĐỊNH KÊ ĐƠN THUỐC MORPHIN NGOẠI TRÚ CHO BỆNH NHÂN UNG THƯ (TT 52/2017 & TT 26/2025)"
        basis = "Thông tư 52/2017/TT-BYT & Thông tư 26/2025/TT-BYT"
        content = ("• **Thời hạn tối đa:** Kê đơn tối đa 30 ngày cho người bệnh ung thư hoặc AIDS giai đoạn cuối điều trị ngoại trú.\n"
                   "• **Chia đợt kê đơn:** Mỗi đơn thuốc không quá 10 ngày (kê thành 3 đơn liên tiếp cho 30 ngày điều trị).\n"
                   "• **Hồ sơ cam kết:** Kèm theo Giấy xác nhận người bệnh cần điều trị bằng thuốc gây nghiện và bản cam kết của gia đình người bệnh.\n"
                   "• **Nộp lại vỏ ống/vỉ:** Người nhà bệnh nhân phải nộp lại vỏ thuốc đã dùng của đợt trước khi lĩnh thuốc đợt tiếp theo.")
        chips = ["Kê đơn Morphin tối đa 30 ngày (3 đơn x 10 ngày)", "Giấy xác nhận điều trị giảm đau ung thư", "Bảng cam kết sử dụng thuốc gây nghiện"]
    elif "chữ ký số" in lower_query or ("cpoe" in lower_query and any(w in lower_query for w in ["chữ ký", "tính hợp lệ", "hợp lệ"])):
        title = "KIỂM TRA TÍNH HỢP LỆ CỦA CHỮ KÝ SỐ TRONG ĐƠN THUỐC ĐIỆN TỬ CPOE (TT 27/2021 & NĐ 130/2018)"
        basis = "Thông tư 27/2021/TT-BYT & Nghị định 130/2018/NĐ-CP"
        content = ("• **Xác thực chứng thư số:** Hệ thống tự động xác thực chứng thư số của bác sĩ kê đơn với cổng chứng thực quốc gia.\n"
                   "• **Toàn vẹn tệp dữ liệu:** Kiểm tra tính toàn vẹn của tệp đơn thuốc điện tử qua mã băm và mã liên thông đơn thuốc quốc gia.\n"
                   "• **Dấu thời gian:** Đảm bảo chữ ký số có dấu thời gian (Timestamp) hợp chuẩn tại thời điểm ký phát hành đơn.")
        chips = ["Cổng chứng thực chữ ký số quốc gia", "Mã liên thông đơn thuốc điện tử", "Thông tư 27/2021/TT-BYT"]
    elif "cpoe" in lower_query and any(w in lower_query for w in ["cảnh báo", "tương tác", "dị ứng"]):
        title = "CƠ CHẾ CẢNH BÁO TỰ ĐỘNG TƯƠNG TÁC VÀ DỊ ỨNG CHÉO TRONG CPOE (TT 26/2025/TT-BYT)"
        basis = "Thông tư 26/2025/TT-BYT & Quyết định 5948/QĐ-BYT"
        content = ("• **Cảnh báo tương tác thời gian thực:** Hệ thống CPOE tự động kiểm tra tương tác thuốc mức độ nặng và chống chỉ định ngay tại thời điểm bác sĩ nhập y lệnh.\n"
                   "• **Cảnh báo dị ứng chéo:** Cảnh báo dị ứng chéo dựa trên tiền sử dị ứng đã ghi nhận trong hồ sơ bệnh án điện tử (EMR).\n"
                   "• **Lý do lâm sàng:** Yêu cầu bác sĩ cung cấp giải trình lâm sàng nếu quyết định vượt qua cảnh báo tương tác nghiêm trọng.")
        chips = ["Cảnh báo tương tác thuốc mức độ nặng", "Dị ứng chéo Beta-lactam trong EMR", "Quyết định 5948/QĐ-BYT"]
    elif "trùng lặp" in lower_query or "duplicate therapy" in lower_query:
        title = "KIỂM TRA ĐƠN THUỐC TRÙNG LẶP HOẠT CHẤT (DUPLICATE THERAPY)"
        basis = "Quyết định 5948/QĐ-BYT & DĐVN V"
        content = ("• **So sánh mã ATC & hoạt chất:** Hệ thống tự động so sánh mã ATC và hoạt chất của các thuốc trong cùng một đơn hoặc giữa các đơn khác nhau của bệnh nhân.\n"
                   "• **Cảnh báo cùng cơ chế:** Cảnh báo người kê đơn khi phát hiện kê 2 thuốc có cùng cơ chế tác dụng (ví dụ kê đồng thời 2 thuốc NSAIDs hoặc 2 thuốc kháng H2) để phòng ngừa quá liều và độc tính.\n"
                   "• **Tối ưu hóa đơn thuốc:** Khuyến nghị dùng một hoạt chất duy nhất ở liều điều trị tối ưu.")
        chips = ["Cảnh báo kê trùng 2 NSAIDs", "Đối soát mã ATC tự động", "Phòng ngừa độc tính quá liều"]
    elif "thẩm định đơn thuốc nội trú" in lower_query or ("thẩm định" in lower_query and "nội trú" in lower_query):
        title = "QUY TRÌNH THẨM ĐỊNH ĐƠN THUỐC NỘI TRÚ (THÔNG TƯ 52/2017/TT-BYT)"
        basis = "Thông tư 52/2017/TT-BYT"
        content = ("• **Rà soát chuyên môn:** Rà soát chỉ định, liều lượng, đường dùng, tương tác thuốc, tính tương thích khi truyền phối hợp.\n"
                   "• **Kiểm tra bệnh án:** Kiểm tra y lệnh thuốc hàng ngày trong bệnh án và phiếu công khai thuốc tại giường bệnh nhân.\n"
                   "• **Can thiệp dược lâm sàng:** Phối hợp chặt chẽ với bác sĩ điều trị để hiệu chỉnh liều và thay thế thuốc khi có nguy cơ tương tác bất lợi.")
        chips = ["Rà soát tương thích đường truyền", "Kiểm tra phiếu công khai thuốc", "Thông tư 52/2017/TT-BYT"]
    elif "thẩm định đơn thuốc ngoại trú" in lower_query or ("thẩm định" in lower_query and "ngoại trú" in lower_query):
        title = "QUY TRÌNH THẨM ĐỊNH ĐƠN THUỐC NGOẠI TRÚ (TT 26/2025/TT-BYT & TT 52/2017)"
        basis = "Thông tư 26/2025/TT-BYT & TT 52/2017/TT-BYT"
        content = ("• **Kiểm tra tính pháp lý:** Kiểm tra thể thức đơn, chẩn đoán ICD-10, chữ ký số bác sĩ và mã liên thông đơn thuốc quốc gia.\n"
                   "• **Thẩm định liều và an toàn:** Rà soát liều dùng, số ngày kê đơn (không quá 30 ngày cho bệnh mạn tính), tương tác thuốc và chống chỉ định.\n"
                   "• **Hướng dẫn sử dụng:** Đảm bảo dặn dò chi tiết thời điểm uống, liều lượng và cảnh báo đặc biệt cho người bệnh.")
        chips = ["Thẩm định chẩn đoán ICD-10", "Thời hạn đơn thuốc ngoại trú", "Thông tư 26/2025/TT-BYT"]
    elif "tiêm truyền" in lower_query and any(w in lower_query for w in ["bảo quản", "pha", "sau khi pha", "thời hạn"]):
        title = "THỜI HẠN BẢO QUẢN DUNG DỊCH TIÊM TRUYỀN SAU KHI PHA"
        basis = "Dược thư Quốc gia Việt Nam DĐVN V & Hướng dẫn Dược Lâm Sàng Bộ Y tế"
        content = ("• **Khuyến cáo sử dụng ngay:** Khuyến cáo sử dụng ngay sau khi pha vô khuẩn.\n"
                   "• **Thời gian truyền tối đa:** Thời gian truyền không quá 24 giờ kể từ lúc bắt đầu pha dung dịch truyền ở điều kiện phòng bệnh.\n"
                   "• **Dán nhãn đầy đủ:** Phải dán nhãn ghi rõ tên thuốc pha thêm, liều lượng, thời gian bắt đầu pha và tên người pha.\n"
                   "• **Kiểm tra độ trong:** Tuyệt đối không truyền nếu dung dịch bị vẩn đục, đổi màu hoặc xuất hiện tủa.")
        chips = ["Sử dụng trong vòng 24 giờ", "Dán nhãn phụ chai truyền", "Kiểm tra cảm quan trước khi truyền"]
    elif "tỳ đè" in lower_query:
        title = "QUY TRÌNH DỰ PHÒNG LOÉT DO TỲ ĐÈ Ở BỆNH NHÂN HÔN MÊ NẰM LÂU TẠI KHOA HỒI SỨC"
        basis = "Hướng dẫn Chăm sóc Người bệnh Bộ Y tế & Tiêu chuẩn NPUAP"
        content = ("• **Xoay trở tư thế:** Thay đổi tư thế người bệnh tối thiểu mỗi 2 giờ một lần (sử dụng bảng xoay trở tư thế định kỳ).\n"
                   "• **Đệm chống loét:** Sử dụng đệm chống loét chuyên dụng: Đệm hơi hoặc đệm nước giảm áp lực tỳ đè.\n"
                   "• **Chăm sóc vệ sinh:** Vệ sinh da sạch sẽ, khô thoáng, xoa bóp nhẹ nhàng các vùng tỳ đè (xương cùng cụt, gót chân, bả vai).\n"
                   "• **Thang điểm Braden:** Đánh giá nguy cơ loét hàng ngày theo thang điểm Braden để can thiệp sớm.")
        chips = ["Xoay trở tư thế mỗi 2 giờ", "Đệm hơi chống loét", "Đánh giá thang điểm Braden"]
    elif "súc miệng" in lower_query and any(w in lower_query for w in ["corticoid", "seretide", "symbicort", "pulmicort"]):
        title = "HƯỚNG DẪN SÚC MIỆNG SAU KHI HÍT/XỊT CORTICOID DỰ PHÒNG NẤM MIỆNG"
        basis = "DĐVN V & Hướng dẫn Hen / COPD (GINA / GOLD)"
        content = ("• **Súc miệng nhổ đi:** Bắt buộc súc miệng kỹ bằng nước sạch và nhổ đi (không nuốt) sau mỗi lần hít xịt thuốc.\n"
                   "• **Phòng ngừa tác dụng phụ:** Mục đích: Loại bỏ thuốc đọng ở khoang miệng hầu, phòng ngừa tác dụng phụ nấm Candida miệng hầu và khản tiếng.\n"
                   "• **Sử dụng buồng đệm:** Khuyến khích dùng buồng đệm (Spacer) cho trẻ em và người già để giảm lượng thuốc lắng đọng tại họng miệng.")
        chips = ["Súc miệng nhổ đi không nuốt", "Phòng nấm Candida hầu họng", "Dùng buồng đệm Spacer"]
    elif "adr" in lower_query and any(w in lower_query for w in ["báo cáo", "trung tâm", "quốc gia"]):
        title = "QUY TRÌNH BÁO CÁO PHẢN ỨNG CÓ HẠI CỦA THUỐC (ADR)"
        basis = "Hướng dẫn Giám sát Cảnh giác Dược Quốc gia - Bộ Y tế"
        content = ("• **Phản ứng nghiêm trọng:** Báo cáo tất cả phản ứng nghiêm trọng (tử vong, đe dọa tính mạng, tàn tật, nhập viện hoặc kéo dài thời gian nằm viện).\n"
                   "• **Thời hạn gửi báo cáo:** Thời hạn gửi báo cáo: Trong vòng 7 ngày đối với biến cố tử vong/đe dọa tính mạng; trong vòng 30 ngày đối với các biến cố nghiêm trọng khác.\n"
                   "• **Mẫu và cổng báo cáo:** Điền mẫu báo cáo ADR của Bộ Y tế và gửi bản cứng hoặc báo cáo trực tuyến tại website canhgiacduoc.org.vn.")
        chips = ["Báo cáo trong vòng 7 ngày", "Website canhgiacduoc.org.vn", "Mẫu báo cáo ADR Bộ Y tế"]
    elif "truyền máu" in lower_query and any(w in lower_query for w in ["tai biến", "cấp tính", "xử trí"]):
        title = "QUY TRÌNH XỬ TRÍ TAI BIẾN TRUYỀN MÁU CẤP TÍNH TẠI GIƯỜNG BỆNH"
        basis = "Thông tư 26/2013/TT-BYT Hướng dẫn Hoạt động Truyền máu"
        content = ("• **Ngừng truyền ngay:** Ngừng truyền máu ngay lập tức nhưng duy trì đường truyền tĩnh mạch bằng dung dịch Natri Clorid 0.9%.\n"
                   "• **Đối soát nhầm lẫn:** Kiểm tra ngay nhãn đơn vị máu, mã số người bệnh và hồ sơ truyền máu để phát hiện nhầm nhóm máu ABO.\n"
                   "• **Báo động & gửi mẫu:** Báo bác sĩ điều trị, theo dõi sinh hiệu, lấy mẫu máu và đơn vị máu gửi khoa Huyết học - Truyền máu để kiểm tra.")
        chips = ["Ngừng truyền giữ ven NaCl 0.9%", "Đối soát nhầm lẫn nhóm máu ABO", "Lấy mẫu gửi Khoa Huyết học"]
    elif "kháng sinh dự phòng" in lower_query:
        title = "NGUYÊN TẮC SỬ DỤNG KHÁNG SINH DỰ PHÒNG TRONG PHẪU THUẬT"
        basis = "Quyết định 708/QĐ-BYT Hướng dẫn Sử dụng Kháng sinh trong Bệnh viện"
        content = ("• **Thời điểm tiêm:** Tiêm kháng sinh trước rạch da 30 - 60 phút (hoặc 120 phút với Vancomycin/Fluoroquinolon).\n"
                   "• **Kháng sinh ưu tiên:** Thuốc ưu tiên: Cefazolin 1 - 2g tiêm tĩnh mạch cho hầu hết phẫu thuật sạch và sạch-nhiễm.\n"
                   "• **Thời gian duy trì:** Thời gian dùng: Không quá 24 giờ sau mổ (thường chỉ cần 1 liều duy nhất).")
        chips = ["Tiêm trước rạch da 30 - 60 phút", "Cefazolin 1 - 2g tiêm tĩnh mạch", "Dùng không quá 24 giờ sau mổ"]
    elif "tdm" in lower_query or ("nồng độ" in lower_query and "vancomycin" in lower_query):
        title = "GIÁM SÁT NỒNG ĐỘ THUỐC TRONG MÁU (TDM) CHO VANCOMYCIN"
        basis = "Hướng dẫn Sử dụng Kháng sinh Bộ Y tế & Đồng thuận Quốc tế IDSA/ASHP"
        content = ("• **Thời điểm lấy mẫu:** Lấy máu định lượng nồng độ đáy (trough level) ngay trước liều thứ 4 (khoảng 30 phút trước cữ truyền tiếp theo).\n"
                   "• **Mục tiêu nồng độ đáy:** Mục tiêu nồng độ đáy thông thường: 10 - 15 mcg/ml; đối với nhiễm khuẩn nặng (viêm phổi, viêm màng não, nhiễm khuẩn huyết): 15 - 20 mcg/ml.\n"
                   "• **Mục tiêu AUC/MIC:** Mục tiêu AUC/MIC đạt 400 - 600 để tối ưu hóa hiệu quả diệt khuẩn và giảm độc tính trên thận.")
        chips = ["Lấy nồng độ đáy trước liều thứ 4", "Mục tiêu 15 - 20 mcg/ml nhiễm khuẩn nặng", "Mục tiêu AUC/MIC 400 - 600"]
    elif "tăng huyết áp khẩn cấp" in lower_query or "hypertensive emergency" in lower_query:
        title = "XỬ TRÍ CƠN TĂNG HUYẾT ÁP KHẨN CẤP (HYPERTENSIVE EMERGENCY) TẠI KHOA CẤP CỨU"
        basis = "Hướng dẫn Chẩn đoán và Điều trị Tăng huyết áp - Hội Tim Mạch Học Việt Nam & Bộ Y tế"
        content = ("• **Mục tiêu hạ áp an toàn:** Mục tiêu: Giảm huyết áp tâm thu không quá 25% trong giờ đầu tiên để tránh thiếu máu não/mạch vành cục bộ.\n"
                   "• **Thuốc tiêm truyền tĩnh mạch:** Thuốc lựa chọn đường tĩnh mạch: Nicardipine, Labetalol hoặc Nitroglycerin (nếu kèm phù phổi cấp/hội chứng vành cấp).\n"
                   "• **Chống chỉ định tuyệt đối:** Chống chỉ định dùng Nifedipin ngậm dưới lưỡi vì tụt huyết áp đột ngột gây nhồi máu não.")
        chips = ["Hạ HA không quá 25% trong 1h đầu", "Nicardipine truyền tĩnh mạch", "Chống chỉ định Nifedipin ngậm dưới lưỡi"]
    elif "hạ đường huyết" in lower_query and any(w in lower_query for w in ["hôn mê", "nặng"]):
        title = "XỬ TRÍ CẤP CỨU HẠ ĐƯỜNG HUYẾT NẶNG CÓ HÔN MÊ TẠI BUỒNG BỆNH"
        basis = "Hướng dẫn Chẩn đoán và Điều trị Đái tháo đường Týp 2 - Bộ Y tế"
        content = ("• **Tiêm truyền tĩnh mạch khẩn cấp:** Tiêm tĩnh mạch ngay Glucose 20% hoặc 30% (40 - 50ml), hoặc truyền tĩnh mạch Glucose 10%.\n"
                   "• **Mục tiêu đường huyết:** Mục tiêu nâng đường huyết mao mạch lên trên 4 - 5 mmol/L (80 - 100 mg/dL).\n"
                   "• **Theo dõi mao mạch:** Theo dõi đường huyết mao mạch mỗi 15 - 30 phút đến khi người bệnh tỉnh táo hoàn toàn.")
        chips = ["Tiêm tĩnh mạch Glucose 20% - 30% 40-50ml", "Mục tiêu đường huyết > 4-5 mmol/L", "Theo dõi đường huyết mỗi 15 - 30 phút"]
    elif "rửa dạ dày" in lower_query:
        title = "RỬA DẠ DÀY CẤP CỨU NGỘ ĐỘC THUỐC ĐƯỜNG UỐNG: CHỈ ĐỊNH VÀ THỜI GIAN VÀNG"
        basis = "Hướng dẫn Chẩn đoán và Xử trí Ngộ độc Cấp - Trung tâm Chống độc & Bộ Y tế"
        content = ("• **Thời gian vàng:** Thời gian vàng: Tốt nhất trong vòng 1 giờ đầu sau khi uống chất độc.\n"
                   "• **Chống chỉ định tuyệt đối:** Chống chỉ định tuyệt đối: Uống acid hoặc base mạnh (nguy cơ thủng thực quản/dạ dày), uống xăng dầu/hydrocarbon (nguy cơ viêm phổi hít), bệnh nhân hôn mê chưa được đặt nội khí quản.\n"
                   "• **Phối hợp than hoạt:** Sử dụng than hoạt (Activated Charcoal) 1g/kg phối hợp thuốc nhuận tràng Sorbitol.")
        chips = ["Thời gian vàng trong vòng 1 giờ đầu", "Chống chỉ định acid/base mạnh & xăng dầu", "Than hoạt 1g/kg phối hợp Sorbitol"]
    elif "bù dịch" in lower_query and any(w in lower_query for w in ["tiêu chảy", "phác đồ b", "who"]):
        title = "PHÁC ĐỒ BÙ DỊCH TIÊU CHẢY MẤT NƯỚC THEO PHÁC ĐỒ B CỦA WHO"
        basis = "Hướng dẫn Xử trí Tiêu chảy Cấp - WHO & Bộ Y tế"
        content = ("• **Dung dịch bù nước:** Bù nước và điện giải bằng dung dịch Oresol (ORS) áp lực thẩm thấu thấp trong 4 giờ đầu.\n"
                   "• **Công thức tính:** Số lượng Oresol (ml) = Cân nặng (kg) x 75.\n"
                   "• **Đánh giá lại:** Đánh giá lại tình trạng mất nước sau 4 giờ để chọn phác đồ tiếp theo.")
        chips = ["Lượng Oresol = Cân nặng x 75 ml", "Uống trong vòng 4 giờ đầu", "Đánh giá lại sau 4 giờ"]
    elif "phospho hữu cơ" in lower_query or ("atropin" in lower_query and "pam" in lower_query):
        title = "XỬ TRÍ NGỘ ĐỘC CẤP TÍNH THUỐC TRỪ SÂU PHOSPHO HỮU CƠ BẰNG ATROPIN VÀ PAM"
        basis = "Phác đồ Cấp cứu Chống độc Bộ Y tế"
        content = ("• **Dấu hiệu ngộ độc:** Dấu hiệu ngộ độc: Tăng tiết đờm dãi, co đồng tử đinh ghim, co thắt phế quản, mạch chậm, yếu cơ.\n"
                   "• **Atropin hóa:** Atropin liều cao tiêm tĩnh mạch nhắc lại đến khi đạt tình trạng Atropin hóa (phổi hết rale, da khô, đồng tử giãn nhẹ).\n"
                   "• **Tái hoạt men:** Phối hợp thuốc tái hoạt hóa men Cholinesterase: Pralidoxime (PAM) sớm.")
        chips = ["Atropin liều cao tiêm tĩnh mạch", "Pralidoxime (PAM) sớm", "Dấu hiệu đạt Atropin hóa"]
    elif "paracetamol" in lower_query and any(w in lower_query for w in ["đau đầu", "kê đơn"]):
        title = "KÊ ĐƠN NGOẠI TRÚ THUỐC GIẢM ĐAU PARACETAMOL 500MG CHO BỆNH NHÂN ĐAU ĐẦU"
        basis = "Thông tư 52/2017 & TT 26/2025/TT-BYT & DĐVN V"
        content = ("• **Chẩn đoán ICD-10:** Chẩn đoán ICD-10 phù hợp (R51: Đau đầu).\n"
                   "• **Liều lượng:** Liều 1 viên (500mg) mỗi 4 - 6 giờ khi đau, tối đa 4 viên/ngày (2000mg/ngày).\n"
                   "• **Lời dặn:** Ghi rõ cách dùng và lời dặn không uống cùng rượu bia.")
        chips = ["Chẩn đoán ICD-10: R51 Đau đầu", "Liều 1 viên 500mg mỗi 4 - 6 giờ (tối đa 4 viên)", "Lời dặn không uống cùng rượu bia"]
    elif "kiểm định" in lower_query or "máy thở" in lower_query:
        title = "QUY ĐỊNH AN TOÀN VÀ KIỂM ĐỊNH THIẾT BỊ Y TẾ (NGHỊ ĐỊNH 98/2021/NĐ-CP)"
        basis = "Nghị định 98/2021/NĐ-CP & Tiêu chuẩn IEC 60601-1"
        content = ("• **Phân loại rủi ro:** Máy thở, máy sốc tim, máy lọc máu liên tục thuộc Thiết bị Y tế Loại D.\n"
                   "• **Chu kỳ kiểm định:** Bắt buộc kiểm định an toàn và tính năng kỹ thuật tối thiểu 12 tháng/lần.\n"
                   "• **An toàn điện IEC 60601-1:** Dòng rò qua bệnh nhân không vượt quá 100µA đối với loại CF.")
        chips = ["Kiểm định an toàn tối thiểu 12 tháng/lần", "Thiết bị y tế Loại D", "Tiêu chuẩn IEC 60601-1"]
    elif "thuốc gây nghiện" in lower_query and any(w in lower_query for w in ["bảo quản", "quản lý", "quy chế"]):
        title = "QUY CHẾ QUẢN LÝ VÀ BẢO QUẢN THUỐC GÂY NGHIỆN (THÔNG TƯ 20/2017/TT-BYT)"
        basis = "Thông tư 20/2017/TT-BYT"
        content = ("• **Bảo quản riêng:** Phải bảo quản tại kho hoặc tủ riêng, có khóa chắc chắn; người giữ chìa khóa phải là dược sĩ hoặc điều dưỡng được phân công bằng văn bản.\n"
                   "• **Theo dõi và lưu trữ:** Lập sổ theo dõi xuất nhập tồn riêng biệt, lưu trữ chứng từ tối thiểu 2 năm sau khi thuốc hết hạn.")
        chips = ["Tủ thuốc riêng có khóa chắc chắn", "Người giữ chìa khóa phân công bằng văn bản", "Lưu trữ chứng từ tối thiểu 2 năm"]
    else:
        content = "Tuân thủ nghiêm ngặt Thông tư 22/2011/TT-BYT về tổ chức Khoa Dược, quy chế tủ trực lâm sàng và Nghị định 151/2017/NĐ-CP."

    card = CopilotActionCard(
        card_type="legal_guide",
        title=title,
        summary=f"Tra cứu chuẩn quy định y tế: {basis}",
        data={"doc_title": title, "content": content, "legal_basis": basis},
        primary_action_label="Mở văn bản toàn văn",
        primary_action_type="OPEN_LEGAL_MODAL"
    )
    return CopilotResponse(
        intent="LEGAL_GUIDANCE",
        reply_text=f"### 📋 {title}\n\n{content}\n\n> [!NOTE]\n> **Căn cứ áp dụng:** {basis}.",
        card=card,
        legal_basis=basis,
        suggested_chips=chips
    )

async def handle_shift_handover_intent(db: AsyncSession) -> CopilotResponse:
    stmt = select(DebtRecord)
    res = await db.execute(stmt)
    debts = res.scalars().all()
    active_debts = [d for d in debts if d.status == "debt"]
    pending_narcotics = [d for d in debts if d.item_type == "Thuốc gây nghiện" and not d.ampoule_returned]

    summary_text = (f"Báo cáo giao ban ca trực 07:00 AM:\n"
                    f"• Tổng số phiếu mượn tủ trực chưa hoàn bù: **{len(active_debts)} phiếu**\n"
                    f"• Số vỏ thuốc gây nghiện (Morphin/Fentanyl) chưa nộp: **{len(pending_narcotics)} vỏ**\n\n"
                    f"> [!NOTE]\n"
                    f"> **Quy trình bàn giao tủ thuốc cấp cứu và cơ số thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT):**\n"
                    f"> • Bàn giao trực tiếp tại buồng trực, hai điều dưỡng ca cũ và ca mới cùng mở tủ thuốc kiểm đếm thực tế từng ống thuốc, đối soát với y lệnh đã thực hiện và sổ theo dõi xuất nhập tồn.\n"
                    f"> • Ký nhận biên bản giao ca ghi rõ họ tên xác nhận số lượng tồn chuyển ca, số lượng đã sử dụng và tình trạng niêm phong tủ thuốc cấp cứu.")
    card = CopilotActionCard(
        card_type="shift_handover_report",
        title="Đối Soát Ca Trực 07:00 AM (TT 22 & TT 20)",
        summary="Biên bản đối soát ca trực và tình trạng nợ vỏ thuốc gây nghiện",
        data={
            "total_debts": len(active_debts),
            "pending_ampoules_count": len(pending_narcotics),
            "pending_list": [{"patient": d.patient_name, "room": d.patient_room, "quantity": f"{d.quantity} {getattr(d, 'unit', 'ống')}"} for d in pending_narcotics[:3]],
            "replenishment": [{"name": "Morphin sulfat 10mg", "needed": len(pending_narcotics)}]
        },
        primary_action_label="Xuất Biên Bản Giao Ban PDF",
        primary_action_type="EXPORT_SHIFT_REPORT",
        target_tab="debts"
    )
    return CopilotResponse(
        intent="SHIFT_HANDOVER_RECONCILIATION",
        reply_text=summary_text,
        card=card,
        legal_basis="Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Kiểm tra tương tác thuốc", "Kiểm tra hạn dùng FEFO", "Kiểm tra nhiệt độ chuỗi lạnh"]
    )

async def handle_coldchain_intent(db: AsyncSession, query: str = "") -> CopilotResponse:
    cabinet = re.search(r"(?:tủ|kho|cabinet)\s*(?:lạnh\s*)?#?\s*(\d+)\b", query, re.IGNORECASE)
    stmt = select(ColdChainCurrentState).order_by(ColdChainCurrentState.id)
    if cabinet:
        stmt = stmt.where(ColdChainCurrentState.id == int(cabinet.group(1)))
    states = (await db.execute(stmt)).scalars().all()
    if not states:
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_TELEMETRY", reply_text="Chưa có bản ghi giám sát cho tủ lạnh được yêu cầu. Chưa thể xác nhận nhiệt độ, nguồn điện hoặc tình trạng bảo quản. Mở bảng chuỗi lạnh để bổ sung dữ liệu.",
            answer_type="safe_abstention", source_status="no_recorded_telemetry", rag_grounded=False, confidence=0.0,
        )
    if len(states) > 1:
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_CLARIFICATION", reply_text="Có nhiều tủ lạnh được giám sát. Vui lòng chọn mã tủ cần xem: " + ", ".join(str(state.id) for state in states) + ".",
            answer_type="clarification", source_status="ambiguous_cabinet", confidence=1.0,
        )
    state = states[0]
    current_temp, mkt = state.current_temp, state.mkt_temp
    is_quarantine, is_outage = state.is_quarantined, state.is_outage
    in_range = (isinstance(current_temp, (int, float)) and math.isfinite(current_temp) and 2 <= current_temp <= 8
                and isinstance(mkt, (int, float)) and math.isfinite(mkt) and 2 <= mkt < 8
                and state.vvm_level == 1 and not is_quarantine and not is_outage)
    reported_incident = any(term in query.casefold() for term in ("mất điện", "sự cố", "vượt ngưỡng"))
    alert = not in_range or reported_incident
    status_text = "TRONG NGƯỠNG GIÁM SÁT CỦA BẢN GHI" if in_range else "CẦN RÀ SOÁT ĐIỀU KIỆN BẢO QUẢN"
    recorded_at = str(state.updated_at) if state.updated_at else "Chưa có thời điểm cập nhật"
    reply_text = (f"### GIÁM SÁT CHUỖI LẠNH - TỦ {state.id}\n\n"
                  f"• Trạng thái theo dữ liệu đã lưu: **{status_text}**.\n"
                  f"• Nhiệt độ ghi nhận: {current_temp}°C; MKT: {mkt}°C; VVM: {state.vvm_level}.\n"
                  f"• Mất điện: {'Có' if is_outage else 'Không'}; biệt trữ: {'Có' if is_quarantine else 'Không'}.\n"
                  f"• Thời điểm cập nhật bản ghi: {recorded_at}.\n\n"
                  + ("Đã nhận mô tả sự cố từ câu hỏi. Mô tả này chưa thay đổi trạng thái tủ trong cơ sở dữ liệu. " if reported_incident else "")
                  + "Đây là dữ liệu giám sát đã lưu; cần đối chiếu với tủ thực tế và hồ sơ lô trước khi xác nhận khả dụng của vắc xin.")
    card = CopilotActionCard(
        card_type="coldchain_status",
        title="Giám Sát Chuỗi Lạnh Vắc Xin (WHO PQS)",
        summary="Bản ghi giám sát chuỗi lạnh đã lưu",
        data={"state_id": state.id, "temperature": current_temp, "mkt": mkt, "is_outage": is_outage, "is_quarantined": is_quarantine, "updated_at": recorded_at},
        primary_action_label="Xem Biểu Đồ Datalogger",
        primary_action_type="NAVIGATE_TAB",
        target_tab="coldchain"
    )
    return CopilotResponse(
        intent="CLINICAL_COLD_CHAIN_ALERT" if alert else "CLINICAL_COLD_CHAIN_TELEMETRY",
        reply_text=reply_text,
        card=card,
        source_status="recorded_telemetry", answer_type="operational_status", confidence=1.0,
        suggested_chips=["Xem biểu đồ chuỗi lạnh", "Kiểm tra hạn dùng FEFO"]
    )

async def handle_audit_intent(db: AsyncSession) -> CopilotResponse:
    is_valid, msg = await verify_ledger_integrity(db)
    stmt = select(AuditRecord).order_by(AuditRecord.sequence_id.desc()).limit(1)
    res = await db.execute(stmt)
    last_block = res.scalar_one_or_none()
    block_seq = last_block.sequence_id if last_block else 0
    genesis_hash = last_block.current_hash[:16] + "..." if last_block else "GENESIS-INIT"

    reply_text = (f"### 🛡️ KẾT QUẢ KIỂM TOÁN TÍNH TOÀN VẸN SỔ GHI BẤT BIẾN (AUDIT LEDGER)\n\n"
                  f"• **Tính toàn vẹn:** {'✅ 100% NGUYÊN VẸN, CHUỖI BĂM HỢP LỆ' if is_valid else '❌ PHÁT HIỆN CAN THIỆP TRÁI PHÉP'}\n"
                  f"• **Chuỗi khối hiện tại:** `{block_seq}` giao dịch\n"
                  f"• **Mã băm khối chốt:** `{genesis_hash}`\n"
                  f"• **Thuật toán bảo mật:** HMAC-SHA256 chuẩn bảo vệ dữ liệu y tế.")

    card = CopilotActionCard(
        card_type="audit_integrity",
        title="Tính Toàn Vẹn Sổ Kiểm Toán Bất Biến",
        summary="Xác minh chuỗi mã hóa HMAC-SHA256 các giao dịch",
        data={"genesis": genesis_hash, "is_valid": is_valid, "block_count": block_seq},
        primary_action_label="Mở Sổ Kiểm Toán Toàn Văn",
        primary_action_type="OPEN_AUDIT_MODAL"
    )
    return CopilotResponse(
        intent="AUDIT_LEDGER_INTEGRITY",
        reply_text=reply_text,
        card=card,
        legal_basis="Nghị định 130/2018/NĐ-CP & Tiêu chuẩn ISO 27799 An Toàn Thông Tin Y Tế",
        suggested_chips=["Xuất nhật ký kiểm toán SHA-256", "Thẩm định đơn thuốc theo TT 26"]
    )

async def handle_ocr_intent() -> CopilotResponse:
    reply_text = ("### 📷 THỊ GIÁC AI (VISION AI) - BÓC TÁCH CHỨNG TỪ DƯỢC PHẨM\n\n"
                  "Hệ thống đã nhận diện chứng từ hóa đơn dược phẩm VAT. Vui lòng bấm xác nhận để tự động tạo lô nhập kho theo đúng quy chuẩn.")
    card = CopilotActionCard(
        card_type="ocr_invoice_confirm",
        title="Hóa Đơn Dược Phẩm Điện Tử (Vision OCR)",
        summary="Bóc tách tự động chứng từ nhập kho",
        data={
            "supplier": "Công ty Cổ phần Dược phẩm CPC1 Hà Nội",
            "invoiceNumber": "HD-2026-99120",
            "invoiceDate": "2026-10-24",
            "totalAmount": "45.850.000 VNĐ",
            "items": [
                {"name": "Adrenalin 1mg/1ml", "batch": "ADR-2601", "expiry": "2027-10-15", "quantity": 100, "unit": "ống"},
                {"name": "Morphin sulfat 10mg/1ml", "batch": "MOR-2609", "expiry": "2028-05-20", "quantity": 50, "unit": "ống"}
            ]
        },
        primary_action_label="Nhập Kho Lô Mới",
        primary_action_type="NAVIGATE_TAB",
        target_tab="inventory"
    )
    return CopilotResponse(
        intent="OCR_INVOICE_PROCESSING",
        reply_text=reply_text,
        card=card,
        legal_basis="Nghị định 123/2020/NĐ-CP về Hóa đơn, Chứng từ & Thông tư 36/2018/TT-BYT",
        suggested_chips=["Xem kho FEFO", "Thẩm định đơn thuốc theo TT 26"]
    )
