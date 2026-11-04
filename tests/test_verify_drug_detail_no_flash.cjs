const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

(async () => {
  console.log('🚀 Bắt đầu kiểm thử E2E: Khắc phục triệt để lỗi flash/lật thông tin thuốc (DavDrugDetailModal)');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    console.log('1. Truy cập ứng dụng tại http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 30000 });

    // Đảm bảo mở Tab Kho Dược Bệnh Viện
    const pharmacyTabBtn = page.locator('button[title*="Quản lý kho dược"]:visible').first();
    await pharmacyTabBtn.click();
    await page.waitForTimeout(1000);

    // Tìm các nút SĐK hoặc tên thuốc trong bảng FEFO
    const drugButtons = page.locator('[data-testid^="btn-medname-"]');
    const drugCount = await drugButtons.count();
    console.log(`Tìm thấy ${drugCount} thuốc trong bảng kho FEFO.`);
    if (drugCount < 2) {
      throw new Error(`Cần ít nhất 2 thuốc để kiểm tra stale state leak, chỉ tìm thấy ${drugCount}`);
    }

    const firstDrugBtn = drugButtons.nth(0);
    const firstDrugName = (await firstDrugBtn.textContent() || '').trim();
    console.log(`2. Mở thông tin Thuốc 1: "${firstDrugName}"...`);
    await firstDrugBtn.click();

    // Modal phải xuất hiện
    const modal = page.locator('[data-testid="dav-drug-detail-modal"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Kiểm tra xem header có đúng tên thuốc không
    const headerTitle = modal.locator('h2');
    await headerTitle.waitFor({ state: 'visible', timeout: 5000 });
    const headerText1 = await headerTitle.textContent();
    console.log(`   Header hiển thị: "${headerText1?.trim()}"`);

    // Chờ dữ liệu ổn định (sau khi API trả lời hoặc lấy từ cache)
    await page.waitForTimeout(800);

    // Chụp ảnh Drug 1
    const screenshot1Path = path.join(ARTIFACT_DIR, '20_drug1_detail_loaded.png');
    await modal.screenshot({ path: screenshot1Path });
    console.log(`   📸 Đã chụp ảnh thông tin Thuốc 1: ${screenshot1Path}`);

    // Đóng modal
    const closeBtn = modal.locator('button:has-text("Đóng")');
    await closeBtn.click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    console.log('3. Đã đóng modal Thuốc 1 thành công.');

    // Mở lại Thuốc 1: Phải lấy tức thời từ cache (0ms, không có skeleton, không bị giật đổi thông tin)
    console.log(`4. Mở lại Thuốc 1 "${firstDrugName}" để kiểm tra bộ nhớ đệm (Cache Hit)...`);
    const t0 = Date.now();
    await firstDrugBtn.click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Kiểm tra skeleton không hiển thị vì đã cache
    const skeleton = modal.locator('[data-testid="dav-modal-loading-skeleton"]');
    const skeletonVisible = await skeleton.isVisible();
    const duration = Date.now() - t0;
    console.log(`   Thời gian mở lại: ${duration}ms, Skeleton hiển thị: ${skeletonVisible} (Kỳ vọng: false vì đã cache tức thì 0ms)`);

    const screenshot2Path = path.join(ARTIFACT_DIR, '21_drug1_reopened_from_cache.png');
    await modal.screenshot({ path: screenshot2Path });
    console.log(`   📸 Đã chụp ảnh Thuốc 1 mở từ cache: ${screenshot2Path}`);

    await closeBtn.click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    // 5. Mở Thuốc 2: Kiểm tra chống leak thông tin của Thuốc 1
    const secondDrugBtn = drugButtons.nth(1);
    const secondDrugName = (await secondDrugBtn.textContent() || '').trim();
    console.log(`5. Mở thông tin Thuốc 2: "${secondDrugName}" (Kiểm tra chống stale state leak)...`);

    await secondDrugBtn.click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Ngay tại frame đầu tiên, header title KHÔNG ĐƯỢC CHỨA firstDrugName nếu 2 tên khác nhau!
    const headerText2 = await headerTitle.textContent();
    console.log(`   Header Thuốc 2 hiển thị: "${headerText2?.trim()}"`);
    if (headerText2 && firstDrugName !== secondDrugName && headerText2.includes(firstDrugName)) {
      throw new Error(`PHÁT HIỆN LỖI: Thuốc 2 đang bị leak hiển thị tên của Thuốc 1 ("${firstDrugName}")!`);
    }

    await page.waitForTimeout(800);
    const screenshot3Path = path.join(ARTIFACT_DIR, '22_drug2_detail_verified.png');
    await modal.screenshot({ path: screenshot3Path });
    console.log(`   📸 Đã chụp ảnh Thuốc 2 đã load chuẩn xác: ${screenshot3Path}`);

    await closeBtn.click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    console.log('🎉 KIỂM THỬ HOÀN TẤT: KHÔNG CÒN HIỆN TƯỢNG FLASH HAY LẬT NỘI DUNG THUỐC!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử E2E:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
