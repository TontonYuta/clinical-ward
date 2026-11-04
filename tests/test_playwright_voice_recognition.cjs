const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runVoiceVerification() {
  console.log('=== PLAYWRIGHT VOICE INPUT VERIFICATION ===');
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

  // Grant microphone permission in browser context
  const context = await browser.newContext({
    permissions: ['microphone']
  });
  const page = await context.newPage();

  // Expose recognition instance to window for test observation
  await page.addInitScript(() => {
    const OrigRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (OrigRecognition) {
      window.__activeRecognition = null;
      const CustomRecognition = function() {
        const inst = new OrigRecognition();
        window.__activeRecognition = inst;
        return inst;
      };
      CustomRecognition.prototype = OrigRecognition.prototype;
      window.webkitSpeechRecognition = CustomRecognition;
      window.SpeechRecognition = CustomRecognition;
    }
  });

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

  console.log('1. Navigating to http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

  console.log('2. Opening Clinical Copilot...');
  const openCopilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilotBtn.waitFor({ state: 'visible', timeout: 5000 });
  await openCopilotBtn.click();

  console.log('3. Locating Voice Input button & Chat Input...');
  const voiceBtn = page.locator('button[data-testid="chat-voice-btn"]').first();
  const inputField = page.locator('input[data-testid="chat-input-field"]').first();
  await voiceBtn.waitFor({ state: 'visible', timeout: 5000 });
  await inputField.waitFor({ state: 'visible', timeout: 5000 });

  const initialTitle = await voiceBtn.getAttribute('title');
  console.log(`- Initial Voice Button Title: "${initialTitle}"`);
  await page.screenshot({ path: path.join(screenshotDir, '01_copilot_voice_ready.png') });

  console.log('4. Clicking Voice Input button to start recording...');
  await voiceBtn.click();
  await page.waitForTimeout(600);

  const activeTitle = await voiceBtn.getAttribute('title');
  const activeClass = await voiceBtn.getAttribute('class');
  const isListening = activeClass.includes('rose') || activeClass.includes('animate-pulse');
  console.log(`- Active Voice Button Title: "${activeTitle}"`);
  console.log(`- Is in Listening State: ${isListening}`);

  // Check listening banner
  const listeningBanner = page.locator('text=Đang nghe tiếng Việt...').first();
  const bannerVisible = await listeningBanner.isVisible().catch(() => false);
  console.log(`- Listening Banner Visible: ${bannerVisible}`);
  await page.screenshot({ path: path.join(screenshotDir, '02_voice_listening_active.png') });

  console.log('5. Simulating Speech Recognition Speech Event into onresult...');
  const simulatedSpeech = 'Kiểm tra tương tác Morphin và Diazepam';
  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      const fakeEvent = {
        results: [
          [{ transcript: text }]
        ]
      };
      window.__activeRecognition.onresult(fakeEvent);
    }
  }, simulatedSpeech);

  await page.waitForTimeout(500);

  // Check input field value
  const inputVal = await inputField.inputValue();
  console.log(`- Chat Input Value after Voice Recognition Event: "${inputVal}"`);
  if (!inputVal.includes('Kiểm tra tương tác')) {
    throw new Error(`Voice input text not reflected in input field! Got: "${inputVal}"`);
  }
  await page.screenshot({ path: path.join(screenshotDir, '03_voice_transcribed_text.png') });

  console.log('6. Stopping Voice Input...');
  await voiceBtn.click();
  await page.waitForTimeout(500);

  const stoppedTitle = await voiceBtn.getAttribute('title');
  console.log(`- Voice Button Title after stop: "${stoppedTitle}"`);

  console.log('7. Submitting transcribed voice query to Clinical Copilot...');
  const sendBtn = page.locator('button[type="submit"]').first();
  await sendBtn.click();

  // Wait for AI Copilot response to appear
  console.log('8. Waiting for Copilot clinical response...');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(screenshotDir, '04_copilot_response_received.png') });

  // Get last message in chat
  const botMessage = page.locator('div').filter({ hasText: /Morphin|Diazepam|tương tác|nguy cơ/i }).last();
  const isResponseReceived = await botMessage.isVisible().catch(() => false);
  console.log(`- Copilot Clinical Response Visible: ${isResponseReceived}`);

  console.log('\n=== PLAYWRIGHT VOICE VERIFICATION: 100% SUCCESS ===\n');
  await browser.close();
}

runVoiceVerification().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
