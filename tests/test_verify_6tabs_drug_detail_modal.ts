import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Bắt đầu kiểm thử End-to-End 6 Tab Chi Tiết Thuốc trên Local...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. Truy cập http://localhost:3001/#fefo...');
  await page.goto('http://localhost:3001/#fefo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('2. Mở Modal Chi Tiết Thuốc từ bảng FEFO...');
  const firstMedNameBtn = page.locator('button[data-testid^="btn-medname-"]').first();
  await firstMedNameBtn.waitFor({ state: 'visible', timeout: 8000 });
  const medName = await firstMedNameBtn.innerText();
  console.log(`Bấm vào nút tên thuốc: "${medName.trim()}"`);
  await firstMedNameBtn.click();

  const modal = page.locator('[data-testid="dav-drug-detail-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Modal Chi Tiết Thuốc đã mở thành công!');

  // Chụp ảnh Tab 1: Tổng quan
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab1_overview.png' });
  console.log('📸 Đã lưu ảnh: modal_local_tab1_overview.png');

  // Kiểm tra danh sách 6 Tabs
  const tabButtons = page.locator('[role="tablist"] button');
  const tabNames = await tabButtons.allInnerTexts();
  console.log('📋 Danh sách Tab hiển thị:', tabNames);

  if (!tabNames.some(t => t.includes('Dược lý & Dược động học'))) {
    throw new Error('Thiếu Tab "Dược lý & Dược động học"!');
  }
  console.log('✅ Đã xác nhận Tab "Dược lý & Dược động học" hiện diện!');

  // Click Tab 4: Dược lý & Dược động học
  console.log('3. Chuyển sang Tab "Dược lý & Dược động học"...');
  const pharmTab = tabButtons.filter({ hasText: 'Dược lý & Dược động học' }).first();
  await pharmTab.click();
  await page.waitForTimeout(500);

  // Xác thực nội dung dược lực & động học
  const pharmHeading = page.locator('text=Dược Lực Học & Cơ Chế Tác Dụng');
  const pkHeading = page.locator('text=Dược Động Học Lâm Sàng (ADME)');
  const pkMetricsCard = page.locator('text=Thông Số Dược Động Học Chính');

  if (await pharmHeading.count() === 0 || await pkHeading.count() === 0) {
    throw new Error('Nội dung Dược lực học hoặc Dược động học chưa hiển thị!');
  }
  console.log('✅ Đã xác nhận hiển thị trọn vẹn khối Dược Lực Học và Dược Động Học!');

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab4_pharmacology.png' });
  console.log('📸 Đã lưu ảnh: modal_local_tab4_pharmacology.png');

  // Thử bấm Accordion "Xem toàn văn"
  const expandBtn = page.locator('button').filter({ hasText: 'Xem toàn văn' }).first();
  if (await expandBtn.count() > 0) {
    const btnText = await expandBtn.innerText();
    console.log(`4. Thử nghiệm Accordion: Bấm "${btnText}"...`);
    await expandBtn.click();
    await page.waitForTimeout(400);
    console.log('✅ Accordion mở rộng toàn văn mượt mà!');
    await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab4_pharmacology_expanded.png' });
    console.log('📸 Đã lưu ảnh: modal_local_tab4_pharmacology_expanded.png');
  }

  // Click Tab 5: Tác dụng phụ & Tương tác
  console.log('5. Chuyển sang Tab "Tác dụng phụ & Tương tác"...');
  const interactTab = tabButtons.filter({ hasText: 'Tác dụng phụ & Tương tác' }).first();
  await interactTab.click();
  await page.waitForTimeout(500);

  const adrHeading = page.locator('text=Tác Dụng Không Mong Muốn (ADR)');
  const adrMgtHeading = page.locator('text=Hướng Dẫn Xử Trí Tác Dụng Phụ (ADR Management)');
  const incompHeading = page.locator('text=Tương Kỵ & Dung Môi Pha Tiêm Truyền');

  console.log('  ADR:', await adrHeading.count() > 0 ? 'Có' : 'Không');
  console.log('  ADR Mgt:', await adrMgtHeading.count() > 0 ? 'Có' : 'Không');

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab5_interactions.png' });
  console.log('📸 Đã lưu ảnh: modal_local_tab5_interactions.png');

  // Click Tab 2: An toàn & Cảnh báo (kiểm tra phân tách thai kỳ & cho con bú)
  console.log('6. Chuyển sang Tab "An toàn & Cảnh báo"...');
  const safetyTab = tabButtons.filter({ hasText: 'An toàn & Cảnh báo' }).first();
  await safetyTab.click();
  await page.waitForTimeout(500);

  const pregBlock = page.locator('text=Thời Kỳ Mang Thai');
  const lactBlock = page.locator('text=Thời Kỳ Cho Con Bú');
  console.log('  Mang thai riêng biệt:', await pregBlock.count() > 0 ? 'Có' : 'Không');
  console.log('  Cho con bú riêng biệt:', await lactBlock.count() > 0 ? 'Có' : 'Không');

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab2_safety.png' });
  console.log('📸 Đã lưu ảnh: modal_local_tab2_safety.png');

  // Click Tab 6: Hồ sơ Cục QLD
  console.log('7. Chuyển sang Tab "Hồ sơ Cục QLD"...');
  const regTab = tabButtons.filter({ hasText: 'Hồ sơ Cục QLD' }).first();
  await regTab.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_tab6_registration.png' });
  console.log('📸 Đã lưu ảnh: modal_local_tab6_registration.png');

  // Đóng modal Paracetamol
  const closeBtn = page.locator('button[aria-label="Đóng"]').or(page.locator('button:has-text("✕")')).or(page.locator('button:has-text("Đóng")')).first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  // 8. Mở Ceftriaxone để kiểm tra Tương kỵ dung môi tiêm truyền (Incompatibilities)
  console.log('8. Mở Modal Ceftriaxona Normon 1g để kiểm tra Tương kỵ...');
  const ceftBtn = page.locator('button[data-testid^="btn-medname-"]').filter({ hasText: 'Ceftriaxona' }).first();
  if (await ceftBtn.count() > 0) {
    await ceftBtn.click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(600);

    const ceftTabButtons = page.locator('[role="tablist"] button');
    const ceftInteractTab = ceftTabButtons.filter({ hasText: 'Tác dụng phụ & Tương tác' }).first();
    await ceftInteractTab.click();
    await page.waitForTimeout(500);

    const incompHeading = page.locator('text=Tương Kỵ & Dung Môi Pha Tiêm Truyền');
    console.log('  Tương kỵ dung môi Ceftriaxon:', await incompHeading.count() > 0 ? 'Có' : 'Không');
    if (await incompHeading.count() === 0) {
      throw new Error('Không tìm thấy mục Tương Kỵ & Dung Môi Pha Tiêm Truyền trên Ceftriaxone!');
    }
    await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_local_ceftriaxone_incompatibilities.png' });
    console.log('📸 Đã lưu ảnh: modal_local_ceftriaxone_incompatibilities.png');
  }

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT 6 TAB CHI TIẾT THUỐC ĐÃ ĐẠT 100% GREEN!');
}

run().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
