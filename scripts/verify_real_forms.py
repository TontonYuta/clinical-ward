#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script: verify_real_forms.py
Verifies all 8 realistic hospital forms in PrintableFormModal:
1. Captures modal view screenshot
2. Emulates print media and exports pure A4 PDF for each form
3. Converts each PDF to PNG via pdftoppm (150 DPI)
4. Checks page count with pdfinfo to ensure Pages == 1 (Zero-overflow)
"""

import os
import time
import subprocess
from playwright.sync_api import sync_playwright

OUTPUT_DIR = "/home/tontonyuta/.gemini/antigravity-cli/brain/ae542a74-d3d2-48f8-ac3c-f401f8c9a90d/screenshots/copilot_agent"
os.makedirs(OUTPUT_DIR, exist_ok=True)

FORMS = [
    {
        "id": "form1_tt20_destruction",
        "tab_text": "1. Mẫu 16 (TT 20 & NĐ 54)",
        "expected_title": "BIÊN BẢN TIÊU HỦY VỎ THUỐC PHẢI KIỂM SOÁT ĐẶC BIỆT"
    },
    {
        "id": "form2_tt22_restock",
        "tab_text": "2. Mẫu 01/TT22",
        "expected_title": "PHIẾU DỰ TRÙ THUỐC, HÓA CHẤT, VẬT TƯ TIÊU HAO"
    },
    {
        "id": "form3_tsc_handover",
        "tab_text": "3. Mẫu 01/TSC-BBGN",
        "expected_title": "BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG"
    },
    {
        "id": "form4_emergency_borrow",
        "tab_text": "4. Phiếu Mượn Khẩn",
        "expected_title": "PHIẾU XUẤT MƯỢN KHẨN CẤP THUỐC"
    },
    {
        "id": "form5_equipment_inspect",
        "tab_text": "5. Biên Bản KĐ An Toàn",
        "expected_title": "BIÊN BẢN KIỂM ĐỊNH AN TOÀN ĐIỆN VÀ THỬ TẢI LÂM SÀNG"
    },
    {
        "id": "form6_tsc_audit",
        "tab_text": "6. Mẫu 05-TSC",
        "expected_title": "BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH VÀ TRANG THIẾT BỊ Y TẾ"
    },
    {
        "id": "form7_coldchain_gsp",
        "tab_text": "7. Biên Bản Sự Cố",
        "expected_title": "BIÊN BẢN XỬ LÝ SỰ CỐ QUÁ NHIỆT CHUỖI LẠNH"
    },
    {
        "id": "form8_shift_handover",
        "tab_text": "8. Sổ Bàn Giao",
        "expected_title": "BIÊN BẢN BÀN GIAO CA TRỰC ĐIỀU DƯỠNG LÂM SÀNG"
    }
]

def main():
    print("==================================================================")
    print(" KIỂM THỬ VÀ CHỤP ẢNH 8 BIỂU MẪU Y TẾ THỰC TẾ (CHUẨN IN A4 1 TRANG)")
    print("==================================================================")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 960})
        page = context.new_page()

        print("[*] 1. Truy cập ứng dụng tại http://localhost:3000...")
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(1.5)

        print("[*] 2. Mở Modal Biểu Mẫu Hành Chính Y Tế (A4)...")
        modal_btn = page.locator("button:has-text('Biểu Mẫu Y Tế (A4)')")
        modal_btn.click()
        page.wait_for_selector("#printable-medical-document", timeout=10000)
        time.sleep(1)

        results = []

        for idx, form in enumerate(FORMS, 1):
            form_id = form["id"]
            tab_text = form["tab_text"]
            expected = form["expected_title"]
            print(f"\n--- [{idx}/8] Kiểm tra biểu mẫu: {form_id} ---")

            # Click form tab
            tab_btn = page.locator(f"button:has-text('{tab_text}')")
            tab_btn.click()
            time.sleep(0.6)

            # Check title
            doc_el = page.locator("#printable-medical-document")
            doc_text = doc_el.inner_text()
            assert expected in doc_text, f"Title '{expected}' not found in form {form_id}!"

            # 1. Capture Modal View
            modal_png = f"{OUTPUT_DIR}/modal_{idx:02d}_{form_id}.png"
            page.screenshot(path=modal_png)
            print(f"  [+] Chụp ảnh Modal: {os.path.basename(modal_png)}")

            # 2. Export pure Print PDF
            pdf_path = f"{OUTPUT_DIR}/print_{idx:02d}_{form_id}.pdf"
            page.emulate_media(media="print")
            time.sleep(0.4)
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
            page.emulate_media(media="screen")
            time.sleep(0.3)

            # 3. Check page count with pdfinfo
            info_res = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True)
            pages = 0
            for line in info_res.stdout.splitlines():
                if line.startswith("Pages:"):
                    pages = int(line.split(":")[1].strip())
                    break

            print(f"  [+] PDF: {os.path.basename(pdf_path)} | Số trang: {pages} trang")

            # 4. Render PDF to PNG using pdftoppm (150 DPI)
            ppm_prefix = f"{OUTPUT_DIR}/real_print_{idx:02d}_{form_id}"
            subprocess.run(["pdftoppm", "-png", "-r", "150", pdf_path, ppm_prefix], check=True)
            rendered_png = f"{ppm_prefix}-1.png"

            results.append({
                "idx": idx,
                "id": form_id,
                "pages": pages,
                "pdf": pdf_path,
                "png": rendered_png,
                "status": "PASS" if pages == 1 else "FAIL_OVERFLOW"
            })

        browser.close()

    print("\n==================================================================")
    print(" KẾT QUẢ KIỂM TRA ZERO-OVERFLOW CHO TOÀN BỘ 8 BIỂU MẪU:")
    print("==================================================================")
    all_pass = True
    for r in results:
        status_sym = "✅" if r["status"] == "PASS" else "❌"
        print(f"{status_sym} Form {r['idx']}: {r['id']:<26} -> {r['pages']} Trang | Ảnh in: {os.path.basename(r['png'])}")
        if r["pages"] != 1:
            all_pass = False

    if all_pass:
        print("\n🎉 TUYỆT VỜI! 100% (8/8) BIỂU MẪU ĐỀU ĐẠT CHUẨN IN VỪA VẶN 1 TRANG A4!")
    else:
        print("\n⚠️ Cảnh báo: Có biểu mẫu bị tràn sang trang 2!")

if __name__ == "__main__":
    main()
