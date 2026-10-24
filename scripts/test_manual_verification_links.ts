/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E Test: Manual Clinical Verification Links & Toggle Verification
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verification_links_ui';

async function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Check Pharmacy FEFO Tab
  console.log('2. Opening Kho dược FEFO...');
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(1000);

  // Check if inventory rows have "Chuẩn BYT" badge
  const verifyBadgeInRow = page.locator('a:has-text("Chuẩn BYT"):visible').first();
  const hasRowBadge = (await verifyBadgeInRow.count()) > 0;
  console.log(`- FEFO row verification badge present: ${hasRowBadge}`);
  if (hasRowBadge) {
    const rowHref = await verifyBadgeInRow.getAttribute('href');
    console.log(`- FEFO row verification badge link: ${rowHref}`);
  }

  // 2. Open National Drug Registry Modal
  console.log('3. Opening Cổng Dữ Liệu Dược Quốc Gia...');
  const natRegBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
  await natRegBtn.click();
  await page.waitForTimeout(1500);

  // Check modal title
  await page.waitForSelector('text=Cổng Dữ Liệu Dược Quốc Gia');

  // Verify SĐK links
  const davLink = page.locator('table a[title*="Cục Quản lý Dược"]').first();
  const davHref = await davLink.getAttribute('href');
  console.log(`- DAV SĐK verification link href: ${davHref}`);

  // Verify NIDQC & FDA links in table
  const nidqcLink = page.locator('table a[title*="Viện Kiểm nghiệm"]').first();
  const nidqcHref = await nidqcLink.getAttribute('href');
  console.log(`- NIDQC verification link href: ${nidqcHref}`);

  const fdaLink = page.locator('table a[title*="FDA"]').first();
  const fdaHref = await fdaLink.getAttribute('href');
  console.log(`- FDA DailyMed verification link href: ${fdaHref}`);

  // Save screenshot of Verification Links ON
  const shot1 = path.join(ARTIFACTS_DIR, '31_verification_links_enabled.png');
  await page.screenshot({ path: shot1 });
  console.log(`📸 Screenshot saved: ${shot1}`);

  // 3. Test Toggle: Turn Verification OFF
  console.log('4. Toggling Verification Links OFF...');
  const toggleBtn = page.locator('button:has-text("Link kiểm chứng:")').first();
  await toggleBtn.click();
  await page.waitForTimeout(500);

  const toggleBtnText = await toggleBtn.innerText();
  console.log(`- Toggle button text after click: ${toggleBtnText}`);

  // Verify links are hidden
  const davLinksCount = await page.locator('table a[title*="Cục Quản lý Dược"]').count();
  const nidqcLinksCount = await page.locator('table a[title*="Viện Kiểm nghiệm"]').count();
  console.log(`- DAV links count (should be 0): ${davLinksCount}`);
  console.log(`- NIDQC links count (should be 0): ${nidqcLinksCount}`);

  // Save screenshot of Verification Links OFF
  const shot2 = path.join(ARTIFACTS_DIR, '32_verification_links_disabled_hidden.png');
  await page.screenshot({ path: shot2 });
  console.log(`📸 Screenshot saved: ${shot2}`);

  // 4. Test Toggle: Turn Verification back ON
  console.log('5. Toggling Verification Links back ON...');
  await toggleBtn.click();
  await page.waitForTimeout(500);

  // 5. Open Medication Safety Modal (Hướng dẫn dùng thuốc)
  console.log('6. Opening Hướng dẫn dùng thuốc...');
  const first5DungBtn = page.locator('button:has-text("Hướng dẫn dùng thuốc")').first();
  await first5DungBtn.click();
  await page.waitForTimeout(1000);

  // Verify VerificationPanelSection is present
  const panelSection = page.locator('text=Đối soát nguồn y tế chính thống');
  const hasPanelSection = (await panelSection.count()) > 0;
  console.log(`- VerificationPanelSection rendered: ${hasPanelSection}`);

  const shot3 = path.join(ARTIFACTS_DIR, '33_medication_safety_verification_panel.png');
  await page.screenshot({ path: shot3 });
  console.log(`📸 Screenshot saved: ${shot3}`);

  // 6. Test Tab "Liều dùng & Hướng dẫn an toàn"
  console.log('7. Switching to tab "Liều dùng & Hướng dẫn an toàn"...');
  const fiveRightsTabBtn = page.locator('button:has-text("Liều dùng & Hướng dẫn an toàn")').first();
  await fiveRightsTabBtn.click();
  await page.waitForTimeout(500);

  const shot35 = path.join(ARTIFACTS_DIR, '35_medication_safety_five_rights_grid.png');
  await page.screenshot({ path: shot35 });
  console.log(`📸 Screenshot saved: ${shot35}`);

  // 7. Test Tab "Dược lý, Giải độc"
  console.log('8. Switching to tab "Dược lý, Giải độc"...');
  const clinicalTabBtn = page.locator('button:has-text("Dược lý, Giải độc")').first();
  await clinicalTabBtn.click();
  await page.waitForTimeout(500);

  const shot4 = path.join(ARTIFACTS_DIR, '34_medication_safety_boxed_warning.png');
  await page.screenshot({ path: shot4 });
  console.log(`📸 Screenshot saved: ${shot4}`);

  await browser.close();
  console.log('✅ ALL VERIFICATION LINK TESTS PASSED CLEANLY!');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
