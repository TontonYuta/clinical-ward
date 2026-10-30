from app.services.dav_normalizer import normalize_dav_record


def test_normalizer_maps_nested_dav_fields_without_inventing_values():
    raw = {
        "id": 12,
        "soDangKy": "VD-1-23",
        "tenThuoc": "Brand A",
        "isActive": True,
        "isHetHan": False,
        "thongTinThuocCoBan": {
            "hoatChatChinh": "Amoxicillin; Clavulanic acid",
            "hamLuong": "875mg; 125mg",
            "dangBaoChe": "Viên nén",
            "dongGoi": "Hộp 14 viên",
            "tieuChuan": "BP",
            "tuoiTho": "36",
        },
        "congTySanXuat": {"tenCongTySanXuat": "Maker", "nuocSanXuat": "VN"},
        "congTyDangKy": {"tenCongTyDangKy": "Applicant", "nuocDangKy": "VN"},
        "thongTinDangKyThuoc": {"ngayCapSoDangKy": "2024-01-02", "ngayHetHanSoDangKy": "2027-01-02", "soQuyetDinh": "12/QD"},
    }

    result = normalize_dav_record(raw)

    assert result == {
        "source_id": "12",
        "national_code": "VD-1-23",
        "brand_name": "Brand A",
        "active_ingredient_raw": "Amoxicillin; Clavulanic acid",
        "strength_raw": "875mg; 125mg",
        "dosage_form": "Viên nén",
        "package_spec": "Hộp 14 viên",
        "standard_pharmacopeia": "BP",
        "shelf_life": "36",
        "manufacturer": "Maker",
        "manufacturer_country": "VN",
        "applicant": "Applicant",
        "applicant_country": "VN",
        "approval_date": "2024-01-02",
        "expiry_date": "2027-01-02",
        "approval_decision": "12/QD",
        "is_active": True,
        "is_expired": False,
        "normalization_flags": ["combination_candidate"],
    }


def test_normalizer_flags_missing_identity_and_keeps_empty_values_empty():
    result = normalize_dav_record({"tenThuoc": "Unknown"})
    assert result["national_code"] is None
    assert result["active_ingredient_raw"] is None
    assert "missing_national_code" in result["normalization_flags"]
    assert "missing_active_ingredient" in result["normalization_flags"]
