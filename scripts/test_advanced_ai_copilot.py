import asyncio
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "/home/tontonyuta/.gemini/antigravity-cli/brain/ae542a74-d3d2-48f8-ac3c-f401f8c9a90d/screenshots/copilot_agent"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        print("Navigating to http://localhost:3000 ...")
        await page.goto("http://localhost:3000", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # 1. Open AI Copilot Window
        ai_btn = page.locator("button:has-text('Trợ Lý AI')")
        await ai_btn.click()
        await page.wait_for_timeout(600)

        # 2. Test Shift Handover Audit (07:00 AM)
        print("Testing Shift Handover Audit...")
        handover_chip = page.locator("button:has-text('Đối soát ca trực 07:00 AM')")
        if await handover_chip.count() > 0:
            await handover_chip.first.click()
        else:
            chat_input = page.locator("input[placeholder*='Nhập yêu cầu lâm sàng']")
            await chat_input.fill("Chạy đối soát toàn bộ ca trực đêm qua và phát hiện lệch sổ giao ban 07:00 AM")
            await page.locator("button[title='Gửi lệnh']").click()

        print("Waiting for Shift Handover Report Card...")
        await page.wait_for_selector("text=BÁO CÁO ĐỐI SOÁT GIAO BAN CA TRỰC", timeout=12000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/19_shift_handover_audit_card.png")
        print("Captured 19_shift_handover_audit_card.png")

        # 3. Click "Xem & In Phiếu Đối Soát (Mẫu 4)"
        print("Opening Form 4 from Handover Card...")
        open_form4_btn = page.locator("button:has-text('Xem & In Phiếu Đối Soát')")
        await open_form4_btn.click()
        await page.wait_for_selector("text=PHIẾU XUẤT MƯỢN KHẨN", timeout=8000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/20_shift_handover_form4_modal.png")
        print("Captured 20_shift_handover_form4_modal.png")

        # Close Modal
        close_btn = page.locator("[data-testid='close-printable-modal']")
        await close_btn.click()
        await page.wait_for_timeout(500)

        # 4. Test Low-Stock Scan & Restock Proposal (Mẫu 01/TT22)
        print("Testing Low-Stock Restock Proposal...")
        restock_chip = page.locator("button:has-text('Lập dự trù bù thuốc Mẫu 01')")
        if await restock_chip.count() > 0:
            await restock_chip.first.click()
        else:
            chat_input = page.locator("input[placeholder*='Nhập yêu cầu lâm sàng']")
            await chat_input.fill("Kiểm tra các mặt hàng chạm ngưỡng Min và lập phiếu dự trù Mẫu 01/TT22")
            await page.locator("button[title='Gửi lệnh']").click()

        print("Waiting for Restock Proposal Card...")
        await page.wait_for_selector("button:has-text('Mở & In Phiếu Dự Trù')", timeout=12000)
        await page.wait_for_timeout(800)
        
        # Click "Mở & In Phiếu Dự Trù"
        open_form2_btn = page.locator("button:has-text('Mở & In Phiếu Dự Trù')")
        await open_form2_btn.click()
        await page.wait_for_selector("text=PHIẾU DỰ TRÙ THUỐC", timeout=8000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/21_restock_proposal_form2_modal.png")
        print("Captured 21_restock_proposal_form2_modal.png")

        # Close Modal
        close_btn = page.locator("[data-testid='close-printable-modal']")
        await close_btn.click()
        await page.wait_for_timeout(500)

        # 5. Test Voice Modal (Hands-free Voice Dictation in Vietnamese)
        print("Testing Voice Modal...")
        mic_btn = page.locator("button[title='Giọng nói lâm sàng']")
        await mic_btn.click()
        await page.wait_for_selector("text=Ra Lệnh Giọng Nói Y Tế", timeout=8000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/22_voice_modal_dictation.png")
        print("Captured 22_voice_modal_dictation.png")

        # Close Voice Modal
        close_voice = page.locator("button:has-text('Đóng')")
        if await close_voice.count() > 0:
            await close_voice.first.click()
        else:
            await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # 6. Test Clinical Guidelines Query (TT 51 Adrenalin anaphylaxis)
        print("Testing Clinical Guidelines Query (TT 51)...")
        chat_input = page.locator("input[placeholder*='Nhập yêu cầu lâm sàng']")
        await chat_input.fill("Phác đồ cấp cứu sốc phản vệ khẩn cấp Thông tư 51 tiêm Adrenalin thế nào?")
        await page.locator("button[title='Gửi lệnh']").click()
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/23_clinical_guidelines_response.png")
        print("Captured 23_clinical_guidelines_response.png")

        await browser.close()
        print("E2E tests for Advanced AI Copilot completed successfully!")

if __name__ == "__main__":
    asyncio.run(run())
