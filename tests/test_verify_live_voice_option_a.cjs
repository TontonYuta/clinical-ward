const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyLiveVoiceOptionA() {
  console.log('=== VERIFY LIVE VERCEL PRODUCTION: VOICE OPTION A ===');
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const context = await browser.newContext({
    permissions: ['microphone']
  });
  const page = await context.newPage();

  console.log('1. Navigating to https://clinical-ward.vercel.app...');
  await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('2. Opening Copilot...');
  const openCopilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilotBtn.waitFor({ state: 'visible', timeout: 5000 });
  await openCopilotBtn.click();
  await page.waitForTimeout(600);

  console.log('3. Clicking Voice button to trigger Option A Bar...');
  const voiceBtn = page.locator('button[data-testid="chat-voice-btn"]').first();
  await voiceBtn.click();
  await page.waitForTimeout(800);

  const instantSendBtn = page.locator('button[data-testid="voice-instant-send-btn"]').first();
  const stopBtn = page.locator('button[data-testid="voice-stop-btn"]').first();
  const cancelBtn = page.locator('button[data-testid="voice-cancel-btn"]').first();
  const toggleBtn = page.locator('button[data-testid="voice-auto-send-toggle"]').first();

  const isInstantVisible = await instantSendBtn.isVisible().catch(() => false);
  const isStopVisible = await stopBtn.isVisible().catch(() => false);
  const isCancelVisible = await cancelBtn.isVisible().catch(() => false);
  const isToggleVisible = await toggleBtn.isVisible().catch(() => false);

  console.log(`- "Gửi ngay" visible: ${isInstantVisible}`);
  console.log(`- "Dừng sửa" visible: ${isStopVisible}`);
  console.log(`- "Hủy bỏ" visible: ${isCancelVisible}`);
  console.log(`- "Tự gửi" toggle visible: ${isToggleVisible}`);

  await page.screenshot({ path: path.join(screenshotDir, '16_live_vercel_option_a_voice_bar.png') });

  if (!isInstantVisible || !isStopVisible || !isCancelVisible || !isToggleVisible) {
    throw new Error('Some Option A voice buttons are missing on live Vercel!');
  }

  console.log('\n🎉 LIVE PRODUCTION VERCEL VERIFICATION: 100% SUCCESS!\n');
  await browser.close();
}

verifyLiveVoiceOptionA().catch((err) => {
  console.error('LIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
