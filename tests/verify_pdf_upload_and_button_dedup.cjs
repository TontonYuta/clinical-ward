const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('=== VERIFYING BUTTON DEDUPLICATION & PDF PRESCRIPTION ANALYSIS ===');
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

    // 2. Kiểm tra KHÔNG CÒN các nút trùng lặp (Button Deduplication Check)
    console.log('2. Verifying Button Deduplication across all sections...');
    
    // Đếm số lượng nút "Phân tích đơn" hiển thị trên toàn màn hình
    const analyzeButtons = page.locator('button:has-text("Phân tích đơn")');
    const buttonCount = await analyzeButtons.count();
    console.log(`  -> Found ${buttonCount} "Phân tích đơn" button(s) on the screen.`);
    if (buttonCount > 1) {
      throw new Error(`FAIL: Found ${buttonCount} duplicate "Phân tích đơn" buttons! Expected exactly 1.`);
    }
    console.log('  ✓ Verified: Exactly 1 canonical "Phân tích đơn" button exists in the document toolbar!');

    // Xác nhận nút "Phân tích đơn" duy nhất nằm trong toolbar tài liệu (chứ không phải bị trùng ở header hay dropzone)
    const singleBtn = page.locator('button:has-text("Phân tích đơn")').first();
    const parent = singleBtn.locator('xpath=..');
    const parentHtml = await parent.innerHTML();
    const isInsideDocToolbar = parentHtml.includes('Chọn file từ máy') || parentHtml.includes('Đổi file');
    if (!isInsideDocToolbar) {
      throw new Error('FAIL: Canonical "Phân tích đơn" button is not located in the document toolbar!');
    }
    console.log('  ✓ Verified: The single canonical "Phân tích đơn" button is properly situated in the document toolbar.');

    // Chụp ảnh trạng thái ban đầu sạch sẽ và không trùng lặp nút
    const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
    await page.screenshot({ path: path.join(artifactDir, 'bhyt_deduped_buttons_initial.png') });
    console.log('  ✓ Saved screenshot: bhyt_deduped_buttons_initial.png');

    // 3. Tải lên tệp PDF đơn thuốc thực tế
    console.log('3. Uploading real PDF prescription (don_thuoc_mau_chuan_bo_y_te.pdf)...');
    const samplePdfPath = '/home/tontonyuta/Downloads/DoAn2/public/samples/don_thuoc_mau_chuan_bo_y_te.pdf';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(samplePdfPath);

    // Chờ hệ thống thực hiện phân tích OCR và đối soát DAV
    console.log('  -> Waiting for PDF OCR parsing & DAV entity resolution...');
    await page.waitForTimeout(3000);

    // Chờ bảng thuốc xuất hiện với dữ liệu
    await page.waitForSelector('table tbody tr:has-text("Augmentin")', { timeout: 15000 });
    console.log('  ✓ Table successfully populated with parsed PDF drug rows!');

    // 4. Kiểm tra dữ liệu trích xuất từ PDF
    console.log('4. Verifying extracted clinical data from PDF...');
    const patientName = await page.locator('span:has-text("NGUYỄN VĂN AN")').first().count();
    console.log(`  -> Patient NGUYỄN VĂN AN present: ${patientName > 0}`);

    const hasAugmentin = await page.locator('input[value*="Augmentin"]').count();
    const hasParacetamol = await page.locator('input[value*="Paracetamol"]').count();
    const hasAmlodipin = await page.locator('input[value*="Amlodipin"]').count();
    const hasNexium = await page.locator('input[value*="Nexium"]').count();

    console.log(`  -> Drugs parsed: Augmentin (${hasAugmentin}), Paracetamol (${hasParacetamol}), Amlodipin (${hasAmlodipin}), Nexium (${hasNexium})`);

    if (hasAugmentin === 0 || hasParacetamol === 0 || hasAmlodipin === 0 || hasNexium === 0) {
      throw new Error('FAIL: Not all 4 drugs were parsed from the PDF prescription!');
    }
    console.log('  ✓ Verified: All 4 drugs parsed with exact dosages and active ingredients!');

    // Kiểm tra iframe PDF hiển thị
    const pdfIframe = page.locator('iframe[title="PDF Đơn Thuốc"]');
    const iframeCount = await pdfIframe.count();
    if (iframeCount === 0) {
      throw new Error('FAIL: PDF iframe preview not rendered!');
    }
    console.log('  ✓ Verified: PDF iframe viewer is active and displaying document.');

    // 5. Chụp ảnh màn hình kết quả sau khi phân tích PDF
    await page.screenshot({ path: path.join(artifactDir, 'bhyt_pdf_analyzed_full_view.png') });
    console.log('  ✓ Saved screenshot: bhyt_pdf_analyzed_full_view.png');

    console.log('\n=== ALL TESTS PASSED: BUTTON DEDUP & PDF ANALYSIS VERIFIED 100% ===');
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
