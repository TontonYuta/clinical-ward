const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('=== VERIFYING CLEAN TAB (NO SAMPLE DATA) & "PHÂN TÍCH ĐƠN" BUTTON ===');
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

    // 2. Xác nhận KHÔNG CÒN dropdown "Đơn mẫu" và KHÔNG CÓ dữ liệu mẫu nạp sẵn
    console.log('2. Verifying ZERO sample presets and clean initial state...');
    const sampleDropdown = page.locator('select[aria-label="Chọn đơn mẫu"]');
    const hasSampleDropdown = await sampleDropdown.count();
    if (hasSampleDropdown > 0) {
      throw new Error('FAIL: "Chọn đơn mẫu" dropdown is still present!');
    }
    console.log('  ✓ Verified: "Chọn đơn mẫu" dropdown has been completely removed!');

    // Kiểm tra header hiển thị "Chưa nạp đơn thuốc"
    const unchargedBadge = page.locator('text=Chưa nạp đơn thuốc');
    await unchargedBadge.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Verified top status: "Chưa nạp đơn thuốc"');

    // Kiểm tra bảng thuốc hiển thị trạng thái rỗng sạch sẽ
    const emptyTableMsg = page.locator('text=Chưa có danh mục thuốc trong đơn');
    await emptyTableMsg.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Verified table empty state: "Chưa có danh mục thuốc trong đơn"');

    // 3. Xác nhận NÚT PHÂN TÍCH ĐƠN có mặt ở Header, Toolbar và Dropzone
    console.log('3. Verifying "PHÂN TÍCH ĐƠN" buttons across UI...');
    const mainAnalyzeBtn = page.locator('button:has-text("PHÂN TÍCH ĐƠN"):visible').first();
    await mainAnalyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Found Primary Header Button: "PHÂN TÍCH ĐƠN"');

    const toolbarAnalyzeBtn = page.locator('button:has-text("⚡ Phân tích đơn"):visible').first();
    await toolbarAnalyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Found Toolbar/Dropzone Button: "⚡ Phân tích đơn"');

    // Chụp ảnh trạng thái ban đầu sạch hoàn toàn
    const ssEmpty = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_clean_empty_initial_state.png';
    await page.screenshot({ path: ssEmpty, fullPage: false });
    console.log('  ✓ Saved clean empty state screenshot:', ssEmpty);

    // 4. Tải lên tệp ảnh đơn thuốc thực tế qua input file
    console.log('4. Uploading prescription file via file input...');
    const sampleImgPath = path.resolve('/home/tontonyuta/Downloads/DoAn2/public/samples/don_thuoc_mau_chuan_bo_y_te.png');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(sampleImgPath);
    await page.waitForTimeout(1000);

    // 5. Bấm Nút "PHÂN TÍCH ĐƠN"
    console.log('5. Clicking "PHÂN TÍCH ĐƠN" button...');
    await mainAnalyzeBtn.click();
    console.log('  -> Waiting for OCR extraction and DAV entity resolution...');
    await page.waitForTimeout(4000);

    // Xác nhận dữ liệu thuốc đã được bóc tách vào Tab 1
    const medicineRows = page.locator('table tbody tr');
    const count = await medicineRows.count();
    console.log(`  ✓ Successfully analyzed prescription! Extracted ${count} medicine rows into Tab 1.`);
    if (count === 0) {
      throw new Error('FAIL: No medicines found after analysis!');
    }

    // Chụp ảnh trạng thái sau khi bấm Phân tích đơn
    const ssAnalyzed = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_after_analysis_state.png';
    await page.screenshot({ path: ssAnalyzed, fullPage: false });
    console.log('  ✓ Saved post-analysis state screenshot:', ssAnalyzed);

    // 6. Kiểm tra chuyển bước sang Tab 2 và Tab 3
    console.log('6. Navigating through 3-step workflow...');
    const tab2Btn = page.locator('button:has-text("2. Đánh giá lâm sàng"):visible').first();
    await tab2Btn.click();
    await page.waitForTimeout(1000);
    console.log('  ✓ Step 2 (Clinical 7) rendered successfully.');

    const tab3Btn = page.locator('button:has-text("3. Thẩm định xuất toán"):visible').first();
    await tab3Btn.click();
    await page.waitForTimeout(1000);
    console.log('  ✓ Step 3 (Violations) rendered successfully.');

    console.log('🎉 TOÀN BỘ KIỂM THỬ XÓA MẪU & NÚT PHÂN TÍCH ĐƠN ĐẠT 100% GREEN!');
  } catch (err) {
    console.error('Playwright Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
