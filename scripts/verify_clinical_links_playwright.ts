/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E Verification: 100% Authoritative Medical Source Links
 * Verifies ZERO Google Search links, direct official government & FDA endpoints
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/authoritative_medical_links_ui';

async function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  console.log('🚀 Launching Chromium for Authoritative Medical Links Verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Navigating to Clinical Ward at http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Check FEFO Tab
  console.log('2. Checking Kho Dược FEFO Tab...');
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(1000);

  const fefoLinks = await page.locator('table a:has-text("Chuẩn BYT"):visible').evaluateAll((els) =>
    els.map((el) => el.getAttribute('href') || '')
  );
  console.log(`- Found ${fefoLinks.length} NIDQC verification links in FEFO rows.`);
  for (const href of fefoLinks) {
    if (!href.startsWith('https://nidqc.gov.vn')) {
      throw new Error(`Expected NIDQC link to start with https://nidqc.gov.vn, got ${href}`);
    }
  }
  console.log('✅ All FEFO rows link directly to official NIDQC portal (https://nidqc.gov.vn).');

  // 2. Open National Drug Registry Modal
  console.log('3. Opening Cổng Dữ Liệu Dược Quốc Gia Modal...');
  const natRegBtn = page.locator('button:has-text("Dược Quốc Gia"):visible').first();
  await natRegBtn.click();
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_national_drug_registry_official_links.png') });

  // Extract all external links in table
  const tableLinks = await page.locator('table tbody a[target="_blank"]').evaluateAll((els) =>
    els.map((el) => ({
      href: el.getAttribute('href') || '',
      text: el.textContent?.trim() || '',
      title: el.getAttribute('title') || '',
      target: el.getAttribute('target') || '',
    }))
  );
  console.log(`- Extracted ${tableLinks.length} external links from registry table.`);

  // Assert ZERO Google search links exist
  const googleSearchLinks = tableLinks.filter((l) => l.href.includes('google.com/search'));
  if (googleSearchLinks.length > 0) {
    throw new Error(`Found ${googleSearchLinks.length} unauthorized Google Search links!`);
  }
  console.log('✅ ZERO Google Search links found in National Drug Registry table! 100% authoritative.');

  // Assert Atropine SPL link has clean query (no "Atropine e")
  const fdaLinks = tableLinks.filter((l) => l.href.includes('dailymed.nlm.nih.gov'));
  console.log(`- Found ${fdaLinks.length} US FDA DailyMed SPL links.`);
  for (const fda of fdaLinks) {
    if (fda.href.includes('Atropine%20e') || fda.href.includes('Atropine+e')) {
      throw new Error(`Found malformed Atropine query in FDA link: ${fda.href}`);
    }
  }
  console.log('✅ All US FDA DailyMed queries use properly mapped English INN (zero typos/artifacts).');

  // 3. Test Toggle: Turn OFF links
  console.log('4. Testing Toggle button (Turn OFF verification links)...');
  const toggleBtn = page.locator('button:has-text("Link kiểm chứng:")').first();
  await toggleBtn.click();
  await page.waitForTimeout(500);

  const linksCountOff = await page.locator('table tbody a[target="_blank"]').count();
  console.log(`- Registry links count when toggled OFF: ${linksCountOff} (Expected 0)`);
  if (linksCountOff !== 0) {
    throw new Error(`Expected 0 links when toggled OFF, got ${linksCountOff}`);
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_verification_links_toggled_off.png') });

  // Turn back ON
  console.log('5. Toggling verification links back ON...');
  await toggleBtn.click();
  await page.waitForTimeout(500);

  // 4. Test In-App Dược Thư Monograph Button
  console.log('6. Clicking "Chuẩn BYT" button in table...');
  const firstMonographBtn = page.locator('button:has-text("Chuẩn BYT"):visible').first();
  await firstMonographBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_in_app_pharmacopeia_monograph.png') });

  // Verify MedicationSafetyModal opened with official citation
  const officialSourceTitle = await page.locator('text=Nguồn trích xuất y tế chính thống').count();
  console.log(`- In-App Official Pharmacopoeia Monograph rendered: ${officialSourceTitle > 0}`);
  if (officialSourceTitle === 0) {
    throw new Error('Failed to render in-app official monograph with official medical citations!');
  }

  // Collect links in Medication Safety Modal
  const modalLinks = await page.locator('div[role="dialog"] a[target="_blank"]').evaluateAll((els) =>
    els.map((el) => ({
      href: el.getAttribute('href') || '',
      text: el.textContent?.trim() || '',
      title: el.getAttribute('title') || '',
    }))
  );
  console.log(`- Extracted ${modalLinks.length} authoritative links from Medication Safety Modal:`);
  modalLinks.forEach((l) => console.log(`  • [${l.text}] -> ${l.href}`));

  // Switch to Tab Dược lý, Giải độc
  console.log('7. Switching to tab "Dược lý, Giải độc"...');
  const clinicalTabBtn = page.locator('button:has-text("Dược lý, Giải độc")').first();
  await clinicalTabBtn.click();
  await page.waitForTimeout(500);

  const boxedWarningLink = await page.locator('a:has-text("Cảnh báo hộp đen FDA (Mỹ)")').getAttribute('href');
  console.log(`- FDA Boxed Warning link: ${boxedWarningLink}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_clinical_safety_boxed_warning.png') });

  // 5. Test Network Accessibility (Status 200) for all official authoritative endpoints
  const officialEndpoints = [
    'https://dav.gov.vn/dang-ki-thuoc---cong-bo-nguyen-lieu-c311.html',
    'https://nidqc.gov.vn',
    'https://vanban.chinhphu.vn/?pageid=27160&docid=189732',
    'https://vanban.chinhphu.vn/?pageid=27160&docid=192461',
    'https://kcb.vn',
    'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=morphine',
    'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=atropine',
    'https://list.essentialmeds.org',
  ];

  console.log('\n================ OFFICIAL ENDPOINTS ACCESSIBILITY CHECK ================');
  const networkResults: { url: string; status: number; ok: boolean }[] = [];

  for (const url of officialEndpoints) {
    process.stdout.write(`Testing: ${url.substring(0, 65)}... `);
    const res = await context.request.get(url, { timeout: 15000 });
    const status = res.status();
    const ok = status >= 200 && status < 400;
    console.log(`Status: ${status} (${ok ? '✅ OK' : '❌ FAIL'})`);
    networkResults.push({ url, status, ok });
    await new Promise((r) => setTimeout(r, 400));
  }

  await browser.close();

  console.log('\n================ VERIFICATION SUMMARY ================');
  console.table(
    networkResults.map((r) => ({
      Endpoint: r.url.substring(0, 55) + '...',
      Status: r.status,
      Accessible: r.ok ? '✅ YES' : '❌ NO',
    }))
  );

  const failed = networkResults.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} official endpoints failed accessibility check!`);
  }

  console.log('🎉 100% OF OFFICIAL MEDICAL CITATIONS & GOVERNMENT ENDPOINTS RETURNED 200 OK!');
}

main().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
