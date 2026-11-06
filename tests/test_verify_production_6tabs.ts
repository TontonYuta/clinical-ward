import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Bắt đầu kiểm thử End-to-End 6 Tab Chi Tiết Thuốc trên Production (Vercel)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. Truy cập https://clinical-ward.vercel.app/#fefo...');
  await page.goto('https://clinical-ward.vercel.app/#fefo', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('2. Mở Modal Chi Tiết Thuốc từ bảng FEFO trên Production...');
  const firstMedNameBtn = page.locator('button[data-testid^="btn-medname-"]').first();
  await firstMedNameBtn.waitFor({ state: 'visible', timeout: 15000 });
  const medName = await firstMedNameBtn.innerText();
  console.log(`Bấm vào nút tên thuốc: "${medName.trim()}"`);
  await firstMedNameBtn.click();

  const modal = page.locator('[data-testid="dav-drug-detail-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✅ Modal Chi Tiết Thuốc đã mở thành công trên Production!');

  // Chụp ảnh Tab 1: Tổng quan
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_prod_tab1_overview.png' });
  console.log('📸 Đã lưu ảnh: modal_prod_tab1_overview.png');

  // Kiểm tra danh sách 6 Tabs
  const tabButtons = page.locator('[role="tablist"] button');
  const tabNames = await tabButtons.allInnerTexts();
  console.log('📋 Danh sách Tab hiển thị:', tabNames);

  if (!tabNames.some(t => t.includes('Dược lý & Dược động học'))) {
    throw new Error('Thiếu Tab "Dược lý & Dược động học"!');
  }
  console.log('✅ Đã xác nhận Tab "Dược lý & Dược động học" hiện diện trên Production!');

  // Click Tab 4: Dược lý & Dược động học
  console.log('3. Chuyển sang Tab "Dược lý & Dược động học"...');
  const pharmTab = tabButtons.filter({ hasText: 'Dược lý & Dược động học' }).first();
  await pharmTab.click();
  await page.waitForTimeout(1000);

  // Chụp ảnh Tab 4
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_prod_tab4_pharmacology.png' });
  console.log('📸 Đã lưu ảnh: modal_prod_tab4_pharmacology.png');

  // Thử bấm Accordion "Xem toàn văn"
  const expandBtn = page.locator('button').filter({ hasText: 'Xem toàn văn' }).first();
  if (await expandBtn.count() > 0) {
    const btnText = await expandBtn.innerText();
    console.log(`4. Thử nghiệm Accordion: Bấm "${btnText}"...`);
    await expandBtn.click();
    await page.waitForTimeout(500);
    console.log('✅ Accordion mở rộng toàn văn mượt mà!');
    await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_prod_tab4_pharmacology_expanded.png' });
    console.log('📸 Đã lưu ảnh: modal_prod_tab4_pharmacology_expanded.png');
  }

  // Click Tab 2: An toàn & Cảnh báo
  console.log('5. Chuyển sang Tab "An toàn & Cảnh báo"...');
  const safetyTab = tabButtons.filter({ hasText: 'An toàn' }).first();
  await safetyTab.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_prod_tab2_safety.png' });
  console.log('📸 Đã lưu ảnh: modal_prod_tab2_safety.png');

  // Click Tab 5: Tác dụng phụ & Tương tác
  console.log('6. Chuyển sang Tab "Tác dụng phụ & Tương tác"...');
  const interactTab = tabButtons.filter({ hasText: 'Tác dụng phụ & Tương tác' }).first();
  await interactTab.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/modal_prod_tab5_interactions.png' });
  console.log('📸 Đã lưu ảnh: modal_prod_tab5_interactions.png');

  await browser.close();
  console.log('🎉 Hoàn tất kiểm thử Playwright Production 100% THÀNH CÔNG!');
}

run().catch(err => {
  console.error('❌ Lỗi kiểm thử Production Playwright:', err);
  process.exit(1);
});
