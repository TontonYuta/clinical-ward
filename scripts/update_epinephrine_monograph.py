import json
import sqlite3
import gzip
import os

ADULT_DOSAGE = """CÁCH DÙNG & ĐƯỜNG DÙNG:
• Dung dịch tiêm adrenalin dùng tiêm bắp, tiêm tĩnh mạch, tiêm nội nhãn cầu, tiêm dưới da hoặc qua ống nội khí quản.
• Tiêm bắp: Vị trí ưu tiên hàng đầu là mặt trước bên ngoài đùi (hấp thu nhanh nhất). Tránh tiêm vào mông.
• CẢNH BÁO ĐẶC BIỆT: CẤM TUYỆT ĐỐI tiêm tĩnh mạch trực tiếp dung dịch adrenalin 1 mg/ml (1:1.000) chưa pha loãng vì nguy cơ gây rung thất, xuất huyết não kịch phát và tử vong. Chỉ tiêm tĩnh mạch khi đã pha loãng đạt nồng độ 1:10.000 hoặc truyền tĩnh mạch liên tục kiểm soát bằng bơm tiêm điện.

LIỀU DÙNG THEO PHÁC ĐỒ CẤP CỨU:
• Cấp cứu sốc phản vệ (Thông tư 51/2017/TT-BYT & Dược Thư 2022):
  - Tiêm bắp ngay lập tức: 1/2 ống (0,5 mg) dung dịch 1 mg/ml (1:1.000) vào mặt trước ngoài đùi.
  - Theo dõi và nhắc lại mỗi 3 - 5 phút/lần nếu huyết áp chưa phục hồi hoặc triệu chứng chưa cải thiện.
  - Nếu có trụy mạch nặng / sốc kháng trị: Thiết lập đường truyền tĩnh mạch kiểm soát bằng bơm tiêm điện (liều khởi đầu 0,1 microgam/kg/phút, chỉnh liều theo huyết áp).
• Cấp cứu ngừng tuần hoàn (Ngừng tim):
  - Tiêm tĩnh mạch: 1 mg (dung dịch pha loãng 1:10.000), nhắc lại mỗi 3 - 5 phút trong quá trình hồi sức tim phổi (CPR).
  - Có thể bơm qua ống nội khí quản (2 - 2,5 mg pha trong 5 - 10 ml nước cất) nếu chưa lập được đường truyền tĩnh mạch.
• Cơn hen phế quản co thắt nặng:
  - Tiêm dưới da hoặc tiêm bắp: 0,3 - 0,5 mg (0,3 - 0,5 ml dung dịch 1:1.000). Có thể nhắc lại sau 20 - 30 phút nếu cần thiết.
• Sốc nhiễm khuẩn (khi truyền dịch và Dopamin/Dobutamin thất bại):
  - Truyền tĩnh mạch liên tục qua catheter tĩnh mạch trung tâm: 0,5 - 1 microgam/kg/phút, điều chỉnh theo huyết áp động mạch xâm lấn."""

PEDIATRIC_DOSAGE = """LIỀU CẤP CỨU NHI KHOA (THEO CÂN NẶNG & ĐỘ TUỔI):
• Cấp cứu sốc phản vệ ở trẻ em (Thông tư 51/2017/TT-BYT):
  - Liều tiêm bắp: 0,01 mg/kg (tương đương 0,01 ml/kg dung dịch 1 mg/ml 1:1.000).
  - Hoặc phân liều theo độ tuổi:
    + Trẻ < 6 tháng: 1/5 ống (khoảng 0,1 - 0,2 ml).
    + Trẻ 6 - 12 tháng: 1/4 ống (khoảng 0,25 ml).
    + Trẻ 1 - 5 tuổi: 1/3 ống (khoảng 0,3 ml).
    + Trẻ 6 - 12 tuổi: 1/2 ống (khoảng 0,5 ml).
    + Trẻ > 12 tuổi: Dùng như liều người lớn (1/2 đến 1 ống).
  - Vị trí tiêm: Mặt trước ngoài đùi. Nhắc lại mỗi 3 - 5 phút nếu chưa đáp ứng.
• Cấp cứu ngừng tim ở trẻ em:
  - Tiêm tĩnh mạch hoặc trong xương: 10 microgam/kg (0,1 ml/kg dung dịch pha loãng 1:10.000), nhắc lại mỗi 3 - 5 phút.
• Thở rít thanh quản / Khò khè ở trẻ nhỏ (dưới 2 tuổi):
  - Khí dung hoặc tiêm dưới da: 0,01 ml/kg dung dịch 1 mg/1 ml.
  - Viêm thanh khí phế quản cấp: Khí dung dung dịch racemic adrenalin 2,25% (0,05 ml/kg) hoặc adrenalin 1:1.000 (0,5 ml/kg, tối đa 5 ml) pha với NaCl 0,9%."""

ANTIDOTE = "Phentolamin (thuốc chẹn alpha-adrenergic đặc hiệu) xử trí hoại tử mô do thoát mạch: Pha 5 - 10 mg Phentolamin trong 10 ml NaCl 0,9%, tiêm thấm nhiều điểm vào vùng da bị hoại tử/tái nhợt trong vòng 12 giờ đầu. Với tăng huyết áp kịch phát hoặc rung thất do quá liều: Dùng thuốc chẹn thụ thể alpha/beta (Labetalol, Nitroprussid) và sốc điện khử rung tim."

def update_json_monographs():
    json_path = "/home/tontonyuta/Downloads/DoAn2/backend/data/knowledge_base/dtqg_monographs_extracted.json"
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        updated = 0
        for item in data:
            inn = item.get('inn', '').lower()
            if 'adrenalin' in inn or 'epinephrin' in inn:
                item['adult_dosage'] = ADULT_DOSAGE
                item['pediatric_dosage'] = PEDIATRIC_DOSAGE
                item['antidote'] = ANTIDOTE
                updated += 1
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {updated} monographs in {json_path}")

def update_sqlite_db():
    db_path = "/home/tontonyuta/Downloads/DoAn2/backend/clinical_hospital.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 1. Update clinical_drug_monographs
    cur.execute("""
        UPDATE clinical_drug_monographs
        SET adult_dosage = ?, pediatric_dosage = ?, antidote = ?
        WHERE inn LIKE '%Epinephrin%' OR inn LIKE '%Adrenalin%'
    """, (ADULT_DOSAGE, PEDIATRIC_DOSAGE, ANTIDOTE))
    print(f"Updated clinical_drug_monographs: {cur.rowcount} rows")
    
    # 2. Update dav_national_drugs for all Adrenaline / Hadunalin records
    cur.execute("""
        UPDATE dav_national_drugs
        SET adult_dosage = ?, pediatric_dosage = ?, antidote = ?
        WHERE active_ingredient LIKE '%Adrenalin%' 
           OR active_ingredient LIKE '%Epinephrin%'
           OR brand_name LIKE '%Hadunalin%'
    """, (ADULT_DOSAGE, PEDIATRIC_DOSAGE, ANTIDOTE))
    print(f"Updated dav_national_drugs: {cur.rowcount} rows")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_json_monographs()
    update_sqlite_db()
    print("Successfully updated Epinephrine / Adrenalin clinical data!")
