"""
Bản kiểm thử chuyên biệt: Multi-Layout Medical Document & OCR Parser.
Kiểm tra khả năng thích ứng với đa dạng bố cục chứng từ y tế - dược phẩm Việt Nam:
1. Hóa đơn điện tử VAT (e-Invoice) dạng bảng nhiều cột
2. Bảng kê phân phối dược phẩm CPC1 / Sanofi (Số lô & Hạn dùng ở dòng phụ)
3. Đơn thuốc phòng khám tư nhân (Danh sách text phi bảng)
4. Hóa đơn bán lẻ / Bill nhiệt POS K80/K57
5. Đảm bảo logic số học: Thành tiền = Số lượng * Đơn giá (100% Logic)
"""

import pytest
from app.routers.bhyt import parse_vietnamese_prescription_text
from app.services.drug_resolver import DrugEntityResolver


def test_einvoice_vat_table_layout():
    """Kiểm tra đọc Hóa đơn GTGT điện tử (e-Invoice VAT Thông tư 78)."""
    raw_text = """
    CÔNG TY CỔ PHẦN DƯỢC PHẨM TRUNG ƯƠNG 1 - CPC1
    Mã số thuế: 0100109999
    HÓA ĐƠN GIÁ TRỊ GIA TĂNG (TIỀN THUẾ GTGT)
    Số HĐ: 1C26TNN/0012458
    Người mua: Bệnh viện Đa khoa Quốc tế
    STT | Tên hàng hóa, dịch vụ | ĐVT | Số lượng | Đơn giá | Thành tiền
    1   | Augmentin 1g          | Hộp | 50       | 185000  | 9250000
    2   | Panadol Extra 500mg   | Hộp | 100      | 45000   | 4500000
    Cộng tiền hàng: 13750000
    Thuế suất GTGT: 5%
    Tiền thuế: 687500
    Tổng cộng thanh toán: 14437500
    """
    res = parse_vietnamese_prescription_text(raw_text)
    assert res["document_type"] == "HOA_DON_VAT"
    assert "0100109999" in res["seller_tax_id"]
    assert "0012458" in res["invoice_number"] or "1C26TNN" in res["invoice_number"]
    assert len(res["items"]) >= 2
    
    # Kiểm tra thuốc 1
    item1 = res["items"][0]
    assert "augmentin" in item1["drug_name"].lower()
    assert item1["quantity"] == 50.0
    assert item1["unit_price"] == 185000.0
    assert item1["total_price"] == 9250000.0  # Logic 100%
    assert item1["unit"] == "Hộp"


def test_cpc1_distributor_delivery_subrow_layout():
    """Kiểm tra Bảng kê xuất kho CPC1 / Sanofi với Số lô & HSD ở dòng phụ thụt lề."""
    raw_text = """
    CHI NHÁNH CÔNG TY CỔ PHẦN DƯỢC PHẨM CPC1 HÀ NỘI
    PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ
    Số phiếu: XK-2026-9981
    Khách hàng: Kho Dược Bệnh viện Bạch Mai
    1. Klamentin 1g/200mg (Hộp 14 viên) x 30 hộp
       Lô: B24098 - HSD: 30/12/2027 - Đơn giá: 120.000
    2. Nexium 40mg (Hộp 28 viên) x 20 hộp
       Batch: NX9982 - Exp: 15/08/2028 - Giá: 350.000
    """
    res = parse_vietnamese_prescription_text(raw_text)
    assert res["document_type"] == "PHIEU_XUAT_KHO"
    assert "CPC1" in res["seller_name"]
    assert len(res["items"]) == 2

    it1 = res["items"][0]
    assert "klamentin" in it1["drug_name"].lower()
    assert it1["batch_number"] == "B24098"
    assert it1["expiry_date"] == "30/12/2027"
    assert it1["quantity"] == 30.0

    it2 = res["items"][1]
    assert "nexium" in it2["drug_name"].lower()
    assert it2["batch_number"] == "NX9982"
    assert it2["expiry_date"] == "15/08/2028"
    assert it2["quantity"] == 20.0


def test_private_clinic_unstructured_prescription():
    """Kiểm tra Đơn thuốc phòng khám tư nhân dạng gạch đầu dòng không kẻ bảng."""
    raw_text = """
    PHÒNG KHÁM ĐA KHOA AN BÌNH
    ĐƠN THUỐC ĐIỀU TRỊ NGOẠI TRÚ
    Họ và tên người bệnh: Nguyễn Văn Minh
    Tuổi: 48 tuổi
    Chẩn đoán: Viêm dạ dày trào ngược / Tăng huyết áp (Mã ICD: K21, I10)
    CHỈ ĐỊNH THUỐC:
    - Nexium 40mg x 30 viên (Uống ngày 1 viên vào buổi sáng trước ăn)
    - Amlor 5mg x 30 viên (Uống ngày 1 viên vào buổi sáng)
    - Gaviscon x 20 gói (Uống ngày 2 lần, mỗi lần 1 gói sau ăn)
    Lời dặn: Tái khám sau 1 tháng mang theo đơn này.
    """
    res = parse_vietnamese_prescription_text(raw_text)
    assert res["document_type"] == "DON_THUOC"
    assert "Nguyễn Văn Minh" in res["patient_name"]
    assert res["patient_age"] == 48
    assert res["primary_icd10"] == "K21"
    assert len(res["items"]) == 3

    drug_names = [it["drug_name"].lower() for it in res["items"]]
    assert any("nexium" in d for d in drug_names)
    assert any("amlor" in d for d in drug_names)
    assert any("gaviscon" in d for d in drug_names)


def test_retail_thermal_receipt_k80():
    """Kiểm tra Hóa đơn in nhiệt K80/K57 tại quầy thuốc."""
    raw_text = """
    NHÀ THUỐC LONG TÂM
    HÓA ĐƠN BÁN LẺ (K80)
    Số: BL-88712
    Ngày: 08/11/2026
    Khách lẻ
    1. Panadol Extra vỉ 10 viên x 2 vỉ Giá: 15.000
    2. Vitamin C 500mg lọ 100 viên x 1 lọ Giá: 45.000
    Cộng tiền hàng: 75.000
    Cảm ơn quý khách!
    """
    res = parse_vietnamese_prescription_text(raw_text)
    assert res["document_type"] == "HOA_DON_BAN_LE"
    assert len(res["items"]) >= 2
    assert any("panadol" in it["drug_name"].lower() for it in res["items"])


def test_drug_resolver_with_batch_and_noise():
    """Kiểm tra DrugEntityResolver bóc tách sạch tên thuốc khi đầu vào dính Số lô/HSD."""
    resolver = DrugEntityResolver()
    
    # Chuỗi có dính số lô và quy cách
    query = "Klamentin 1g Lô: B24098 HSD: 30/12/2027 Hộp 14 viên"
    features = resolver.extract_features(query)
    
    assert "b24098" not in features["cleaned_name"].lower()
    assert "30/12/2027" not in features["cleaned_name"].lower()
    assert "klamentin" in features["cleaned_name"].lower()

    # Tra cứu thực thể
    match = resolver.resolve_drug(query)
    assert match.match_status in ("HIGH", "MEDIUM")
