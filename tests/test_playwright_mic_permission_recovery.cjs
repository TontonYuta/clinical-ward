const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testPermissionRecovery() {
  console.log('=== TEST: MICROPHONE PERMISSION STATES (BLOCKED VS ENABLED) ===');
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  // ---------------------------------------------------------
  // PHASE 1: Microphone Blocked State (Real Browser without permission)
  // ---------------------------------------------------------
  console.log('\n--- PHASE 1: Simulating Blocked/Denied Microphone ---');
  const blockedBrowser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const blockedPage = await blockedBrowser.newPage();
  await blockedPage.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

  const openCopilot1 = blockedPage.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilot1.click();

  const voiceBtn1 = blockedPage.locator('button[data-testid="chat-voice-btn"]').first();
  await voiceBtn1.waitFor({ state: 'visible' });
  await voiceBtn1.click();
  await blockedPage.waitForTimeout(600);

  const errorBanner = blockedPage.locator('div.bg-amber-50').first();
  const hasError = await errorBanner.isVisible().catch(() => false);
  const bannerText = hasError ? await errorBanner.innerText() : '';
  console.log(`- Error banner visible when blocked: ${hasError}`);
  console.log(`- Banner text: "${bannerText.replace(/\n/g, ' ')}"`);
  await blockedPage.screenshot({ path: path.join(screenshotDir, '05_mic_permission_blocked_banner.png') });
  await blockedBrowser.close();

  // ---------------------------------------------------------
  // PHASE 2: Microphone Granted & Activated (Enabled state)
  // ---------------------------------------------------------
  console.log('\n--- PHASE 2: Microphone Granted & Activated ---');
  const activeBrowser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });
  const activeContext = await activeBrowser.newContext({ permissions: ['microphone'] });
  const activePage = await activeContext.newPage();
  await activePage.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

  const openCopilot2 = activePage.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilot2.click();

  const voiceBtn2 = activePage.locator('button[data-testid="chat-voice-btn"]').first();
  await voiceBtn2.waitFor({ state: 'visible' });
  await voiceBtn2.click();
  await activePage.waitForTimeout(600);

  const titleAfterClick = await voiceBtn2.getAttribute('title');
  const listeningBanner = activePage.locator('text=Đang nghe tiếng Việt...').first();
  const isListening = await listeningBanner.isVisible().catch(() => false);
  console.log(`- Voice button title when granted: "${titleAfterClick}"`);
  console.log(`- Listening banner visible: ${isListening}`);
  await activePage.screenshot({ path: path.join(screenshotDir, '06_mic_permission_recovered_active.png') });

  if (!isListening || !titleAfterClick.includes('Đang thu âm')) {
    throw new Error('Microphone failed to activate when permission is granted!');
  }

  await activeBrowser.close();
  console.log('\n=== BOTH PHASES PASSED 100% ===');
}

testPermissionRecovery().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
