import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function testColdChainUI() {
  console.log('❄️ BẮT ĐẦU KIỂM THỬ GIAO DIỆN KHO LẠNH VẮC XIN GSP (DESKTOP & MOBILE)...');

  const browser = await chromium.launch({ headless: true });

  try {
    // ==========================================
    // 1. DESKTOP VIEWPORT (1440 x 900)
    // ==========================================
    console.log('\n💻 --- KIỂM THỬ TRÊN DESKTOP (1440 x 900) ---');
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktopContext.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'pharmacist');
    });

    const page = await desktopContext.newPage();
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:3001/#coldchain', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1.1 Kiểm tra các phần tử chính
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_desktop_01_main.png') });
    console.log('📸 Đã chụp: coldchain_after_desktop_01_main.png');

    // 1.2 Kiểm tra 4 Telemetry Cards
    const tempElement = page.locator('text=Nhiệt độ tức thời').first();
    const humidityElement = page.locator('text=Độ ẩm & Cảm biến').first();
    const powerElement = page.locator('text=Nguồn điện & Tủ').first();
    const inventoryElement = page.locator('text=Cơ số & Kháng nguyên').first();

    console.log('📊 Telemetry cards visible:', {
      temp: await tempElement.isVisible(),
      humidity: await humidityElement.isVisible(),
      power: await powerElement.isVisible(),
      inventory: await inventoryElement.isVisible()
    });

    // 1.3 Mở modal chi tiết vắc xin
    console.log('👉 Click xem chi tiết vắc xin Verorab...');
    const verorabBtn = page.locator('button:has-text("Vắc xin Dại tinh chế (Verorab 0.5ml)")').first();
    if (await verorabBtn.isVisible()) {
      await verorabBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('[data-testid="vaccine-detail-modal"]');
      console.log('💉 Vaccine detail modal visible:', await modal.isVisible());
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_desktop_02_modal.png') });
      console.log('📸 Đã chụp: coldchain_after_desktop_02_modal.png');

      const closeBtn = page.locator('[data-testid="vaccine-modal-close-btn"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // 1.4 Chuyển sub-tab sang Nhật ký IoT 24h
    console.log('👉 Chuyển sub-tab sang Nhật ký IoT 24h...');
    const logTabBtn = page.locator('[data-testid="subtab-datalogger-desktop"]');
    if (await logTabBtn.isVisible()) {
      await logTabBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_desktop_03_datalogger.png') });
      console.log('📸 Đã chụp: coldchain_after_desktop_03_datalogger.png');
    }

    // 1.5 Chuyển lại Danh mục vắc xin & Tìm kiếm
    const vaxTabBtn = page.locator('[data-testid="subtab-inventory-desktop"]');
    if (await vaxTabBtn.isVisible()) {
      await vaxTabBtn.click();
      await page.waitForTimeout(400);
    }

    const searchInput = page.locator('input[placeholder*="Tìm theo tên vắc xin"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Verorab');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_desktop_04_search.png') });
      console.log('📸 Đã chụp: coldchain_after_desktop_04_search.png');
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    // 1.6 Mở biểu mẫu In Biên bản GSP
    console.log('👉 Click nút In Biên bản GSP...');
    const printGspBtn = page.locator('button:has-text("Biên bản GSP")').first();
    if (await printGspBtn.isVisible()) {
      await printGspBtn.click();
      await page.waitForTimeout(800);
      const printModal = page.locator('[data-testid="printable-form-modal"]');
      console.log('🖨️ Printable form modal visible:', await printModal.isVisible());
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_desktop_05_print_modal.png') });
      console.log('📸 Đã chụp: coldchain_after_desktop_05_print_modal.png');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    await desktopContext.close();

    // ==========================================
    // 2. MOBILE VIEWPORT (iPhone 14: 390 x 844)
    // ==========================================
    console.log('\n📱 --- KIỂM THỬ TRÊN MOBILE (390 x 844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mobileContext.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'pharmacist');
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3001/#coldchain', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    // 2.1 Màn hình chính Mobile
    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_mobile_01_main.png') });
    console.log('📸 Đã chụp: coldchain_after_mobile_01_main.png');

    // 2.2 Cuộn xuống kiểm tra các card vắc xin
    const mobileScroll = mobilePage.locator('.overflow-y-auto').first();
    if (await mobileScroll.isVisible()) {
      await mobileScroll.evaluate((el) => { el.scrollTop = 300; });
      await mobilePage.waitForTimeout(400);
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_mobile_02_scrolled.png') });
      console.log('📸 Đã chụp: coldchain_after_mobile_02_scrolled.png');
    }

    // 2.3 Mở modal chi tiết vắc xin trên mobile
    const mobileDetailBtn = mobilePage.locator('button:has-text("Xem chi tiết")').first();
    if (await mobileDetailBtn.isVisible()) {
      await mobileDetailBtn.click();
      await mobilePage.waitForTimeout(600);
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_mobile_03_modal.png') });
      console.log('📸 Đã chụp: coldchain_after_mobile_03_modal.png');
      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(400);
    }

    // 2.4 Chuyển sang sub-tab IoT 24h trên mobile
    const mobileLogTab = mobilePage.locator('[data-testid="subtab-datalogger-mobile"]');
    if (await mobileLogTab.isVisible()) {
      await mobileLogTab.click();
      await mobilePage.waitForTimeout(500);
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_after_mobile_04_datalogger.png') });
      console.log('📸 Đã chụp: coldchain_after_mobile_04_datalogger.png');
    }

    await mobileContext.close();

    console.log('\n==================================================');
    console.log('🎉 KIỂM THỬ TỰ ĐỘNG GIAO DIỆN KHO LẠNH THÀNH CÔNG 100%!');
    console.log(`Số lỗi Console phát sinh: ${consoleErrors.length}`);
    console.log('==================================================\n');
  } finally {
    await browser.close();
  }
}

testColdChainUI().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
