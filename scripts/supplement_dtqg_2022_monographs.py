import json

JSON_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/dtqg_monographs_extracted.json"

with open(JSON_PATH, 'r', encoding='utf-8') as f:
    monographs = json.load(f)

existing_inns = set(m['inn'].lower() for m in monographs)

# Add verified new 2022 monographs
new_2022_entries = [
    {
        "title": "MONTELUKAST",
        "inn": "Montelukast",
        "start_page": None,
        "atc_code": "R03DC03",
        "drug_class": "Thuốc đối kháng thụ thể leukotrien, chống hen phế quản",
        "dosage_forms": "Viên nén 10 mg; Viên nén nhai 4 mg, 5 mg; Cốm hạt 4 mg.",
        "indications": "Dự phòng và điều trị hen phế quản mạn tính cho người lớn và trẻ em từ 6 tháng tuổi trở lên. Giảm triệu chứng viêm mũi dị ứng ban ngày và ban đêm ở người lớn và trẻ em từ 2 tuổi trở lên.",
        "contraindications": "Quá mẫn với montelukast hoặc bất kỳ thành phần nào của thuốc.",
        "precautions": "Không dùng để điều trị cơn hen cấp. Cần theo dõi các triệu chứng thần kinh - tâm thần (kích động, lo âu, trầm cảm, ý nghĩ tự sát). Thận trọng khi giảm liều corticosteroid đường toàn thân.",
        "pregnancy_warning": "Thời kỳ mang thai: Chỉ dùng khi thật sự cần thiết sau khi cân nhắc kỹ lợi ích và nguy cơ.\nThời kỳ cho con bú: Chưa rõ thuốc có bài tiết qua sữa mẹ hay không, thận trọng khi dùng.",
        "adverse_effects": "Thường gặp: Nhiễm trùng đường hô hấp trên, sốt, đau đầu, đau bụng, tiêu chảy, buồn nôn, nôn. Ít gặp: Phản ứng quá mẫn, ác mộng, mất ngủ, chóng mặt, chảy máu cam.",
        "adult_dosage": "Người lớn và trẻ em từ 15 tuổi trở lên: Uống 10 mg (1 viên), ngày một lần vào buổi tối.",
        "pediatric_dosage": "Trẻ em 6 tháng - 5 tuổi: Uống 4 mg (1 gói cốm hoặc 1 viên nhai 4 mg), ngày một lần vào buổi tối.\nTrẻ em 6 - 14 tuổi: Uống 5 mg (1 viên nhai 5 mg), ngày một lần vào buổi tối.",
        "renal_adjustment": "Không cần hiệu chỉnh liều ở bệnh nhân suy giảm chức năng thận.",
        "hepatic_adjustment": "Không cần hiệu chỉnh liều ở bệnh nhân suy gan nhẹ và trung bình. Chưa có dữ liệu trên bệnh nhân suy gan nặng.",
        "drug_interactions": "Phenobarbital, Phenytoin, Rifampicin làm giảm diện tích dưới đường cong (AUC) của montelukast khoảng 40%.",
        "overdose_treatment": "Quá liều cấp đã ghi nhận ở liều trên 1.000 mg. Triệu chứng gồm đau bụng, buồn ngủ, khát nước, đau đầu, nôn, tăng động. Điều trị triệu chứng và nâng đỡ thể trạng.",
        "antidote": None,
        "source": "Dược thư Quốc gia Việt Nam (Bổ sung 2022 - QĐ 3445/QĐ-BYT)"
    },
    {
        "title": "ETORICOXIB",
        "inn": "Etoricoxib",
        "start_page": None,
        "atc_code": "M01AH05",
        "drug_class": "Thuốc chống viêm không steroid (NSAID), ức chế chọn lọc COX-2",
        "dosage_forms": "Viên nén bao phim 30 mg, 60 mg, 90 mg, 120 mg.",
        "indications": "Điều trị triệu chứng thoái hóa khớp, viêm khớp dạng thấp, viêm cột sống dính khớp, cơn gút cấp. Điều trị đau cấp tính sau phẫu thuật nha khoa.",
        "contraindications": "Quá mẫn với etoricoxib. Loét dạ dày tá tràng tiến triển, xuất huyết tiêu hóa. Tiền sử co thắt phế quản, phù mạch, mày đay khi dùng aspirin hoặc NSAID. Suy tim sung huyết (NYHA II-IV). Tăng huyết áp chưa kiểm soát (>140/90 mmHg). Bệnh tim thiếu máu cục bộ, bệnh động mạch ngoại biên. Suy gan nặng (Child-Pugh >= 10). Suy thận nặng (ClCr < 30 ml/phút). Phụ nữ có thai và cho con bú. Trẻ em dưới 16 tuổi.",
        "precautions": "Nguy cơ biến cố huyết khối tim mạch nặng (nhồi máu cơ tim, đột quỵ). Cần dùng liều thấp nhất có hiệu quả trong thời gian ngắn nhất. Kiểm soát huyết áp chặt chẽ trước và trong quá trình điều trị.",
        "pregnancy_warning": "Thời kỳ mang thai: Chống chỉ định trong suốt thai kỳ vì nguy cơ đóng sớm ống động mạch và suy thận thai nhi.\nThời kỳ cho con bú: Chống chỉ định ở phụ nữ đang cho con bú.",
        "adverse_effects": "Rất phổ biến/Phổ biến: Đau bụng, phù nề, tăng huyết áp, chóng mặt, đau đầu, đánh trống ngực, co thắt phế quản, khó tiêu, tăng men gan ALT/AST.",
        "adult_dosage": "Thoái hóa khớp: 30 mg hoặc 60 mg, ngày 1 lần. Viêm khớp dạng thấp / Viêm cột sống dính khớp: 60 mg hoặc 90 mg, ngày 1 lần. Cơn gút cấp: 120 mg, ngày 1 lần (tối đa không quá 8 ngày). Đau sau phẫu thuật nha khoa: 90 mg, ngày 1 lần (tối đa không quá 3 ngày).",
        "pediatric_dosage": "Chống chỉ định cho trẻ em và thanh thiếu niên dưới 16 tuổi.",
        "renal_adjustment": "ClCr >= 30 ml/phút: Không cần chỉnh liều. ClCr < 30 ml/phút: Chống chỉ định.",
        "hepatic_adjustment": "Suy gan nhẹ (Child-Pugh 5-6): Tối đa 60 mg/ngày. Suy gan trung bình (Child-Pugh 7-9): Tối đa 30 mg/ngày hoặc 60 mg cách nhật. Suy gan nặng (Child-Pugh >= 10): Chống chỉ định.",
        "drug_interactions": "Tăng tác dụng của thuốc chống đông đường uống (Warfarin). Giảm tác dụng hạ huyết áp của thuốc ức chế men chuyển (ACEi) và chẹn thụ thể Angiotensin (ARB). Tăng nồng độ Lithium và Methotrexate trong huyết tương.",
        "overdose_treatment": "Trường hợp quá liều, áp dụng các biện pháp hỗ trợ thông thường (rửa dạ dày, theo dõi lâm sàng). Thẩm phân máu không loại trừ được etoricoxib.",
        "antidote": None,
        "source": "Dược thư Quốc gia Việt Nam (Bổ sung 2022 - QĐ 3445/QĐ-BYT)"
    }
]

for entry in new_2022_entries:
    if entry['inn'].lower() not in existing_inns:
        monographs.append(entry)
        existing_inns.add(entry['inn'].lower())
        print(f"Added {entry['inn']} to monographs.")

with open(JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(monographs, f, ensure_ascii=False, indent=2)

print(f"Total monographs after supplement: {len(monographs)}")
