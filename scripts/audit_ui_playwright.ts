/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kịch bản kiểm tra toàn diện giao diện & ngôn ngữ lâm sàng bằng Playwright
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'playwright_audit');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- BẮT ĐẦU KIỂM TOÁN GIAO DIỆN VỚI PLAYWRIGHT ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // Switch to Director role to access all tabs
  const roleSelect = page.locator('select').first();
  await roleSelect.selectOption('director');
  await page.waitForTimeout(500);

  // Collect and take screenshot of all main tabs
  const tabButtons = await page.locator('nav button, aside button').all();
  console.log(`Tìm thấy ${tabButtons.length} nút điều hướng trong sidebar`);

  // Visit tabs using navigation
  const tabNames = ['debt', 'equipment', 'fefo', 'coldchain', 'cpoe', 'asset_audit'];
  for (let i = 0; i < tabNames.length; i++) {
    const tab = tabNames[i];
    // Find button in sidebar matching the tab
    const navBtn = page.locator(`aside button`).nth(i);
    if (await navBtn.isVisible()) {
      await navBtn.click();
      await page.waitForTimeout(400);
      const filename = `${String(i + 1).padStart(2, '0')}_tab_${tab}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
      console.log(`✓ Đã chụp ảnh tab [${tab}] -> ${filename}`);
    }
  }

  // Open Copilot Chat
  const copilotBtn = page.locator('button[aria-label="Trợ Lý AI Lâm Sàng"], button:has-text("Trợ Lý AI")').first();
  if (await copilotBtn.isVisible()) {
    await copilotBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_copilot_window.png') });
    console.log('✓ Đã chụp ảnh: Trợ lý AI');
  }

  // Scan full text for "y lệnh"
  const fullText = await page.innerText('body');
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  const ylenhLines = lines.filter(l => /y lệnh|Y lệnh|Y Lệnh/i.test(l));
  console.log(`\n=== CÁC DÒNG CHỨA "Y LỆNH" (${ylenhLines.length}) ===`);
  ylenhLines.forEach(l => console.log('  -> ' + l));

  // Scan for emojis
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}📍✓⚡🏷️💊📋⚠️]/u;
  const emojiLines = lines.filter(l => emojiRegex.test(l));
  console.log(`\n=== CÁC DÒNG CHỨA BIỂU TƯỢNG RÁC / EMOJI (${emojiLines.length}) ===`);
  emojiLines.forEach(l => console.log('  -> ' + l));

  await browser.close();
}

runAudit().catch(console.error);
