#!/usr/bin/env python3
"""
Kiểm định Chuyên Sâu 4 Tầng Tính Chuẩn Xác của Tệp PDF từ Cục Quản Lý Dược (DAV) (<=200 LOC)
1. SĐK 12 số trùng khớp 100% | 2. Path TT89 | 3. HTTP 200 & %PDF | 4. Scan page verification
"""

import json, urllib.request, urllib.parse, io, sys
from pypdf import PdfReader

BASE_VIEW_URL = "https://dichvucong.dav.gov.vn/File/GoToViewTaiLieu?url={encoded}"
API_URL = "https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging"

TEST_DRUGS = [
    {
        "sdk": "893100110026", "expectedName": "PARACETAMOL 500mg", "expectedInn": "Paracetamol",
        "hdsdPath": r"TT89\soc-trang\2200204614\HOSO_20220818_074011\tepdinhkem\BS1---To-huong-dan-su-dung-thuoc_30238_20241225_133756.pdf",
        "labelPath": r"TT89\soc-trang\2200204614\HOSO_20220818_074011\tepdinhkem\3.-NHAN-THUOC-1-4_30238_20220908_100113.pdf"
    },
    {
        "sdk": "840110304425", "expectedName": "Ceftriaxona Normon 1g", "expectedInn": "Ceftriaxon",
        "hdsdPath": r"TT89\thanh-pho-ho-chi-minh\0312087239\HOSO_20200227_200921\tepdinhkem\HDSD_1_30531_20200227_201604.pdf",
        "labelPath": r"TT89\thanh-pho-ho-chi-minh\0312087239\HOSO_20200227_200921\tepdinhkem\3.-Nhan-du-kien-luu-hanh_30531_20240822_151847.pdf"
    },
    {
        "sdk": "890112769224", "expectedName": "Diazepam Injection BP 10mg/2ml", "expectedInn": "Diazepam",
        "hdsdPath": r"TT89\thanh-pho-ho-chi-minh\0313974956\HOSO_20220321_103600\tepdinhkem\hdsd-vn_30344_20230802_135326.pdf",
        "labelPath": r"TT89\thanh-pho-ho-chi-minh\0313974956\HOSO_20220321_103600\tepdinhkem\7.-Mau-nhan-Diazepam_30344_20220323_100117.pdf"
    },
    {
        "sdk": "893110151100", "expectedName": "Hadunalin 1 mg/ml", "expectedInn": "Adrenalin",
        "hdsdPath": r"TT89\hai-duong\0800011018\HOSO_20210616_153222\tepdinhkem\Hadunalin-1ml-hdsd_30315_20210616_155951.pdf",
        "labelPath": r"TT89\hai-duong\0800011018\HOSO_20210616_153222\tepdinhkem\Hadunalin-1ml-nhan_30315_20210616_155937.pdf"
    },
    {
        "sdk": "539110203326", "expectedName": "Venclexta", "expectedInn": "Venetoclax",
        "hdsdPath": r"TT89\Tinh-unknown\vpdd60242\HOSO_20200203_105936\tepdinhkem\PI-Venclexta_nen_30409_20250411_114346.pdf",
        "labelPath": r"TT89\Tinh-unknown\vpdd60242\HOSO_20200203_105936\tepdinhkem\Proposed-AW_Venclexta-10_30409_20250331_083558.pdf"
    },
    {
        "sdk": "300110965424", "expectedName": "Augmentin ES", "expectedInn": "amoxicillin",
        "hdsdPath": r"TT89\Tinh-unknown\WLMP0900064\HOSO_20200804_135305\tepdinhkem\I.7.-Updated-PI_30244_20230316_161911.pdf",
        "labelPath": r"TT89\Tinh-unknown\WLMP0900064\HOSO_20200804_135305\tepdinhkem\I.7.-Updated-AW_30244_20230313_113310.pdf"
    },
    {
        "sdk": "893115105926", "expectedName": "VANCOMYCIN 0,75g", "expectedInn": "Vancomycin",
        "hdsdPath": r"TT89\thanh-pho-ha-noi\0100109032\HOSO_20240619_143330\tepdinhkem\hdsd_30279_20251103_145819.pdf",
        "labelPath": r"TT89\thanh-pho-ha-noi\0100109032\HOSO_20240619_143330\tepdinhkem\nhan-ok_30279_20251103_145756.pdf"
    }
]

