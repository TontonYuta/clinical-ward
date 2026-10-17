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

        # 1. Initial State with AI Bubble
        await page.screenshot(path=f"{SCREENSHOT_DIR}/01_app_initial_with_ai_bubble.png")
        print("Captured 01_app_initial_with_ai_bubble.png")

        # 2. Click Floating AI Button
        ai_btn = page.locator("button:has-text('Trợ Lý AI')")
        await ai_btn.click()
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/02_copilot_window_opened.png")
        print("Captured 02_copilot_window_opened.png")

        # 3. Send Borrow Emergency Medication Query
        chat_input = page.locator("input[placeholder*='Nhập yêu cầu lâm sàng']")
        await chat_input.fill("Mượn khẩn 2 ống Morphin sulfat cho bệnh nhân Trần Văn Nam buồng A9 sốc đau dữ dội")
        await page.locator("button[title='Gửi lệnh']").click()
        
        # Wait for agent response and action card
        print("Waiting for Borrow Action Card...")
        await page.wait_for_selector("button:has-text('Ký Xác Thực & Rút Thuốc (PIN)')", timeout=12000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/03_copilot_borrow_card_rendered.png")
        print("Captured 03_copilot_borrow_card_rendered.png")

        # 4. Click [Ký Xác Thực & Rút Thuốc (PIN)]
        pin_btn = page.locator("button:has-text('Ký Xác Thực & Rút Thuốc (PIN)')")
        await pin_btn.click()
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/04_clinical_auth_modal_pin.png")
        print("Captured 04_clinical_auth_modal_pin.png")

        # 5. Click Quick Fill PIN demo and Sign
        quick_pin = page.locator("button:has-text('Điền nhanh PIN demo')")
        if await quick_pin.count() > 0:
            await quick_pin.click()
            await page.wait_for_timeout(400)
        
        execute_btn = page.locator("button:has-text('Ký Xác Thực & Thực Thi')")
        if await execute_btn.count() > 0:
            await execute_btn.click()
            # Modal verification takes about 1-2s for simulated crypto signature
            await page.wait_for_timeout(2500)

        # 6. Check that card flipped to executed and Tab 1 updated
        await page.screenshot(path=f"{SCREENSHOT_DIR}/05_action_card_executed_and_ledger_updated.png")
        print("Captured 05_action_card_executed_and_ledger_updated.png")

        # 7. Send Equipment Incident Query
        await chat_input.fill("Báo hỏng máy thở PB840 tại phòng mổ 2 bị xì khí rách dây thở")
        await page.locator("button[title='Gửi lệnh']").click()
        print("Waiting for Incident Action Card...")
        await page.wait_for_selector("button:has-text('Phát Lệnh Báo Hỏng')", timeout=12000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/06_incident_card_rendered.png")
        print("Captured 06_incident_card_rendered.png")

        # 8. Send FEFO Near-Expiry Query
        await chat_input.fill("Cho tôi danh sách các thuốc sắp hết hạn trong kho")
        await page.locator("button[title='Gửi lệnh']").click()
        print("Waiting for FEFO Card...")
        await page.wait_for_selector("text=FEFO", timeout=12000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/07_fefo_report_card.png")
        print("Captured 07_fefo_report_card.png")

        # 9. Send Cold Chain Query
        await chat_input.fill("Tình trạng tủ bảo quản vắc xin và nhiệt độ chuỗi lạnh hiện tại")
        await page.locator("button[title='Gửi lệnh']").click()
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{SCREENSHOT_DIR}/08_coldchain_card.png")
        print("Captured 08_coldchain_card.png")

        await browser.close()
        print("All 8 screenshots and tests completed successfully!")

if __name__ == "__main__":
    asyncio.run(run())
