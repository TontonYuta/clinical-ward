const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('=== VERIFYING SMART DRUG SUBSTITUTION (1-CLICK BHYT) UI & E2E FLOW ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Chuyển sang Tab Giám định BHYT
    console.log('1. Navigating to BHYT Adjudication tab...');
    const bhytTabBtn = page.locator('button:has-text("Giám định BHYT"):visible').first();
    await bhytTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bhytTabBtn.click();
    await page.waitForTimeout(1500);

    // 2. Tải lên đơn thuốc có vi phạm (Meropenem / Nexium...)
    console.log('2. Uploading prescription sample to trigger adjudication...');
    const sampleImgPath = path.resolve('/home/tontonyuta/Downloads/DoAn2/public/samples/don_thuoc_mau_chuan_bo_y_te.png');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(sampleImgPath);
    await page.waitForTimeout(1000);

    // 3. Bấm Nút "PHÂN TÍCH ĐƠN"
    console.log('3. Clicking "PHÂN TÍCH ĐƠN"...');
    const mainAnalyzeBtn = page.locator('button:has-text("PHÂN TÍCH ĐƠN"):visible').first();
    await mainAnalyzeBtn.click();
    await page.waitForTimeout(4000);

    // 4. Kiểm tra nút "⚡ Đổi thuốc" xuất hiện trong bảng ở Bước 1
    console.log('4. Checking quick substitute buttons in Tab 1 (Table)...');
    const quickSubBtn = page.locator('button[data-testid^="btn-quick-substitute-"]:visible').first();
    await quickSubBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Quick substitute button found on medicine table row.');

    // 5. Chuyển sang Tab 3: Thẩm định xuất toán BHYT
    console.log('5. Navigating to Tab 3: Thẩm định xuất toán BHYT...');
    const tab3Btn = page.locator('button:has-text("3. Thẩm định xuất toán"):visible').first();
    await tab3Btn.click();
    await page.waitForTimeout(1500);

    // 6. Kiểm tra nút "⚡ Gợi ý thuốc thay thế BHYT (1-Click)" trên thẻ vi phạm
    console.log('6. Finding "⚡ Gợi ý thuốc thay thế BHYT (1-Click)" button...');
    const subViolationBtn = page.locator('button:has-text("Gợi ý thuốc thay thế BHYT"):visible').first();
    await subViolationBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Found 1-Click Substitution button on violation card.');

    // 7. Click để mở Modal Gợi Ý Thuốc Thay Thế BHYT
    console.log('7. Opening Smart Drug Substitution Modal...');
    await subViolationBtn.click();
    await page.waitForTimeout(1500);

    // Kiểm tra Modal hiển thị đầy đủ
    const modal = page.locator('[data-testid="bhyt-substitution-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Smart Drug Substitution Modal opened successfully!');

    // Chụp ảnh Modal gợi ý thuốc thay thế
    const ssModal = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_substitution_modal_view.png';
    await page.screenshot({ path: ssModal, fullPage: false });
    console.log('  ✓ Saved substitution modal screenshot:', ssModal);

    // 8. Bấm nút "⚡ Áp dụng thay thế thuốc này"
    console.log('8. Clicking "⚡ Áp dụng thay thế thuốc này"...');
    const applyBtn = page.locator('button:has-text("Áp dụng thay thế thuốc này"):visible').first();
    await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await applyBtn.click();
    await page.waitForTimeout(1500);

    // 9. Xác nhận Modal đã đóng và Banner thông báo xuất hiện
    console.log('9. Verifying modal closed & success notification toast displayed...');
    const modalClosed = (await modal.count()) === 0 || !(await modal.isVisible());
    if (!modalClosed) {
      throw new Error('FAIL: Modal did not close after applying substitution!');
    }
    console.log('  ✓ Modal closed cleanly.');

    // Kiểm tra thông báo toast thành công
    const toast = page.locator('text=Đã thay thế').first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    const toastText = await toast.textContent();
    console.log(`  ✓ Toast Notification confirmed: "${toastText.trim()}"`);

    // 10. Chụp ảnh kết quả đơn thuốc sau khi thay thế hợp lệ BHYT
    const ssResolved = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_after_substitution_resolved.png';
    await page.screenshot({ path: ssResolved, fullPage: false });
    console.log('  ✓ Saved resolved prescription state screenshot:', ssResolved);

    console.log('🎉 TOÀN BỘ KIỂM THỬ E2E SMART DRUG SUBSTITUTION ĐÃ ĐẠT 100% GREEN!');
  } catch (err) {
    console.error('Playwright Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
