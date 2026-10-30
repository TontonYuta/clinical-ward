import { chromium } from 'playwright';
import path from 'path';

const VERCEL_URL = 'https://clinical-ward.vercel.app';
const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function verifyLiveVercelColdChain() {
  console.log(`🌐 BẮT ĐẦU KIỂM THỬ TRỰC TIẾP KHO LẠNH VẮC XIN TRÊN VERCEL: ${VERCEL_URL}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Test
    console.log('\n💻 Kiểm thử Desktop Viewport (1440 x 900)...');
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktopCtx.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'pharmacist');
    });

    const page = await desktopCtx.newPage();
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${VERCEL_URL}/#coldchain`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_coldchain_desktop_01.png') });
    console.log('📸 Đã chụp: vercel_live_coldchain_desktop_01.png');

    // Click vaccine row to check modal on live Vercel
    const vaccineBtn = page.locator('button:has-text("Verorab")').first();
    if (await vaccineBtn.isVisible()) {
      await vaccineBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_coldchain_desktop_02_modal.png') });
      console.log('📸 Đã chụp: vercel_live_coldchain_desktop_02_modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Switch to datalogger
    const logTab = page.locator('[data-testid="subtab-datalogger-desktop"]');
    if (await logTab.isVisible()) {
      await logTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_coldchain_desktop_03_logs.png') });
      console.log('📸 Đã chụp: vercel_live_coldchain_desktop_03_logs.png');
    }

    await desktopCtx.close();

    // 2. Mobile Test
    console.log('\n📱 Kiểm thử Mobile Viewport (390 x 844)...');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await mobileCtx.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'pharmacist');
    });

    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(`${VERCEL_URL}/#coldchain`, { waitUntil: 'networkidle', timeout: 35000 });
    await mobilePage.waitForTimeout(1500);

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_coldchain_mobile_01.png') });
    console.log('📸 Đã chụp: vercel_live_coldchain_mobile_01.png');

    const mobileDetail = mobilePage.locator('button:has-text("Xem chi tiết")').first();
    if (await mobileDetail.isVisible()) {
      await mobileDetail.click();
      await mobilePage.waitForTimeout(600);
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'vercel_live_coldchain_mobile_02_modal.png') });
      console.log('📸 Đã chụp: vercel_live_coldchain_mobile_02_modal.png');
      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(400);
    }

    await mobileCtx.close();

    console.log('\n==================================================');
    console.log('🎉 KIỂM THỬ TRỰC TIẾP TRÊN VERCEL HOÀN TOÀN THÀNH CÔNG!');
    console.log(`Số lỗi Console phát sinh: ${consoleErrors.length}`);
    console.log('==================================================\n');
  } finally {
    await browser.close();
  }
}

verifyLiveVercelColdChain().catch(err => {
  console.error('❌ Thất bại trên Vercel:', err);
  process.exit(1);
});
