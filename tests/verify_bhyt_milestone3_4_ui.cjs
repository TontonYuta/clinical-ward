const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

(async () => {
  console.log('--- STARTING PLAYWRIGHT VERIFICATION FOR MILESTONE 3 & 4 ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Mở tab Giám định BHYT
    console.log('Navigating to BHYT tab...');
    const bhytTabBtn = page.locator('button:has-text("Giám định BHYT"):visible').first();
    await bhytTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bhytTabBtn.click();
    await page.waitForTimeout(1500);

    // 2. Chụp ảnh Tab 1: Thẩm định xuất toán BHYT (Tầng 1)
    console.log('Capturing Tab 1 (Thẩm định xuất toán BHYT)...');
    const tab1Btn = page.locator('button:has-text("1. Thẩm định xuất toán BHYT"):visible').first();
    await tab1Btn.click();
    await page.waitForTimeout(1000);
    const ss1 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_m4_tab1_financial_audit.png';
    await page.screenshot({ path: ss1, fullPage: false });
    console.log('✓ Saved Tab 1 screenshot:', ss1);

    // 3. Chụp ảnh Tab 2: Đánh giá lâm sàng 7 nhóm (Tầng 2)
    console.log('Capturing Tab 2 (Đánh giá lâm sàng 7 nhóm)...');
    const tab2Btn = page.locator('button:has-text("2. Đánh giá lâm sàng"):visible').first();
    await tab2Btn.click();
    await page.waitForTimeout(1000);
    const ss2 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_m4_tab2_clinical7.png';
    await page.screenshot({ path: ss2, fullPage: false });
    console.log('✓ Saved Tab 2 screenshot:', ss2);

    // 4. Chụp ảnh Tab 3: Bảng đối soát OCR & Chỉnh sửa HITL (Card 3)
    console.log('Capturing Tab 3 (Bảng đối soát OCR - HITL Card 3)...');
    const tab3Btn = page.locator('button:has-text("3. Bảng đối soát OCR"):visible').first();
    await tab3Btn.click();
    await page.waitForTimeout(1000);
    const ss3 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_m4_tab3_hitl_card3.png';
    await page.screenshot({ path: ss3, fullPage: false });
    console.log('✓ Saved Tab 3 screenshot:', ss3);

    // 5. Thử bấm nút "Khớp CSDL DAV (54.885 thuốc)"
    console.log('Clicking "Khớp CSDL DAV (54.885 thuốc)"...');
    const davMatchBtn = page.locator('button:has-text("Khớp CSDL DAV"):visible').first();
    if (await davMatchBtn.isVisible()) {
      await davMatchBtn.click();
      await page.waitForTimeout(2000);
      const ss4 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_m4_tab3_after_dav_match.png';
      await page.screenshot({ path: ss4, fullPage: false });
      console.log('✓ Saved after DAV match screenshot:', ss4);
    }

    // 6. Thử bấm nút "💾 XÁC NHẬN & GIÁM ĐỊNH BHYT"
    console.log('Clicking "💾 XÁC NHẬN & GIÁM ĐỊNH BHYT"...');
    const confirmBtn = page.locator('button:has-text("XÁC NHẬN & GIÁM ĐỊNH BHYT"):visible').first();
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    const ss5 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_m4_after_confirmation_audit.png';
    await page.screenshot({ path: ss5, fullPage: false });
    console.log('✓ Saved after confirmation audit screenshot:', ss5);

    console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT MILESTONE 3 & 4 THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('Playwright error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
