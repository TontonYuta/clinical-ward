import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = "/home/tontonyuta/.gemini/antigravity-cli/brain/ae542a74-d3d2-48f8-ac3c-f401f8c9a90d/screenshots/copilot_agent"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("1. Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000")
        page.wait_for_selector("text=Sổ Nợ Tủ Trực Cấp Cứu", timeout=15000)
        time.sleep(1)

        # Step 1: Open Printable Form Modal from Sidebar
        print("2. Opening Printable Form Modal from Sidebar...")
        print_btn = page.locator("button:has-text('Biểu Mẫu Y Tế (A4)')")
        print_btn.click()
        page.wait_for_selector("text=Trung Tâm Xuất & In Biểu Mẫu Hành Chính Y Tế", timeout=5000)
        time.sleep(1)

        # Form 1: TT20 Ampoule Destruction
        print("3. Checking Form 1: Mẫu 16 / Phụ lục II NĐ 54/2017 & TT 20/2017...")
        assert page.locator("text=BIÊN BẢN TIÊU HỦY VỎ ỐNG THUỐC").is_visible(), "Form 1 title not visible"
        assert page.locator("text=Mẫu số 16 Phụ lục II Nghị định số 54/2017/NĐ-CP").is_visible(), "Legal label Form 1 not visible"
        assert page.locator("text=VĂN BẢN XÁC THỰC KÝ SỐ Y TẾ ĐIỆN TỬ").is_visible(), "Digital stamp not visible"
        page.screenshot(path=f"{SCREENSHOT_DIR}/11_printable_modal_form1_tt20.png")
        print(" -> Captured 11_printable_modal_form1_tt20.png")

        # Form 2: TT22 Restock Proposal
        print("4. Switching to Form 2: Mẫu số 01/TT22 Thông tư 22/2011/TT-BYT...")
        tab2_btn = page.locator("button:has-text('Mẫu 01/TT22')")
        tab2_btn.click()
        time.sleep(0.5)
        assert page.locator("text=PHIẾU DỰ TRÙ THUỐC, VẬT TƯ TIÊU HAO BỔ SUNG CƠ SỐ TỦ TRỰC").is_visible(), "Form 2 title not visible"
        assert page.locator("text=Mẫu số 01 Thông tư số 22/2011/TT-BYT").is_visible(), "Legal label Form 2 not visible"
        page.screenshot(path=f"{SCREENSHOT_DIR}/12_printable_modal_form2_tt22.png")
        print(" -> Captured 12_printable_modal_form2_tt22.png")

        # Form 3: TSC-BBGN Public Asset Handover
        print("5. Switching to Form 3: Mẫu số 01/TSC-BBGN NĐ 151/2017 & NĐ 114/2024...")
        tab3_btn = page.locator("button:has-text('Mẫu 01/TSC-BBGN')")
        tab3_btn.click()
        time.sleep(0.5)
        assert page.locator("text=BIÊN BẢN BÀN GIAO, TIẾP NHẬN TÀI SẢN CÔNG").is_visible(), "Form 3 title not visible"
        assert page.locator("text=Nghị định số 114/2024/NĐ-CP").is_visible(), "NĐ 114/2024 citation not visible"
        page.screenshot(path=f"{SCREENSHOT_DIR}/13_printable_modal_form3_nd151.png")
        print(" -> Captured 13_printable_modal_form3_nd151.png")

        # Form 4: Emergency Borrow Ticket (Hospital Record)
        print("6. Switching to Form 4: Phiếu xuất mượn khẩn tủ trực Điều 10 TT 22/2011/TT-BYT...")
        tab4_btn = page.locator("button:has-text('Phiếu Mượn Khẩn')")
        tab4_btn.click()
        time.sleep(0.5)
        assert page.locator("text=PHIẾU XUẤT MƯỢN KHẨN DƯỢC PHẨM").is_visible(), "Form 4 title not visible"
        assert page.locator("text=Điều 10 Thông tư 22/2011/TT-BYT").first.is_visible(), "Legal label Form 4 not visible"
        page.screenshot(path=f"{SCREENSHOT_DIR}/14_printable_modal_form4_borrow_a5.png")
        print(" -> Captured 14_printable_modal_form4_borrow_a5.png")

        # Form 5: Equipment Handover & Safety Inspection
        print("7. Switching to Form 5: Biên bản nghiệm thu kiểm định an toàn điện & thử tải NĐ 98/2021...")
        tab5_btn = page.locator("button:has-text('Biên Bản Nghiệm Thu')")
        tab5_btn.click()
        time.sleep(0.5)
        assert page.locator("text=BIÊN BẢN NGHIỆM THU KIỂM ĐỊNH AN TOÀN ĐIỆN").is_visible(), "Form 5 title not visible"
        page.screenshot(path=f"{SCREENSHOT_DIR}/15_printable_modal_form5_nd98_safety.png")
        print(" -> Captured 15_printable_modal_form5_nd98_safety.png")

        # Step 8: Close Modal
        print("8. Closing Modal...")
        close_btn = page.locator("button[data-testid='close-printable-modal']")
        close_btn.click()
        page.wait_for_selector("text=Trung Tâm Xuất & In Biểu Mẫu Hành Chính Y Tế", state="detached", timeout=3000)
        time.sleep(0.5)

        # Step 9: Test direct print button in Debt Ledger
        print("9. Testing direct 'In Biểu Mẫu A4' in Debt Ledger Tab...")
        top_print_btn = page.locator("button:has-text('In Biểu Mẫu A4')")
        assert top_print_btn.is_visible(), "In Biểu Mẫu A4 button not visible on Debt Ledger"
        top_print_btn.click()
        page.wait_for_selector("text=Trung Tâm Xuất & In Biểu Mẫu Hành Chính Y Tế", timeout=3000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/16_direct_print_from_debt_tab.png")
        print(" -> Captured 16_direct_print_from_debt_tab.png")

        # Close again
        page.locator("button[data-testid='close-printable-modal']").click()
        page.wait_for_selector("text=Trung Tâm Xuất & In Biểu Mẫu Hành Chính Y Tế", state="detached", timeout=3000)
        time.sleep(0.5)

        # Step 10: Switch to Equipment Tab and verify direct print
        print("10. Switching to role Kỹ sư TBYT and Equipment Tab...")
        # Role switch to biomedical_engineer
        role_select = page.locator("select").first
        role_select.select_option(value="biomedical_engineer")
        time.sleep(0.5)

        # Click Equipment tab on sidebar
        eq_tab_btn = page.locator("button:has-text('Sự cố & Kiểm định')")
        eq_tab_btn.click()
        time.sleep(0.5)

        print("11. Verifying 'In Biên Bản Kỹ Thuật (NĐ 98)' button in Equipment Tab...")
        eq_print_btn = page.locator("button:has-text('In Biên Bản Kỹ Thuật (NĐ 98)')")
        assert eq_print_btn.is_visible(), "In Biên Bản Kỹ Thuật button not visible on Equipment Tab"
        eq_print_btn.click()
        page.wait_for_selector("text=BIÊN BẢN NGHIỆM THU KIỂM ĐỊNH AN TOÀN ĐIỆN", timeout=3000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/17_direct_print_from_equipment_tab.png")
        print(" -> Captured 17_direct_print_from_equipment_tab.png")

        browser.close()
        print("ALL PLAYWRIGHT TESTS PASSED 100%!")

if __name__ == "__main__":
    run_test()
