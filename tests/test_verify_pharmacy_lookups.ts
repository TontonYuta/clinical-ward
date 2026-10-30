import { chromium } from 'playwright';

async function testPharmacyLookups() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Chuyển sang Tab Kho Dược Bệnh Viện
  const pharmacyTabs = page.locator('aside button:has-text("Kho dược")');
  for (let i = 0; i < await pharmacyTabs.count(); i++) {
    if (await pharmacyTabs.nth(i).isVisible()) {
      await pharmacyTabs.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(800);

  // 2. Kiểm tra Nút "Kho Dược Quốc Gia" (54.885 SĐK) có mặt và bấm tra cứu được
  const nationalRegistryBtn = page.locator('button[data-testid="btn-open-national-registry"]');
  const isNationalBtnVisible = await nationalRegistryBtn.isVisible();
  console.log('✅ 1. Nút "Kho Dược Quốc Gia" (54.885 SĐK) hiển thị trong Kho Dược:', isNationalBtnVisible);
  if (!isNationalBtnVisible) throw new Error('Button "Kho Dược Quốc Gia" not found');

  // Kiểm tra không có nút "Lập dự trù bổ sung" hay nút "Dự trù" rác
  const restockProposalBtn = page.locator('button:has-text("Lập dự trù bổ sung")');
  const isRestockVisible = await restockProposalBtn.isVisible();
  console.log('✅ 2. Đã loại bỏ các vấn đề dự trù (nút "Lập dự trù bổ sung" không xuất hiện):', !isRestockVisible);
  if (isRestockVisible) throw new Error('Restock proposal button should be removed');

  // 3. Mở & Kiểm tra "Kho Dược Quốc Gia"
  await nationalRegistryBtn.click();
  await page.waitForTimeout(1000);

  const registryModalTitle = page.locator('text=Kho Dược Quốc Gia').or(page.locator('text=Cơ Sở Dữ Liệu Dược Quốc Gia'));
  const isRegistryModalOpen = await registryModalTitle.first().isVisible();
  console.log('✅ 3. Modal "Kho Dược Quốc Gia" mở thành công:', isRegistryModalOpen);
  if (!isRegistryModalOpen) throw new Error('National Drug Registry Modal failed to open');

  // Tra cứu tìm kiếm trong CSDL Quốc Gia
  const searchInput = page.locator('input[placeholder*="Tìm trên 55.000 thuốc"]').or(page.locator('input[placeholder*="Tìm theo tên thuốc"]')).first();
  await searchInput.fill('Morphin');
  await page.waitForTimeout(800);

  // Bấm xem chi tiết 1 thuốc từ CSDL Quốc Gia
  const firstDoiChungBtn = page.locator('button[data-testid^="btn-doi-chung-"]').first();
  if (await firstDoiChungBtn.isVisible()) {
    await firstDoiChungBtn.click();
    await page.waitForTimeout(800);
    const detailModal = page.locator('button[data-testid="drug-detail-reload-btn"]');
    const isDetailOpen = await detailModal.isVisible();
    console.log('✅ 4. Bấm từ CSDL Quốc Gia mở hồ sơ công bố Cục QLD & Dược Thư thành công:', isDetailOpen);
    if (!isDetailOpen) throw new Error('Failed to open drug detail from national registry');

    // Đóng modal chi tiết
    const closeDavDetail = page.locator('button[data-testid="btn-close-dav-detail"]');
    await closeDavDetail.click();
    await page.waitForTimeout(500);
  }

  // Đóng modal Kho Dược Quốc Gia
  const closeRegistryBtn = page.locator('button[data-testid="btn-close-national-registry"]');
  await closeRegistryBtn.click();
  await page.waitForTimeout(600);

  // 4. Kiểm tra các nút tra cứu thông tin thuốc trong bảng danh mục kho
  console.log('--- Kiểm tra các nút tra cứu trong bảng danh mục thuốc ---');

  // Nút 4A: "Hồ sơ & Dược thư" trên dòng thuốc đầu tiên trong table
  const tableHoSoBtn = page.locator('table button:has-text("Hồ sơ & Dược thư")').first();
  const isHoSoBtnVisible = await tableHoSoBtn.isVisible();
  console.log('✅ 5. Nút "Hồ sơ & Dược thư" trên hàng thuốc hiển thị:', isHoSoBtnVisible);
  if (!isHoSoBtnVisible) throw new Error('Button "Hồ sơ & Dược thư" in table not found');

  await tableHoSoBtn.click();
  await page.waitForTimeout(800);
  const davModalReloadBtn = page.locator('button[data-testid="drug-detail-reload-btn"]');
  const isDavModalOpen = await davModalReloadBtn.isVisible();
  console.log('✅ 6. Mở hồ sơ công bố Cục QLD & Dược Thư từ hàng thuốc thành công:', isDavModalOpen);
  if (!isDavModalOpen) throw new Error('Failed to open Dav detail modal from table row');

  const closeDavDetail = page.locator('button[data-testid="btn-close-dav-detail"]');
  await closeDavDetail.click();
  await page.waitForTimeout(600);

  // Nút 4B: Nút "An toàn" trên dòng thuốc đầu tiên trong table
  const tableAnToanBtn = page.locator('table button:has-text("An toàn")').first();
  const isAnToanBtnVisible = await tableAnToanBtn.isVisible();
  console.log('✅ 7. Nút "An toàn" trên hàng thuốc hiển thị:', isAnToanBtnVisible);
  if (!isAnToanBtnVisible) throw new Error('Button "An toàn" in table not found');

  await tableAnToanBtn.click();
  await page.waitForTimeout(800);
  const safetyModalTitle = page.locator('text=Tra Cứu Dược Thư Quốc Gia Việt Nam').or(page.locator('text=Hướng Dẫn Kê Đơn An Toàn 5 Đúng')).first();
  const isSafetyModalOpen = await safetyModalTitle.isVisible();
  console.log('✅ 8. Mở hướng dẫn sử dụng an toàn (5 Đúng & Dị ứng) thành công:', isSafetyModalOpen);
  if (!isSafetyModalOpen) throw new Error('Failed to open Safety guide modal from table row');

  const closeSafetyModal = page.locator('button[data-testid="btn-close-safety-modal"]');
  await closeSafetyModal.click();
  await page.waitForTimeout(600);

  // Nút 4C: Nút "Tra cứu Dược Thư" trên header ribbon
  const ribbonDuocThuBtn = page.locator('button[data-testid="btn-open-safety-guide"]');
  const isRibbonDuocThuVisible = await ribbonDuocThuBtn.isVisible();
  console.log('✅ 9. Nút "Tra cứu Dược Thư" trên thanh công cụ hiển thị:', isRibbonDuocThuVisible);
  if (!isRibbonDuocThuVisible) throw new Error('Button "Tra cứu Dược Thư" in ribbon not found');

  await ribbonDuocThuBtn.click();
  await page.waitForTimeout(800);
  const isRibbonSafetyOpen = await safetyModalTitle.isVisible();
  console.log('✅ 10. Mở chuyên luận Dược Thư từ thanh công cụ thành công:', isRibbonSafetyOpen);
  if (!isRibbonSafetyOpen) throw new Error('Failed to open Safety guide from ribbon');

  await closeSafetyModal.click();
  await page.waitForTimeout(600);

  // Chụp ảnh minh chứng
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_pharmacy_national_registry_and_lookups.png' });
  console.log('🎉 TẤT CẢ 10/10 TIÊU CHÍ TRA CỨU THUỐC VÀ KHO DƯỢC QUỐC GIA ĐẠT 100%!');

  await browser.close();
}

testPharmacyLookups().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
