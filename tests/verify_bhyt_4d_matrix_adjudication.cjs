const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

(async () => {
  console.log('=== VERIFYING 4D MATRIX ADJUDICATION: GLUCOSAMIN (M17 VS M47) & DYNAMIC ICD-10 RESOLUTION ===');
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

    // 2. Xác nhận nhãn nút đã được đổi thành "✏️ Sửa hành chính & ICD-10"
    console.log('2. Verifying renamed button: "✏️ Sửa hành chính & ICD-10"...');
    const editAdminBtn = page.locator('[data-testid="btn-edit-admin-icd10"]').first();
    await editAdminBtn.waitFor({ state: 'visible', timeout: 5000 });
    const btnText = await editAdminBtn.textContent();
    console.log(`  ✓ Found renamed button: "${btnText.trim()}"`);

    // 3. Mở modal sửa hành chính và thiết lập chẩn đoán M47 (Thoái hóa cột sống)
    console.log('3. Setting initial diagnosis to M47 (Thoái hóa cột sống)...');
    await editAdminBtn.click();
    await page.waitForTimeout(500);

    // Điền chẩn đoán chính M47 qua data-testid
    await page.fill('[data-testid="input-admin-primary-icd"]', 'M47.8');
    await page.fill('[data-testid="input-admin-primary-diag"]', 'Thoái hóa cột sống thắt lưng');
    await page.fill('[data-testid="input-admin-patient-name"]', 'Nguyễn Thị Hoa');

    const saveBtn = page.locator('[data-testid="btn-admin-save"]');
    await saveBtn.click();
    await page.waitForTimeout(1000);
    console.log('  ✓ Administrative details saved with Primary ICD: M47.8');

    // 4. Bấm "+ Thêm thuốc" và nhập Glucosamin
    console.log('4. Adding medicine: Glucosamin 500mg...');
    const addMedBtn = page.locator('button:has-text("+ Thêm thuốc"):visible').first();
    await addMedBtn.click();
    await page.waitForTimeout(500);

    // Điền tên thuốc Glucosamin vào dòng đầu tiên
    const drugNameInput = page.locator('input[placeholder="Tên biệt dược"]').first();
    await drugNameInput.fill('Viartril-S 500mg (Glucosamin)');
    const activeInput = page.locator('input[placeholder="Hoạt chất INN"]').first();
    await activeInput.fill('Glucosamin');

    // Điền số ngày 30, số lượng 60, đơn giá 8500
    // Cột: [0] Ngày (daysSupply), [1] SL (quantity), [2] Đơn giá (unitPrice)
    const numInputs = page.locator('table tbody tr input[type="number"]');
    await numInputs.nth(0).fill('30'); // 30 ngày (nằm trong giới hạn ngoại trú)
    await numInputs.nth(1).fill('60'); // 60 viên
    await numInputs.nth(2).fill('8500'); // 8.500 đ/viên

    await page.waitForTimeout(1000);

    // 5. Chuyển sang Tab 3 để kiểm tra câu cảnh báo Cột 8 TT 20
    console.log('5. Navigating to Tab 3 (Violations) to verify Column 8 TT 20 Adjudication...');
    const tab3Btn = page.locator('[data-testid="tab-violations"]').first();
    await tab3Btn.click();
    await page.waitForTimeout(1500);

    // Xác nhận lỗi xuất toán với câu cảnh báo chuẩn xác
    const violationDetail = page.locator('text=không khớp với điều kiện thanh toán BHYT của Glucosamin');
    await violationDetail.waitFor({ state: 'visible', timeout: 5000 });
    const detailText = await violationDetail.textContent();
    console.log(`  ✓ Confirmed Column 8 TT 20 Violation Message:\n    "${detailText.trim()}"`);

    // Chụp ảnh trạng thái bị từ chối do sai mã M47
    const ssM47 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_4d_glucosamin_rejected_m47.png';
    await page.screenshot({ path: ssM47, fullPage: false });
    console.log('  ✓ Saved screenshot (M47 rejected):', ssM47);

    // 6. Quay lại Tab 1, bấm "✏️ Sửa hành chính & ICD-10" và bổ sung mã M17
    console.log('6. Adding secondary ICD-10: M17 via Edit Admin Modal...');
    const tab1Btn = page.locator('[data-testid="tab-pure-breakdown"]').first();
    await tab1Btn.click();
    await page.waitForTimeout(1000);

    await editAdminBtn.click();
    await page.waitForTimeout(500);

    // Điền mã ICD phụ M17 qua data-testid
    const secIcdInput = page.locator('[data-testid="input-admin-secondary-icd"]');
    await secIcdInput.fill('M17.0');

    await saveBtn.click();
    await page.waitForTimeout(1500);
    console.log('  ✓ Secondary ICD M17.0 (Thoái hóa khớp gối) added successfully!');

    // 7. Chuyển lại sang Tab 3 và xác nhận ĐÃ ĐƯỢC CỨU XUẤT TOÁN 100%
    console.log('7. Verifying instant re-audit & resolution...');
    await tab3Btn.click();
    await page.waitForTimeout(1500);

    // Kiểm tra thông báo hợp lệ 100%
    const validMessage = page.locator('text=Đơn thuốc hợp lệ 100%!');
    await validMessage.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ SUCCESS: Glucosamin violation DISAPPEARED! Status is now "Đơn thuốc hợp lệ 100%!"');

    // Chụp ảnh trạng thái sau khi đã cứu xuất toán thành công
    const ssM17 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_4d_glucosamin_resolved_m17.png';
    await page.screenshot({ path: ssM17, fullPage: false });
    console.log('  ✓ Saved screenshot (M17 resolved):', ssM17);

    console.log('\n🎉 TOÀN BỘ KIỂM THỬ MA TRẬN 4 CHIỀU & GLUCOSAMIN ĐÃ ĐẠT 100% GREEN!');
  } catch (err) {
    console.error('Playwright Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
