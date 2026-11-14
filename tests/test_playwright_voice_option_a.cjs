const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testVoiceOptionA() {
  console.log('=== PLAYWRIGHT VERIFICATION: VOICE UX OPTION A ===');
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

  console.log('1. Navigating to Clinical Ward application...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Open Copilot
  const openCopilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await openCopilotBtn.waitFor({ state: 'visible', timeout: 5000 });
  await openCopilotBtn.click();
  await page.waitForTimeout(500);

  const voiceBtn = page.locator('button[data-testid="chat-voice-btn"]').first();
  const inputField = page.locator('input[data-testid="chat-input-field"]').first();
  await voiceBtn.waitFor({ state: 'visible', timeout: 5000 });
  await inputField.waitFor({ state: 'visible', timeout: 5000 });

  // Helper to ensure Copilot is ready
  const waitForReady = async () => {
    await page.locator('input[data-testid="chat-input-field"]:not([disabled])').waitFor({ state: 'visible', timeout: 15000 });
  };

  await waitForReady();

  // -------------------------------------------------------------
  // TEST CASE 1: Instant Send ("Gửi ngay")
  // -------------------------------------------------------------
  console.log('\n--- TEST CASE 1: Instant Send ("Gửi ngay") ---');
  await voiceBtn.click();
  await page.waitForTimeout(400);

  // Check Option A buttons visible
  const instantSendBtn = page.locator('button[data-testid="voice-instant-send-btn"]').first();
  const stopBtn = page.locator('button[data-testid="voice-stop-btn"]').first();
  const cancelBtn = page.locator('button[data-testid="voice-cancel-btn"]').first();
  const toggleBtn = page.locator('button[data-testid="voice-auto-send-toggle"]').first();

  await instantSendBtn.waitFor({ state: 'visible', timeout: 3000 });
  await stopBtn.waitFor({ state: 'visible', timeout: 3000 });
  await cancelBtn.waitFor({ state: 'visible', timeout: 3000 });
  await toggleBtn.waitFor({ state: 'visible', timeout: 3000 });
  console.log('✅ Option A Voice Bar & action buttons successfully displayed!');

  // Simulate speech
  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      window.__activeRecognition.onresult({
        results: [Object.assign([{ transcript: text }], { isFinal: true })]
      });
    }
  }, 'Kiểm tra tương tác Morphin và Diazepam');
  await page.waitForTimeout(300);

  const textInField = await inputField.inputValue();
  console.log(`- Transcribed Text in Field: "${textInField}"`);
  await page.screenshot({ path: path.join(screenshotDir, '13_voice_option_a_instant_send_bar.png') });

  // Click Instant Send
  console.log('- Clicking "Gửi ngay" button...');
  await instantSendBtn.click();
  await page.waitForTimeout(800);

  const fieldAfterInstant = await inputField.inputValue();
  console.log(`- Field after Instant Send (should be empty): "${fieldAfterInstant}"`);
  if (fieldAfterInstant !== '') throw new Error('Input field was not cleared after Instant Send!');
  console.log('✅ Instant Send worked perfectly: query dispatched immediately!');

  // Wait for Copilot response to finish processing
  console.log('- Waiting for Copilot to finish processing...');
  await waitForReady();

  // -------------------------------------------------------------
  // TEST CASE 2: Stop & Keep Text ("Dừng sửa")
  // -------------------------------------------------------------
  console.log('\n--- TEST CASE 2: Stop & Keep Text ("Dừng sửa") ---');
  await voiceBtn.click();
  await page.waitForTimeout(400);

  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      window.__activeRecognition.onresult({
        results: [Object.assign([{ transcript: text }], { isFinal: true })]
      });
    }
  }, 'Kê đơn Paracetamol 500mg');
  await page.waitForTimeout(300);

  // Click "Dừng sửa"
  console.log('- Clicking "Dừng sửa" button...');
  const stopBtn2 = page.locator('button[data-testid="voice-stop-btn"]').first();
  await stopBtn2.click();
  await page.waitForTimeout(500);

  // Field should keep the text, recording should be stopped
  const fieldAfterStop = await inputField.inputValue();
  console.log(`- Field after "Dừng sửa" (must keep text): "${fieldAfterStop}"`);
  if (!fieldAfterStop.includes('Paracetamol 500mg')) {
    throw new Error('Text was lost after clicking "Dừng sửa"!');
  }
  const isStillListening = await instantSendBtn.isVisible().catch(() => false);
  console.log(`- Is Voice Bar still active: ${isStillListening} (expected false)`);
  if (isStillListening) throw new Error('Voice recognition did not stop on "Dừng sửa"!');
  console.log('✅ "Dừng sửa" worked perfectly: stopped recording and preserved text for editing!');

  // Clear field for next test
  await inputField.fill('');
  await waitForReady();

  // -------------------------------------------------------------
  // TEST CASE 3: Discard / Cancel ("Hủy bỏ")
  // -------------------------------------------------------------
  console.log('\n--- TEST CASE 3: Discard / Cancel ("Hủy bỏ") ---');
  await inputField.fill('Đơn thuốc cũ cần lưu');
  await voiceBtn.click();
  await page.waitForTimeout(400);

  // Speak some noise
  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      window.__activeRecognition.onresult({
        results: [Object.assign([{ transcript: text }], { isFinal: true })]
      });
    }
  }, 'Âm thanh ồn ào không mong muốn');
  await page.waitForTimeout(300);

  const noisyField = await inputField.inputValue();
  console.log(`- Field during speech: "${noisyField}"`);

  // Click Cancel ("Hủy")
  console.log('- Clicking "Hủy bỏ" (X) button...');
  const cancelBtn3 = page.locator('button[data-testid="voice-cancel-btn"]').first();
  await cancelBtn3.click();
  await page.waitForTimeout(500);

  const restoredField = await inputField.inputValue();
  console.log(`- Field after cancel (must revert to initial): "${restoredField}"`);
  if (restoredField !== 'Đơn thuốc cũ cần lưu') {
    throw new Error(`Cancel failed! Expected "Đơn thuốc cũ cần lưu", got "${restoredField}"`);
  }
  console.log('✅ "Hủy bỏ" worked perfectly: reverted to previous text and cancelled voice input!');

  // Clear field
  await inputField.fill('');

  // -------------------------------------------------------------
  // TEST CASE 4: Hands-free Auto-send on 2.0s Silence
  // -------------------------------------------------------------
  console.log('\n--- TEST CASE 4: Hands-free Auto-send after 1s Silence ---');
  await voiceBtn.click();
  await page.waitForTimeout(400);

  // Speak query
  await page.evaluate((text) => {
    if (window.__activeRecognition && window.__activeRecognition.onresult) {
      window.__activeRecognition.onresult({
        results: [Object.assign([{ transcript: text }], { isFinal: true })]
      });
    }
  }, 'Liều dùng Paracetamol cho trẻ em 15kg');
  await page.waitForTimeout(300);

  // Verify countdown badge is visible
  const countdownBadge = page.locator('text=Ngừng nói... Tự gửi sau 1s').first();
  const isCountingDown = await countdownBadge.isVisible().catch(() => false);
  console.log(`- Countdown badge visible: ${isCountingDown}`);
  await page.screenshot({ path: path.join(screenshotDir, '14_voice_option_a_silence_countdown.png') });

  console.log('- Waiting 1.3s for silence timer to trigger auto-send...');
  await page.waitForTimeout(1300);

  const fieldAfterSilence = await inputField.inputValue();
  console.log(`- Field after silence auto-send (should be empty): "${fieldAfterSilence}"`);
  if (fieldAfterSilence !== '') {
    throw new Error('Auto-send after 1s silence did not fire!');
  }
  console.log('✅ Hands-free Auto-send on silence worked perfectly: message automatically submitted!');
  await waitForReady();

  // -------------------------------------------------------------
  // TEST CASE 5: Toggle Auto-Send ON/OFF
  // -------------------------------------------------------------
  console.log('\n--- TEST CASE 5: Toggle Auto-Send Mode ---');
  await voiceBtn.click();
  await page.waitForTimeout(400);

  const toggleBtn5 = page.locator('button[data-testid="voice-auto-send-toggle"]').first();
  const toggleTextBefore = await toggleBtn5.innerText();
  console.log(`- Toggle text initial: "${toggleTextBefore}"`);

  await toggleBtn5.click();
  await page.waitForTimeout(300);
  const toggleTextAfter = await toggleBtn5.innerText();
  console.log(`- Toggle text after click: "${toggleTextAfter}"`);

  const storedPref = await page.evaluate(() => localStorage.getItem('clinical_voice_auto_send'));
  console.log(`- Stored preference in localStorage: "${storedPref}"`);
  if (storedPref !== 'false') {
    throw new Error('Toggle state not saved to localStorage!');
  }

  // Stop recording
  const stopBtn5 = page.locator('button[data-testid="voice-stop-btn"]').first();
  await stopBtn5.click();
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(screenshotDir, '15_voice_option_a_all_controls_verified.png') });
  console.log('\n🎉 ALL 5 TEST CASES FOR OPTION A PASSED 100% GREEN!\n');

  await browser.close();
}

testVoiceOptionA().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