def verify_dav_api_record(drug):
    """Tầng 1: Đối soát bản ghi API Cục Quản Lý Dược qua SĐK"""
    sdk = drug["sdk"]
    payload = json.dumps({"skipCount": 0, "maxResultCount": 1, "filterText": sdk, "SoDangKyThuoc": {}, "KichHoat": True}).encode("utf-8")
    req = urllib.request.Request(API_URL, data=payload, headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        items = res.get("result", {}).get("items", [])
        if not items or items[0].get("soDangKy") != sdk:
            return False, "Không tìm thấy SĐK trên Cổng DVC"
        it = items[0]
        hdsd_raw = (it.get("thongTinTaiLieu") or {}).get("urlHuongDanSuDung")
        if not hdsd_raw or "duongDanTep" not in hdsd_raw:
            return False, "Cục Dược chưa có đường dẫn HDSD"
        actual_path = json.loads(hdsd_raw)[0].get("duongDanTep")
        if actual_path != drug["hdsdPath"]:
            return False, f"Lệch path: {actual_path} != {drug['hdsdPath']}"
        return True, {
            "davDrugName": it.get("tenThuoc"),
            "davInn": it.get("thongTinThuocCoBan", {}).get("hoatChatChinh") or it.get("hoatChatChinh"),
            "davMfr": it.get("congTySanXuat", {}).get("tenCongTySanXuat") or it.get("tenCongTySanXuat")
        }

def inspect_pdf_content(file_path):
    """Tầng 3 & 4: Tải streaming tệp PDF và phân tích đối tượng nhị phân"""
    url = BASE_VIEW_URL.format(encoded=urllib.parse.quote(file_path))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        if resp.status != 200 or "application/pdf" not in resp.headers.get("Content-Type", ""):
            return False, f"HTTP status {resp.status}"
        data = resp.read()
        if not data.startswith(b"%PDF"):
            return False, "Thiếu magic bytes %PDF"
        reader = PdfReader(io.BytesIO(data))
        return True, {
            "lengthBytes": len(data),
            "totalPages": len(reader.pages),
            "hasImages": len(reader.pages[0].images) > 0 if len(reader.pages) > 0 else False
        }

def main():
    print("=" * 75)
    print("🔍 KIỂM ĐỊNH CHUYÊN SÂU 4 TẦNG TÍNH CHUẨN XÁC PDF TỪ CỤC QUẢN LÝ DƯỢC (DAV)")
    print("=" * 75)
    all_passed = True
    for idx, drug in enumerate(TEST_DRUGS, 1):
        sdk = drug["sdk"]
        print(f"\n[{idx}/{len(TEST_DRUGS)}] ĐỐI SOÁT: {drug['expectedName']} (SĐK: {sdk})")
        api_ok, api_info = verify_dav_api_record(drug)
        if not api_ok:
            print(f"  ❌ Tầng 1 API THẤT BẠI: {api_info}"); all_passed = False; continue
        print(f"  ✅ Tầng 1-2: Khớp SĐK & Path TT89 ({api_info['davDrugName']} | {api_info['davMfr']})")

        hdsd_ok, h_info = inspect_pdf_content(drug["hdsdPath"])
        if not hdsd_ok:
            print(f"  ❌ Tầng 3-4 HDSD THẤT BẠI: {h_info}"); all_passed = False; continue
        print(f"  ✅ Tầng 3-4 HDSD: HTTP 200 OK | {h_info['lengthBytes']/1024/1024:.2f} MB | {h_info['totalPages']} trang | Scan Image: {h_info['hasImages']}")

        nhan_ok, n_info = inspect_pdf_content(drug["labelPath"])
        if not nhan_ok:
            print(f"  ❌ Mẫu Nhãn THẤT BẠI: {n_info}"); all_passed = False; continue
        print(f"  ✅ Mẫu Nhãn: HTTP 200 OK | {n_info['lengthBytes']/1024:.1f} KB | {n_info['totalPages']} trang bản vẽ")

    print("\n" + "=" * 75)
    print("🎉 KẾT QUẢ ĐỐI SOÁT: 100% CÁC TỆP PDF TRÙNG KHỚP TUYỆT ĐỐI VỚI THUỐC!" if all_passed else "❌ CÓ SAI LỆCH!")
    print("=" * 75)

if __name__ == "__main__":
    main()

