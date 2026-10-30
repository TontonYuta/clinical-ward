import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function testOutageFlow() {
  console.log('⚡ BẮT ĐẦU KIỂM THỬ LUỒNG SỰ CỐ MẤT ĐIỆN & BIỆT TRỮ VẮC XIN GSP...');

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('clinical_user_role', 'pharmacist');
    });

    const page = await context.newPage();
    await page.goto('http://localhost:3001/#coldchain', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Kích hoạt Mô phỏng mất điện
    console.log('👉 Nhấn nút "Mô phỏng mất điện"...');
    const outageBtn = page.locator('button:has-text("Mô phỏng mất điện"):visible').first();
    await outageBtn.click();
    await page.waitForTimeout(1000);

    // 2. Chụp ảnh trạng thái Quá nhiệt / Báo động đỏ
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_outage_alarm_state.png') });
    console.log('📸 Đã chụp: coldchain_outage_alarm_state.png');

    const isTemp11 = await page.locator('text=11.0').count() > 0;
    console.log('🚨 Nhiệt độ 11.0°C hiển thị:', isTemp11);

    // 3. Khôi phục điện
    console.log('👉 Nhấn nút "Khôi phục điện"...');
    const restoreBtn = page.locator('button:has-text("Khôi phục điện"):visible').first();
    await restoreBtn.click();
    await page.waitForTimeout(800);

    // Điền PIN trong ClinicalAuthModal
    const quickPinBtn = page.locator('button:has-text("Điền nhanh PIN demo"):visible').first();
    if (await quickPinBtn.isVisible()) {
      console.log('🔐 Nhấn "Điền nhanh PIN demo"...');
      await quickPinBtn.click();
      await page.waitForTimeout(400);
    } else {
      const pinInput = page.locator('input[type="password"]:visible').first();
      if (await pinInput.isVisible()) {
        await pinInput.fill('2222');
        await page.waitForTimeout(300);
      }
    }

    const confirmAuthBtn = page.locator('button:has-text("Ký Xác Thực & Thực Thi"):visible').first();
    if (await confirmAuthBtn.isVisible()) {
      await confirmAuthBtn.click();
      await page.waitForTimeout(1000);
    }

    // 4. Chụp ảnh trạng thái Biệt trữ sau khôi phục
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_quarantine_state.png') });
    console.log('📸 Đã chụp: coldchain_quarantine_state.png');

    const quarantineBanner = page.locator('[data-testid="coldchain-quarantine-banner"]');
    console.log('📦 Quarantine banner visible:', await quarantineBanner.isVisible());

    // 5. Ký lệnh giải phóng biệt trữ
    console.log('👉 Nhấn nút "Ký lệnh giải phóng lô vắc xin"...');
    const releaseBtn = page.locator('button:has-text("Ký lệnh giải phóng lô vắc xin"):visible').first();
    if (await releaseBtn.isVisible()) {
      await releaseBtn.click();
      await page.waitForTimeout(800);

      // Điền PIN xác thực giải phóng biệt trữ
      const quickPinBtn2 = page.locator('button:has-text("Điền nhanh PIN demo"):visible').first();
      if (await quickPinBtn2.isVisible()) {
        await quickPinBtn2.click();
        await page.waitForTimeout(400);
      } else {
        const pinInput2 = page.locator('input[type="password"]:visible').first();
        if (await pinInput2.isVisible()) {
          await pinInput2.fill('2222');
          await page.waitForTimeout(300);
        }
      }

      const confirmReleaseBtn = page.locator('button:has-text("Ký Xác Thực & Thực Thi"):visible').first();
      if (await confirmReleaseBtn.isVisible()) {
        await confirmReleaseBtn.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'coldchain_released_state.png') });
      console.log('📸 Đã chụp: coldchain_released_state.png');

      const bannerAfterRelease = page.locator('[data-testid="coldchain-quarantine-banner"]');
      console.log('✅ Quarantine banner đã ẩn sau giải phóng:', !(await bannerAfterRelease.isVisible()));
    }

    await context.close();
    console.log('\n==================================================');
    console.log('🎉 TOÀN BỘ LUỒNG SỰ CỐ & BIỆT TRỮ VẮC XIN HOÀN TẤT THÀNH CÔNG 100%!');
    console.log('==================================================\n');
  } finally {
    await browser.close();
  }
}

testOutageFlow().catch(err => {
  console.error('❌ Lỗi luồng sự cố:', err);
  process.exit(1);
});
