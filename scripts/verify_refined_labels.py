#!/usr/bin/env python3
"""
Playwright script to thoroughly verify that all labels, buttons, badges,
and modal terminology across all 5 modules and modals are clear, intuitive,
and conform to Vietnamese hospital clinical practice.
"""

import sys
import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = "/home/tontonyuta/Downloads/DoAn2/docs/screenshots/refined_ui"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("1. Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. Debt Ledger Tab Check
        print("2. Verifying Debt Ledger Tab (Tab 1)...")
        # Check filter buttons
        assert page.locator("button:has-text('Thuốc gây nghiện')").is_visible(), "Thuốc gây nghiện filter missing"
        assert page.locator("button:has-text('Đã hoàn bù')").is_visible(), "Đã hoàn bù filter missing"
        # Check header
        assert page.locator("th:has-text('Trạng thái')").is_visible(), "Trạng thái column header missing"
        # Check button + Mượn Khẩn Thuốc / Vật Tư
        assert page.locator("button:has-text('+ Mượn Khẩn Thuốc / Vật Tư')").is_visible(), "+ Mượn Khẩn Thuốc / Vật Tư button missing"

        page.screenshot(path=f"{SCREENSHOT_DIR}/01_debt_ledger_refined.png")
        print("   -> Saved 01_debt_ledger_refined.png")

        # Open Manual Borrow Modal
        print("3. Checking Manual Borrow Modal...")
        page.locator("button:has-text('+ Mượn Khẩn Thuốc / Vật Tư')").click()
        page.wait_for_timeout(500)
        assert page.locator("text=Kho Dược Lâm Sàng").is_visible(), "Modal subtitle missing"
        assert page.locator("button:has-text('Ký Lập Phiếu Mượn')").is_visible(), "Submit button text missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_manual_borrow_modal_refined.png")
        print("   -> Saved 02_manual_borrow_modal_refined.png")
        # Close modal using Hủy bỏ button
        page.locator("button:has-text('Hủy bỏ')").click()
        page.wait_for_timeout(400)

        # Switch to Director role to see all tabs easily
        print("4. Switching to Ban Giám Đốc role...")
        page.locator("select[title*='Chuyển đổi phân quyền']").select_option("director")
        page.wait_for_timeout(500)

        # 2. Equipment Incident Tab Check
        print("5. Verifying Equipment Incident Tab (Tab 2)...")
        page.locator("button:has-text('Sự cố & Kiểm định')").click()
        page.wait_for_timeout(500)
        # Check button + Báo Hỏng Thiết Bị (typo fix check)
        assert page.locator("button:has-text('+ Báo Hỏng Thiết Bị')").is_visible(), "+ Báo Hỏng Thiết Bị button missing"
        # Check action button Nghiệm thu & Bàn giao
        assert page.locator("button:has-text('Nghiệm thu & Bàn giao')").first.is_visible(), "Nghiệm thu & Bàn giao button missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_equipment_tab_refined.png")
        print("   -> Saved 03_equipment_tab_refined.png")

        # Open Incident Modal
        print("6. Checking Incident Modal...")
        page.locator("button:has-text('+ Báo Hỏng Thiết Bị')").click()
        page.wait_for_timeout(500)
        assert page.locator("h2:has-text('Lập Phiếu Báo Hỏng / Sự Cố Trang Thiết Bị Y Tế')").is_visible(), "Incident modal title typo"
        assert page.locator("text=Phòng Vật Tư - TBYT").first.is_visible(), "Incident modal subtitle missing"
        assert page.locator("button:has-text('Gửi Báo Hỏng Cho Kỹ Sư')").is_visible(), "Submit button missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_manual_incident_modal_refined.png")
        print("   -> Saved 04_manual_incident_modal_refined.png")
        # Close incident modal
        page.locator("button:has-text('Hủy bỏ')").click()
        page.wait_for_timeout(400)

        # 3. FEFO Tab Check
        print("7. Verifying FEFO Inventory Tab (Tab 3)...")
        page.locator("button:has-text('Kho Dược & Hạn Dùng')").click()
        page.wait_for_timeout(500)
        # Check filters
        assert page.locator("button:has-text('Lô cận hạn < 60 ngày')").is_visible(), "Lô cận hạn filter missing"
        assert page.locator("button:has-text('Dưới định mức Min')").is_visible(), "Dưới định mức Min filter missing"
        # Check export button text
        assert page.locator("button:has-text('Xuất kho (10)')").first.is_visible(), "Xuất kho (10) button missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_fefo_tab_refined.png")
        print("   -> Saved 05_fefo_tab_refined.png")

        # 4. Cold Chain Tab Check
        print("8. Verifying Cold Chain Tab (Tab 4)...")
        page.locator("button:has-text('Chuỗi lạnh vắc xin')").click()
        page.wait_for_timeout(500)
        assert page.locator("button:has-text('Mô phỏng mất điện (11°C)')").is_visible(), "Power outage button missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_cold_chain_tab_refined.png")
        print("   -> Saved 06_cold_chain_tab_refined.png")

        # 5. Asset Audit Tab Check
        print("9. Verifying Asset Audit Tab (Tab 5)...")
        page.locator("button:has-text('Kiểm kê tài sản')").click()
        page.wait_for_timeout(500)
        assert page.locator("text=chờ thanh lý").first.is_visible(), "chờ thanh lý missing"
        assert page.locator("button:has-text('Quét QR đối soát buồng')").is_visible(), "Quét QR button missing"
        assert page.locator("button:has-text('Lệch buồng phòng')").is_visible(), "Lệch buồng phòng filter missing"
        page.screenshot(path=f"{SCREENSHOT_DIR}/07_asset_audit_tab_refined.png")
        print("   -> Saved 07_asset_audit_tab_refined.png")

        # Open Legal Docs & User Guide Modals to check their headers
        print("10. Checking Legal Docs & User Guide Modals...")
        page.locator("button:has-text('Căn Cứ Pháp Lý')").click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/08_legal_docs_modal_refined.png")
        print("   -> Saved 08_legal_docs_modal_refined.png")
        page.locator("button:has-text('Đóng cửa sổ')").click()
        page.wait_for_timeout(400)

        page.locator("button:has-text('Hướng Dẫn Sử Dụng')").click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/09_user_guide_modal_refined.png")
        print("   -> Saved 09_user_guide_modal_refined.png")
        # Click the X button in user guide header
        page.locator("div.fixed button:has(svg.lucide-x)").last.click()
        page.wait_for_timeout(400)

        browser.close()
        print("All verification steps passed successfully!")

if __name__ == "__main__":
    run()
