import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACT_DIR = Path("/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://localhost:3001...")
        await page.goto("http://localhost:3001", wait_until="networkidle", timeout=15000)
        await asyncio.sleep(1.5)

        # 1. Telemetry Tab
        screenshot_1 = ARTIFACT_DIR / "admin_portal_telemetry_live.png"
        await page.screenshot(path=str(screenshot_1), full_page=False)
        print(f"Captured: {screenshot_1}")

        # 2. Click Key Vault Tab
        await page.click("button:has-text('Bể Khóa API Key')")
        await asyncio.sleep(0.8)
        screenshot_2 = ARTIFACT_DIR / "admin_portal_key_vault_live.png"
        await page.screenshot(path=str(screenshot_2), full_page=False)
        print(f"Captured: {screenshot_2}")

        # 3. Click Budget Cap Tab
        await page.click("button:has-text('Ngân Sách Token')")
        await asyncio.sleep(0.8)
        screenshot_3 = ARTIFACT_DIR / "admin_portal_budget_cap_live.png"
        await page.screenshot(path=str(screenshot_3), full_page=False)
        print(f"Captured: {screenshot_3}")

        # 4. Click Safety Audit Tab
        await page.click("button:has-text('Nhật Ký An Toàn')")
        await asyncio.sleep(0.8)
        screenshot_4 = ARTIFACT_DIR / "admin_portal_safety_audit_live.png"
        await page.screenshot(path=str(screenshot_4), full_page=False)
        print(f"Captured: {screenshot_4}")

        await browser.close()
        print("Console errors:", console_errors)

if __name__ == "__main__":
    asyncio.run(main())
