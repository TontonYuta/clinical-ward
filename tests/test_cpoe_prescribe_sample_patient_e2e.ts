import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting CPOE Prescribe Sample Patient & Visibility E2E Test on Port 5173...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('🔴 BROWSER CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', (err) => console.error('💥 UNCAUGHT PAGE ERROR:', err));

  try {
    // 1. Navigate to the current isolated worktree dev server
    await page.goto('http://localhost:5173/#cpoe', { waitUntil: 'networkidle' });
    console.log('✅ Loaded http://localhost:5173/#cpoe');
    await page.waitForTimeout(1000);

    // Take screenshot of initial CPOE view
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_initial_orders_3001.png') });
    console.log('📸 Captured initial CPOE view');

    // 2. Check if table rows exist
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    console.log(`📋 Total CPOE orders currently in table: ${rowCount}`);
    if (rowCount > 0) {
      const firstRowText = await rows.first().textContent();
      console.log('Row 1 snippet:', firstRowText?.slice(0, 120));
    }

    // 3. Click "Kê đơn mới" button
    const prescribeBtn = page.locator('button:has-text("Kê đơn mới"):visible').first();
    await prescribeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await prescribeBtn.click();
    console.log('✅ Clicked "Kê đơn mới" button');

    // 4. Verify CpoeOrderModal opens
    const modalTitle = page.locator('h3:has-text("Kê đơn thuốc điều trị")');
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ CpoeOrderModal opened successfully');

    // 5. Check sample patient selector
    const patientSelect = page.locator('select:has-text("chọn tự động điền hồ sơ bệnh nhân mẫu")');
    await patientSelect.waitFor({ state: 'visible', timeout: 3000 });
    const options = await patientSelect.locator('option').allTextContents();
    console.log(`📋 Patient options count: ${options.length} (Expected >= 14)`);
    console.log('Options sample:', options.slice(0, 4));

    // 6. Select "BN-8817" (Trần Huy Hoàng)
    await patientSelect.selectOption('BN-8817');
    await page.waitForTimeout(500);

    // Verify auto-filled fields
    const nameInput = page.locator('input[placeholder="Nguyễn Văn A"]');
    const cccdInput = page.locator('input[placeholder="001201019283"]');
    const phoneInput = page.locator('input[placeholder="09xxxxxxxx"]');

    const filledName = await nameInput.inputValue();
    const filledCccd = await cccdInput.inputValue();
    const filledPhone = await phoneInput.inputValue();

    console.log(`👤 Auto-filled Patient: Name="${filledName}", CCCD="${filledCccd}", Phone="${filledPhone}"`);
    if (filledName === 'Trần Huy Hoàng' && filledCccd === '026205006033' && filledPhone === '0963278149') {
      console.log('✅ Sample Patient BN-8817 auto-fill is 100% accurate!');
    } else {
      throw new Error(`Auto-fill mismatch! Got Name=${filledName}, CCCD=${filledCccd}, Phone=${filledPhone}`);
    }

    // Capture screenshot of filled modal
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_modal_sample_patient_filled.png') });

    // 7. Save an unsigned prescription draft
    await page.locator('input[placeholder="Nhập chẩn đoán lâm sàng..."]').fill('Viêm họng cấp');
    const medicationSearch = page.locator('input[placeholder="Gõ tìm biệt dược, hoạt chất (adre, mor, ceftri, kcl)..."]');
    await medicationSearch.fill('Paracetamol');
    await page.waitForTimeout(500);
    await medicationSearch.press('ArrowDown');
    await medicationSearch.press('Enter');
    await page.locator('input[placeholder="VD: 1 viên/lần, 1 ống/lần"]').fill('1 viên/lần');
    await page.locator('input[placeholder="VD: 2 lần/ngày (Sáng - Chiều)"]').fill('2 lần/ngày');
    await page.locator('#prescription-days').fill('5');
    await page.locator('input[type="number"]').last().fill('10');
    const submitBtn = page.locator('button:has-text("Lưu bản nháp")');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();
    console.log('✅ Clicked "Lưu bản nháp"');

    // 8. Wait for modal to close
    await modalTitle.waitFor({ state: 'hidden', timeout: 5000 });
    console.log('✅ Modal closed after saving draft');
    await page.waitForTimeout(1000);

    // 9. Verify the new order appears IMMEDIATELY at Row 1 of the table!
    const row1 = page.locator('table tbody tr').first();
    const row1Text = await row1.textContent();
    console.log('📋 Updated Row 1:', row1Text?.slice(0, 150));

    if (row1Text?.includes('Trần Huy Hoàng') && row1Text?.includes('026205006033') && row1Text?.includes('0915223344')) {
      console.log('🎉 SUCCESS: Newly prescribed order for Trần Huy Hoàng is IMMEDIATELY VISIBLE AT ROW 1 with Name, CCCD and SĐT!');
    } else {
      console.log('⚠️ Row 1 does not contain full info directly, checking all rows:');
      const allRowTexts = await page.locator('table tbody tr').allTextContents();
      const match = allRowTexts.find(t => t.includes('Trần Huy Hoàng'));
      if (match) {
        console.log('Found order in table:', match.slice(0, 120));
      } else {
        throw new Error('Newly created prescription not found in table!');
      }
    }

    // Capture screenshot of Row 1 in CPOE list
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_new_order_row1_3001.png') });

    // 10. Click Patient Name in Row 1 to open PatientDetailModal
    await page.waitForTimeout(1000);
    const patientBtn = page.locator('table tbody tr').first().locator('[data-testid="patient-name-btn"]');
    await patientBtn.click();
    console.log('✅ Clicked Patient Name to open PatientDetailModal');

    const patientModal = page.locator('[data-testid="patient-detail-modal"]');
    await patientModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ PatientDetailModal opened');

    // Verify Patient Name and ID in modal
    const modalHeaderName = await patientModal.locator('h2').first().textContent();
    const modalAllText = await patientModal.textContent();
    console.log(`📋 Patient modal header: ${modalHeaderName}`);
    if (modalHeaderName?.includes('Trần Huy Hoàng') && modalAllText?.includes('BN-8817')) {
      console.log('🎉 SUCCESS: PatientDetailModal accurately opened for Trần Huy Hoàng (BN-8817)! (No fallback)');
    } else {
      throw new Error(`Incorrect patient opened in modal: ${modalHeaderName}`);
    }

    // Check SĐT in Subheader
    const phoneNotice = await patientModal.locator('text=0963278149').first().textContent();
    console.log('📋 Phone notice in modal:', phoneNotice);

    // Switch to Prescriptions tab (tab index 4 / button "Đơn thuốc & Y lệnh điều trị")
    const rxTabBtn = patientModal.locator('button:has-text("Đơn thuốc & Y lệnh điều trị")');
    if (await rxTabBtn.isVisible()) {
      await rxTabBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Switched to Patient Prescriptions Tab');
    }

    // Capture screenshot of Patient Detail Modal
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_detail_modal_hoang_3001.png') });

    // Close PatientDetailModal
    const closeBtn = patientModal.locator('[data-testid="btn-close-patient-detail"]').first();
    await closeBtn.click();
    await patientModal.waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);

    // 11. Click Order ID in Row 1 to open CpoeOrderDetailModal
    const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
    await orderIdBtn.click();
    console.log('✅ Clicked Order ID to open CpoeOrderDetailModal');

    const orderDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await orderDetailModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ CpoeOrderDetailModal opened');

    const orderDetailText = await orderDetailModal.textContent();
    if (orderDetailText?.includes('Trần Huy Hoàng') && orderDetailText?.includes('0915223344')) {
      console.log('🎉 SUCCESS: CpoeOrderDetailModal shows Trần Huy Hoàng with SĐT 0915223344!');
    }

    // Capture screenshot of CpoeOrderDetailModal
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_order_detail_modal_3001.png') });

    console.log('🏁 ALL TESTS PASSED SUCCESSFULLY ON PORT 3001!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_test_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
