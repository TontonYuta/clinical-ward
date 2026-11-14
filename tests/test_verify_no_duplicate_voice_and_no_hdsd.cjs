const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyNoDuplicateAndNoHdsd() {
  console.log('=== TEST: VERIFY NO DUPLICATE VOICE SEND & NO HDSD IN CHATBOT ===');
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

  // Expose mock recognition
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

  console.log('1. Navigating to http://127.0.0.1:3000...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('2. Opening Copilot...');
  const openCopilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilotBtn.click();
  await page.waitForTimeout(600);

  // -------------------------------------------------------------
  // TEST 1: Check HDSD is GONE from Chatbot Header
  // -------------------------------------------------------------
  console.log('\n--- CHECK 1: Verify HDSD button is removed from Chatbot Header ---');
  const hdsdInChat = page.locator('button:has-text("HDSD")');
  const isHdsdPresent = await hdsdInChat.isVisible().catch(() => false);
  console.log(`- Is HDSD button visible in Chatbot: ${isHdsdPresent} (must be FALSE)`);
  if (isHdsdPresent) {
    throw new Error('HDSD button is still present in Chatbot header!');
  }
  console.log('✅ HDSD button was successfully removed from Chatbot header!');

  // -------------------------------------------------------------
  // TEST 2: Verify Rotating Arrow Icon is Present
  // -------------------------------------------------------------
  console.log('\n--- CHECK 2: Verify Rotating Arrow Icon (RotateCcw) ---');
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]').first();
  await clearBtn.waitFor({ state: 'visible', timeout: 5000 });
  const html = await clearBtn.innerHTML();
  if (!html.includes('rotate-ccw') && !html.includes('M3 12a9 9 0')) {
    throw new Error('RotateCcw icon not found in clear button!');
  }
  console.log('✅ Circular rotating arrow icon verified!');

  // -------------------------------------------------------------
  // TEST 3: Verify Voice Sends EXACTLY ONCE (No Duplicate)
  // -------------------------------------------------------------
  console.log('\n--- CHECK 3: Verify Voice Input NEVER Sends Duplicate Messages ---');
  const voiceBtn = page.locator('button[data-testid="chat-voice-btn"]').first();
  const inputField = page.locator('input[data-testid="chat-input-field"]').first();

  // Count user messages before voice
  const countUserMessages = async () => {
    return await page.locator('div').filter({ hasText: /^Bác sĩ/i }).count();
  };

  await voiceBtn.click();
  await page.waitForTimeout(400);

  const queryText = 'Kiểm tra tương tác Morphin và Diazepam';
  // Simulate speech
  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      window.__activeRecognition.onresult({
        results: [Object.assign([{ transcript: text }], { isFinal: true })]
      });
    }
  }, queryText);
  await page.waitForTimeout(300);

  console.log('- Triggering Instant Send ("Gửi ngay")...');
  const instantSendBtn = page.locator('button[data-testid="voice-instant-send-btn"]').first();
  await instantSendBtn.click();

  // Also simulate trailing browser onresult and onend right after click to test race condition resistance
  await page.evaluate((text) => {
    if (window.__activeRecognition) {
      if (window.__activeRecognition.onresult) {
        window.__activeRecognition.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
      }
      if (window.__activeRecognition.onend) {
        window.__activeRecognition.onend();
      }
    }
  }, queryText);

  await page.waitForTimeout(1000);

  // Check how many messages in chat contain queryText
  const userBubbleWithQuery = page.locator(`.flex-1.overflow-y-auto div:has-text("${queryText}")`);
  const matchingCount = await userBubbleWithQuery.count();
  console.log(`- Matched chat elements containing query: ${matchingCount}`);

  // Specifically check for individual message items
  const messageItems = await page.evaluate((text) => {
    const bubbles = Array.from(document.querySelectorAll('.flex-1.overflow-y-auto [class*="rounded-xl"]'));
    return bubbles.filter(b => b.textContent && b.textContent.includes(text)).length;
  }, queryText);
  console.log(`- Number of message bubbles containing query: ${messageItems}`);

  if (messageItems !== 1) {
    throw new Error(`DUPLICATE DETECTED! Expected exactly 1 bubble, found ${messageItems}!`);
  }
  console.log('✅ DUPLICATE PREVENTION VERIFIED: Message sent exactly 1 time!');

  await page.screenshot({ path: path.join(screenshotDir, '18_no_duplicate_voice_verified.png') });
  console.log('\n🎉 ALL CHECKS PASSED 100% GREEN!\n');

  await browser.close();
}

verifyNoDuplicateAndNoHdsd().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
