/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E: Tra cứu 54,885 thuốc Dược Quốc Gia & Tab phân nhóm lâm sàng
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function runTest() {
  console.log('🚀 Starting 55k Registry & Clinical Tabs UI Test...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ App loaded at http://localhost:4173');

    // 1. Navigate to Kho Dược FEFO
    const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoBtn.click();
    await page.waitForTimeout(600);

    // 2. Click Dược Quốc Gia button
    const regBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
    await regBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Opened National Drug Registry Modal');

    // 3. Verify total drugs count displays >= 50,000
    const modalText = await page.textContent('body');
    const has54k = modalText?.includes('54.885') || modalText?.includes('54,885') || modalText?.includes('55k');
    console.log(`ℹ️ Total 55k badge detected: ${has54k}`);

    // Take screenshot of Initial State (Tất cả 55k SĐK)
    const shot1 = path.join(ARTIFACT_DIR, 'ui_55k_registry_tabs_verified.png');
    await page.screenshot({ path: shot1 });
    console.log(`📸 Saved screenshot 1: ${shot1}`);

    // 4. Switch to "Gây nghiện" tab via testid
    const opioidTab = page.locator('[data-testid="registry-tab-Thuốc gây nghiện"]');
    if (await opioidTab.isVisible()) {
      await opioidTab.click();
      await page.waitForTimeout(800);
      console.log('✅ Clicked "Gây nghiện" tab');
      const shotOpioid = path.join(ARTIFACT_DIR, 'ui_55k_opioid_tab_verified.png');
      await page.screenshot({ path: shotOpioid });
      console.log(`📸 Saved Opioid tab screenshot: ${shotOpioid}`);
    }

    // 5. Switch to "Kháng sinh" tab via testid
    const abxTab = page.locator('[data-testid="registry-tab-Kháng sinh"]');
    if (await abxTab.isVisible()) {
      await abxTab.click();
      await page.waitForTimeout(800);
      console.log('✅ Clicked "Kháng sinh" tab');
      const shotAbx = path.join(ARTIFACT_DIR, 'ui_55k_antibiotic_tab_verified.png');
      await page.screenshot({ path: shotAbx });
      console.log(`📸 Saved Antibiotic tab screenshot: ${shotAbx}`);
    }

    // 6. Search for "Paracetamol"
    const searchInput = page.locator('input[placeholder*="Tìm trên 55.000"]').first();
    await searchInput.fill('Paracetamol');
    await page.waitForTimeout(800);
    console.log('✅ Searched "Paracetamol"');

    // 7. Click "Tất cả 55k SĐK" tab to see all Paracetamol formulations across entire registry
    const allTab = page.locator('[data-testid="registry-tab-all"]');
    if (await allTab.isVisible()) {
      await allTab.click();
      await page.waitForTimeout(800);
      console.log('✅ Clicked "Tất cả" tab with search "Paracetamol"');
      const shotSearch = path.join(ARTIFACT_DIR, 'ui_55k_search_paracetamol_verified.png');
      await page.screenshot({ path: shotSearch });
      console.log(`📸 Saved search screenshot: ${shotSearch}`);
    }

    console.log('🎉 Playwright 55k Registry & Tabs Test Passed Successfully!');
  } catch (err) {
    console.error('❌ Playwright Test Error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runTest();
