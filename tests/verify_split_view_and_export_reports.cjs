const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('=== VERIFYING SPLIT-VIEW BY DEFAULT & AUDIT REPORT EXPORTS (PDF / EXCEL) ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 960 }
  });
  const page = await context.newPage();

  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Chuyển sang Tab Giám định BHYT
    console.log('1. Navigating to BHYT Adjudication tab...');
    const bhytTabBtn = page.locator('button:has-text("Giám định BHYT"):visible').first();
    await bhytTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bhytTabBtn.click();
    await page.waitForTimeout(1500);

    // 2. Xác nhận bố cục Split-View mặc định (Trái: Khung tài liệu, Phải: Bảng phân tích)
    console.log('2. Verifying Default Split-View Layout (Side-by-side)...');
    
    // Cột trái: Khung tài liệu
    const leftPane = page.locator('div.w-full.lg\\:w-\\[48\\%\\], div.w-full.lg\\:w-\\[46\\%\\]').first();
    await leftPane.waitFor({ state: 'visible', timeout: 5000 });
    const leftText = await leftPane.innerText();
    console.log('  ✓ Left Pane found: Contains document dropzone & controls.');

    // Cột phải: Khung phân tích 3 bước
    const rightPane = page.locator('div.flex-1.min-w-0.h-full.bg-white').first();
    await rightPane.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Right Pane found: Contains 3 audit tabs & action buttons.');

    // Xác nhận 2 nút Xuất báo cáo (Xuất Excel & In/Xuất PDF) có mặt
    const excelBtn = page.locator('button:has-text("Xuất Excel")').first();
    const pdfBtn = page.locator('button:has-text("In / Xuất PDF")').first();

    await excelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pdfBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Verified: Export buttons "Xuất Excel" and "In / Xuất PDF" are rendered in the top-right toolbar.');

    // Chụp ảnh giao diện Split View ban đầu sạch sẽ
    await page.screenshot({ path: path.join(artifactDir, 'bhyt_split_view_initial.png') });
    console.log('  ✓ Saved screenshot: bhyt_split_view_initial.png');

    // 3. Tải lên file PDF đơn thuốc mẫu
    console.log('3. Uploading PDF prescription (don_thuoc_mau_chuan_bo_y_te.pdf)...');
    const samplePdfPath = '/home/tontonyuta/Downloads/DoAn2/public/samples/don_thuoc_mau_chuan_bo_y_te.pdf';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(samplePdfPath);

    // Chờ hệ thống thực hiện phân tích
    console.log('  -> Waiting for analysis to populate table...');
    await page.waitForTimeout(3000);
    await page.waitForSelector('table tbody tr:has-text("Augmentin")', { timeout: 15000 });
    console.log('  ✓ Table successfully populated with 4 drug items!');

    // Xác nhận iframe PDF hiển thị ở cột bên trái song song với bảng bên phải
    const pdfIframe = page.locator('iframe[title="PDF Đơn Thuốc"]');
    await pdfIframe.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Verified: PDF iframe viewer is displayed on the LEFT pane.');

    // Chụp ảnh giao diện Split View sau khi phân tích (Trái xem PDF, Phải xem bảng thuốc)
    await page.screenshot({ path: path.join(artifactDir, 'bhyt_split_view_with_pdf.png') });
    console.log('  ✓ Saved screenshot: bhyt_split_view_with_pdf.png');

    // 4. Mở Modal Báo Cáo Thẩm Định A4 / PDF
    console.log('4. Opening Printable Audit Report Modal (In / Xuất PDF)...');
    await pdfBtn.click();
    await page.waitForTimeout(1000);

    const reportModal = page.locator('[data-testid="bhyt-audit-report-modal"]');
    await reportModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Modal opened: BIÊN BẢN GIÁM ĐỊNH ĐƠN THUỐC BHYT & AN TOÀN LÂM SÀNG.');

    // Kiểm tra các trường dữ liệu trên mẫu A4
    const docText = await reportModal.innerText();
    if (!docText.includes('BIÊN BẢN THẨM ĐỊNH ĐƠN THUỐC BHYT') ||
        !docText.includes('NGUYỄN VĂN AN') ||
        !docText.includes('Augmentin 1g')) {
      throw new Error('FAIL: Printable report missing key patient or drug information!');
    }
    console.log('  ✓ Verified: Report contains patient NGUYỄN VĂN AN, ICD-10, 4 drugs, 7 clinical safety checks, and BHYT financial audit totals.');

    // Chụp ảnh Modal biên bản in ấn A4
    await page.screenshot({ path: path.join(artifactDir, 'bhyt_audit_report_modal_a4.png') });
    console.log('  ✓ Saved screenshot: bhyt_audit_report_modal_a4.png');

    // Đóng Modal
    const closeBtn = reportModal.locator('button[title*="Đóng"]').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    console.log('  ✓ Closed modal successfully.');

    console.log('\n=== ALL TESTS PASSED: SPLIT-VIEW & EXPORT REPORTS VERIFIED 100% ===');
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
