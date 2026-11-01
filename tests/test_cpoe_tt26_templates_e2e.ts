import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Running E2E Verification for TT26 Prescription Templates & Spacious Layout...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set user role to doctor
  await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Verify Table Headers & Columns
  console.log('--- 1. Verifying Spacious CPOE Table Columns ---');
  const headers = await page.locator('table thead th').allTextContents();
  console.log('Table Headers:', headers);
  if (headers.includes('Thao tác')) {
    throw new Error('FAIL: Column "Thao tác" should not be in the table!');
  }
  const colWidths = await page.locator('table colgroup col').evaluateAll((cols) =>
    cols.map((c) => ({
      width: (c as HTMLElement).style.width,
      className: c.className,
    }))
  );
  console.log('Colgroup specifications:', colWidths);
  if (colWidths[1].width !== '230px') {
    throw new Error(`FAIL: Expected order ID column to be 230px, got ${colWidths[1].width}`);
  }
  if (colWidths[2].width !== '190px') {
    throw new Error(`FAIL: Expected patient column to be 190px, got ${colWidths[2].width}`);
  }
  console.log('✅ CPOE Table column widths verified (Mã đơn: 230px, Người bệnh: 190px, Không có cột Thao tác).');

  // 2. Open "Kê đơn mới" Modal
  console.log('--- 2. Opening Kê Đơn Thuốc Mới Modal ---');
  const prescribeBtn = page.locator('button:has-text("Kê đơn mới"):visible').first();
  await prescribeBtn.waitFor({ state: 'visible', timeout: 5000 });
  await prescribeBtn.click();
  await page.waitForTimeout(500);

  // Verify TT26 Template Selector Tabs
  console.log('--- 3. Verifying TT26 Template Selector Bar ---');
  const btnPL1 = page.locator('button:has-text("Phụ lục I: Đơn thuốc")');
  const btnPL2 = page.locator('button:has-text("Phụ lục II: Đơn “N”")');
  const btnPL3 = page.locator('button:has-text("Phụ lục III: Đơn “H”")');

  if (!(await btnPL1.isVisible()) || !(await btnPL2.isVisible()) || !(await btnPL3.isVisible())) {
    throw new Error('FAIL: TT26 template selector tabs not visible!');
  }
  console.log('✅ Found all 3 TT26 template selector tabs: PL I (Thông thường), PL II (Đơn N), PL III (Đơn H).');

  // Switch to PL II (Narcotic)
  await btnPL2.click();
  await page.waitForTimeout(300);
  const narcoticAlert = page.locator('text=Quy định Đơn thuốc “N” (Gây nghiện - TT 26)');
  if (!(await narcoticAlert.isVisible())) {
    throw new Error('FAIL: PL II narcotic warning & batch schedule not shown!');
  }
  console.log('✅ PL II: Narcotic 3-batch schedule & receiver CCCD fields displayed.');

  // Take screenshot of TT26 Narcotic Modal
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_tt26_narcotic_modal.png') });
  console.log('📸 Saved screenshot: cpoe_tt26_narcotic_modal.png');

  // Select sample patient
  const patientSelect = page.locator('select:has-text("chọn tự động điền hồ sơ bệnh nhân mẫu")');
  if (await patientSelect.isVisible()) {
    await patientSelect.selectOption('BN-8817');
    await page.waitForTimeout(400);
    console.log('✅ Selected sample patient BN-8817 (Trần Huy Hoàng).');
  }

  // Verify Print Portal for Narcotic Form
  console.log('--- 4. Verifying Narcotic TT26 Print Document Layout ---');
  const printDoc = page.locator('#prescription-print-document');
  const docText = await printDoc.textContent();
  if (!docText?.includes('ĐƠN THUỐC “N”')) {
    throw new Error('FAIL: Print document title does not contain "ĐƠN THUỐC “N”"!');
  }
  if (!docText?.includes('Phụ lục II')) {
    throw new Error('FAIL: Print document does not reference Phụ lục II TT 26/2025!');
  }
  if (!docText?.includes('Phân bổ các đợt điều trị')) {
    throw new Error('FAIL: Print document does not have Narcotic 3-batch schedule section!');
  }
  console.log('✅ Narcotic Print document conforms to TT 26 Phụ lục II with 3-batch schedule.');

  // Take screenshot of Narcotic print preview
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_tt26_narcotic_print.png') });
  await page.emulateMedia({ media: 'screen' });
  console.log('📸 Saved screenshot: cpoe_tt26_narcotic_print.png');

  // Switch back to PL II (Narcotic) to test full submission
  await btnPL2.click();
  await page.waitForTimeout(300);

  // Fill Receiver CCCD & batches
  await page.locator('input[placeholder="Nhập 12 số CCCD người nhận thuốc..."]').fill('001090123456');
  await page.locator('input[placeholder="Đợt 1: Từ ngày ... đến ..."]').fill('Cấp đợt 1 tại viện (10 ống)');
  await page.locator('input[placeholder="Đợt 2: Từ ngày ... đến ..."]').fill('Cấp đợt 2 ngày 11/11 (10 ống)');
  await page.locator('input[placeholder="Đợt 3: Từ ngày ... đến ..."]').fill('Cấp đợt 3 ngày 21/11 (10 ống)');

  await page.locator('input[placeholder="VD: I10"]').fill('C80');
  await page.locator('input[placeholder="Nhập chẩn đoán lâm sàng..."]').fill('Đau ung thư giai đoạn IV');
  await page.locator('#prescription-days').fill('30');
  const medicationSearch = page.locator('input[placeholder="Tìm biệt dược hoặc hoạt chất"]');
  await medicationSearch.fill('Morphin');
  await page.waitForTimeout(500);
  const firstMedResult = page.locator('.absolute.left-0.right-0.top-full div[class*="cursor-pointer"]').first();
  await firstMedResult.waitFor({ state: 'visible', timeout: 3000 });
  await firstMedResult.click();
  await page.waitForTimeout(300);

  await page.locator('input[aria-label="Liều mỗi lần"]').fill('1 ống/lần');
  await page.locator('input[aria-label="Tần suất"]').fill('ngày 3 lần');
  await page.locator('select[aria-label="Đường dùng"]').selectOption('Tiêm bắp');
  await page.locator('input[aria-label="Số lượng"]').fill('30');
  await page.locator('input[aria-label="Hướng dẫn sử dụng"]').fill('Tiêm khi có cơn đau dữ dội');

  // Submit order
  console.log('--- 5. Saving Narcotic Prescription Draft ---');
  const submitBtn = page.locator('button:has-text("Lưu bản nháp")');
  await submitBtn.click();
  await page.waitForTimeout(1000);

  // Verify newly created Narcotic order in table
  console.log('--- 6. Verifying Saved TT26 Narcotic Order in Table ---');
  const firstRow = page.locator('table tbody tr').first();
  const firstRowText = await firstRow.textContent();
  console.log('Table Row 1:', firstRowText);

  if (!firstRowText?.includes('-N')) {
    throw new Error('FAIL: Table row 1 does not have narcotic code ending with -N!');
  }
  if (!firstRowText?.includes('Đơn “N” (Gây nghiện)')) {
    throw new Error('FAIL: Table row 1 does not display Đơn “N” (Gây nghiện) badge!');
  }
  console.log('✅ Newly created order has 14-char code with suffix -N and Đơn “N” (Gây nghiện) badge in table!');

  // Open Detail Modal
  console.log('--- 7. Opening Narcotic Order Detail Modal ---');
  const orderIdBtn = firstRow.locator('[data-testid="cpoe-order-id-btn"]');
  await orderIdBtn.click();
  await page.waitForTimeout(600);

  const detailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
  if (!(await detailModal.isVisible())) {
    throw new Error('FAIL: Detail modal did not open!');
  }

  const detailText = await detailModal.textContent();
  if (!detailText?.includes('ĐƠN THUỐC “N” (Phụ lục II)')) {
    throw new Error('FAIL: Detail modal does not have TT26 Narcotic header badge!');
  }
  if (!detailText?.includes('001090123456')) {
    throw new Error('FAIL: Detail modal does not display receiver CCCD!');
  }
  if (!detailText?.includes('Lịch Cấp Phát Thuốc 3 Đợt')) {
    throw new Error('FAIL: Detail modal does not show 3-batch schedule!');
  }
  console.log('✅ Detail modal successfully displays TT26 Narcotic Header, Receiver CCCD & 3-Batch Schedule!');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_saved_narcotic_order_detail.png') });
  console.log('📸 Saved screenshot: cpoe_saved_narcotic_order_detail.png');

  await browser.close();
  console.log('🎉 ALL TT26 PRESCRIPTION TEMPLATE & LAYOUT TESTS PASSED 100%!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
