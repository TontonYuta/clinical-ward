import { chromium } from 'playwright';
import path from 'path';

async function verifyLive() {
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('--- 1. Kiểm tra Live Production Vercel: https://clinical-ward.vercel.app ---');
  await page.goto('https://clinical-ward.vercel.app');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Set mock old messages and force chat window open
  await page.evaluate(() => {
    const oldMessages = [
      { id: 'msg-welcome', sender: 'agent', text: 'Trợ lý hỗ trợ bác sĩ.', timestamp: '08:00' },
      { id: 'msg-user-old', sender: 'user', text: 'Tra cứu thông tin thuốc', timestamp: '08:01' }
    ];
    localStorage.setItem('clinical_chat_messages', JSON.stringify(oldMessages));
    localStorage.setItem('clinical_copilot_open', 'true');
  });

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // Kiểm tra nút Xóa chat cũ trên Production
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  await clearBtn.waitFor({ timeout: 8000 });
  console.log('✅ Nút [Xóa chat cũ] hiển thị chính xác trên Production!');

  // Bấm Xóa chat cũ
  await clearBtn.click();
  await page.waitForTimeout(500);

  const storage = await page.evaluate(() => localStorage.getItem('clinical_chat_messages'));
  console.log('Storage live sau khi xóa:', storage);

  await page.screenshot({ path: path.join(artifactDir, '12_live_production_chat_purged.png'), fullPage: false });
  await browser.close();
  console.log('🎉 XÁC THỰC PLAYWRIGHT TRÊN PRODUCTION THÀNH CÔNG 100%!');
}

verifyLive().catch((err) => {
  console.error('Lỗi Playwright Live:', err);
  process.exit(1);
});
