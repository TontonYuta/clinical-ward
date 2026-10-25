import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/authoritative_medical_links_ui';

async function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open CPOE tab -> Click "Thông tin thuốc"
  console.log('2. Opening CPOE Tab and Medication Safety Search...');
  const cpoeTabBtn = page.locator('button:has-text("Kê đơn CPOE"):visible').first();
  await cpoeTabBtn.click();
  await page.waitForTimeout(800);

  const cpoeSafetyBtn = page.locator('button:has-text("Thông tin thuốc"):visible').first();
  await cpoeSafetyBtn.click();
  await page.waitForTimeout(800);

  // Type "Ceftriaxone" in search input
  console.log('3. Typing "Ceftriaxone" in search bar...');
  const searchInput = page.locator('div[role="dialog"] input[placeholder*="Nhập tên thuốc"]').first();
  await searchInput.fill('Ceftriaxone');
  await page.waitForTimeout(500);

  // Click Ceftriaxone in dropdown
  const ceftResult = page.locator('div[role="dialog"] button:has-text("Ceftriaxone")').first();
  await ceftResult.click();
  await page.waitForTimeout(1000);

  // Take screenshot of Ceftriaxone monograph
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_ceftriaxone_safety_monograph.png') });
  console.log('📸 Saved screenshot: 05_ceftriaxone_safety_monograph.png');

  // Verify verification links rendered inside Ceftriaxone modal
  const links = await page.locator('div[role="dialog"] a[target="_blank"]').evaluateAll((els) =>
    els.map((el) => ({
      text: el.textContent?.trim() || '',
      href: el.getAttribute('href') || '',
      title: el.getAttribute('title') || '',
    }))
  );
  console.log('Ceftriaxone modal links:', links);

  // Assert direct DailyMed SPL link for Ceftriaxone
  const fdaLink = links.find((l) => l.href.includes('dailymed.nlm.nih.gov'));
  if (!fdaLink || !fdaLink.href.includes('9c801096-ca61-4b29-a1e1-5f7e7813b191')) {
    throw new Error(`Expected direct DailyMed SPL SetID link for Ceftriaxone, got: ${fdaLink?.href}`);
  }
  console.log('✅ Ceftriaxone directly links to US FDA SPL SetID: 9c801096-ca61-4b29-a1e1-5f7e7813b191');

  // Assert DAV link points to congbothuoc/index
  const davLink = links.find((l) => l.href.includes('dav.gov.vn'));
  if (!davLink || !davLink.href.includes('congbothuoc/index')) {
    throw new Error(`Expected DAV link to point to congbothuoc/index, got: ${davLink?.href}`);
  }
  console.log('✅ DAV link points to official registration portal: https://dichvucong.dav.gov.vn/congbothuoc/index');

  // Assert KCB antibiotic link points to official AMR portal
  const lawLink = links.find((l) => l.href.includes('kcb.vn'));
  if (!lawLink || !lawLink.href.includes('phong-chong-khang-thuoc')) {
    throw new Error(`Expected KCB antibiotic link, got: ${lawLink?.href}`);
  }
  console.log('✅ Antibiotic guideline points to official KCB AMR portal: https://kcb.vn/.../phong-chong-khang-thuoc');

  await browser.close();
  console.log('🎉 ALL CEFTRIAXONE VERIFICATION CHECKS PASSED PERFECTLY!');
}

main().catch(console.error);
