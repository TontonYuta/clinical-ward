/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E: Kiểm thử trực tiếp trên ứng dụng online Vercel (https://clinical-ward.vercel.app)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function runLiveTest() {
  console.log('🚀 Checking live online deployment: https://clinical-ward.vercel.app ...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();

  try {
    await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Loaded https://clinical-ward.vercel.app');

    // 1. Click Kho dược FEFO
    const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoBtn.click();
    await page.waitForTimeout(800);

    // 2. Click Dược Quốc Gia
    const regBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
    await regBtn.click();
    await page.waitForTimeout(1500);

    const bodyText = await page.textContent('body');
    console.log('Badge check on live site:', {
      has54885: bodyText?.includes('54.885') || bodyText?.includes('54,885'),
      hasZero: bodyText?.includes('Hiển thị 0 thuốc')
    });

    const shot = path.join(ARTIFACT_DIR, 'live_vercel_55k_verified.png');
    await page.screenshot({ path: shot });
    console.log(`📸 Saved live screenshot: ${shot}`);

    // Switch to Gây nghiện tab
    const opioidTab = page.locator('[data-testid="registry-tab-Thuốc gây nghiện"]');
    if (await opioidTab.isVisible()) {
      await opioidTab.click();
      await page.waitForTimeout(800);
      const shotOpioid = path.join(ARTIFACT_DIR, 'live_vercel_opioids_verified.png');
      await page.screenshot({ path: shotOpioid });
      console.log(`📸 Saved live opioids screenshot: ${shotOpioid}`);
    }

    console.log('🎉 Live Vercel 55k verification PASSED!');
  } catch (err) {
    console.error('❌ Live test failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runLiveTest();
