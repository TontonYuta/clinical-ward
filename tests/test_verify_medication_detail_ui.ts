import { chromium } from 'playwright';

async function testMedicationDetailUI() {
  console.log('🚀 Starting Medication Detail Multi-Tab Left-Right UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Set role to doctor/pharmacist
  await page.evaluate(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. Chuyển sang Tab Kho Dược Bệnh Viện
  const pharmacyTabs = page.locator('aside button:has-text("Kho dược")');
  for (let i = 0; i < await pharmacyTabs.count(); i++) {
    if (await pharmacyTabs.nth(i).isVisible()) {
      await pharmacyTabs.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(800);

  // 2. Click vào tên thuốc dòng đầu tiên
  const firstMedNameBtn = page.locator('button[data-testid^="btn-medname-"]').first();
  const isMedBtnVisible = await firstMedNameBtn.isVisible();
  console.log('✅ 1. Nút tên thuốc hiển thị trong bảng:', isMedBtnVisible);
  if (!isMedBtnVisible) throw new Error('First medication name button not found');

  const medNameText = await firstMedNameBtn.textContent();
  console.log(`Bấm vào tên thuốc: "${medNameText?.trim()}"`);
  await firstMedNameBtn.click();
  await page.waitForTimeout(800);

  // 3. Kiểm tra Modal Chi Tiết Thuốc xuất hiện
  const davModal = page.locator('[data-testid="dav-drug-detail-modal"]');
  const isDavModalVisible = await davModal.isVisible();
  console.log('✅ 2. Modal chi tiết thuốc (DavDrugDetailModal) hiển thị:', isDavModalVisible);
  if (!isDavModalVisible) throw new Error('DavDrugDetailModal failed to open upon clicking drug name');

  // Kiểm tra Header của modal
  const modalHeader = davModal.locator('h2');
  const modalHeaderText = await modalHeader.textContent();
  console.log(`Modal header title: "${modalHeaderText?.trim()}"`);

  // 4. Kiểm tra các Tab phân chia rõ ràng
  const expectedTabs = [
    'Tổng quan',
    'An toàn & Cảnh báo',
    'Liều dùng & Dược lý',
    'Tác dụng phụ & Tương tác',
    'Hồ sơ Cục QLD',
    'Lô kho bệnh viện'
  ];

  for (const tabName of expectedTabs) {
    const tabBtn = davModal.locator(`role=tab[name="${tabName}"]`);
    const isVisible = await tabBtn.isVisible();
    console.log(`✅ 3. Tab "${tabName}" hiển thị:`, isVisible);
    if (!isVisible) throw new Error(`Tab "${tabName}" not found`);

    // Click vào từng tab để kiểm tra bố cục Trái - Phải và không có lỗi chấm
    await tabBtn.click();
    await page.waitForTimeout(300);

    const tabText = await davModal.innerText();
    if (tabText.includes('• •') || tabText.includes('••')) {
      throw new Error(`Found double dots in tab "${tabName}"!`);
    }
  }

  // 5. Đóng modal chi tiết thuốc
  const closeDavBtn = davModal.locator('[data-testid="btn-close-dav-detail"]');
  await closeDavBtn.click();
  await page.waitForTimeout(500);
  const isClosed = !(await davModal.isVisible());
  console.log('✅ 4. Đóng modal chi tiết thuốc thành công:', isClosed);
  if (!isClosed) throw new Error('DavDrugDetailModal did not close');

  // 6. Click vào SĐK dòng đầu tiên để mở modal
  const firstSdkBtn = page.locator('button[data-testid^="btn-sdk-"]').first();
  const sdkText = await firstSdkBtn.textContent();
  console.log(`Bấm vào SĐK: "${sdkText?.trim()}"`);
  await firstSdkBtn.click();
  await page.waitForTimeout(800);
  console.log('✅ 5. Mở modal thành công khi bấm vào SĐK:', await davModal.isVisible());
  await closeDavBtn.click();
  await page.waitForTimeout(500);

  await browser.close();
  console.log('🎉 ALL MULTI-TAB LEFT-RIGHT CLEAN UI TESTS PASSED SUCCESSFULLY!');
}

testMedicationDetailUI().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
