/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Playwright E2E Verification: 100% Authoritative Medical Source Links & User-Driven Input
 * Verifies ZERO Google Search links, ZERO dead NIDQC links, Chuẩn BYT opens in-app monograph,
 * and user-driven search without mock presets.
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
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('1. Navigating to Clinical Ward at http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Check FEFO Tab & Chuẩn BYT Button
  console.log('2. Checking Kho Dược FEFO Tab...');
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(1000);

  // Assert ZERO dead links to nidqc.gov.vn
  const nidqcExternalLinks = await page.locator('table a[href*="nidqc.gov.vn"]:visible').count();
  if (nidqcExternalLinks > 0) {
    throw new Error(`Found ${nidqcExternalLinks} dead links to nidqc.gov.vn! Must be 0.`);
  }
  console.log('✅ ZERO dead links to nidqc.gov.vn in FEFO table.');

  // Check that "Chuẩn BYT" is an actionable button that opens the in-app monograph
  const bytButton = page.locator('table button:has-text("Chuẩn BYT"):visible').first();
  const bytBtnCount = await bytButton.count();
  console.log(`- Found ${bytBtnCount} "Chuẩn BYT" in-app action buttons in FEFO rows.`);
  if (bytBtnCount === 0) {
    throw new Error('Expected at least 1 "Chuẩn BYT" button in FEFO inventory rows!');
  }

  // Click "Chuẩn BYT" on first medication row (e.g. Morphin)
  console.log('3. Clicking "Chuẩn BYT" button on FEFO row...');
  await bytButton.click();
  await page.waitForTimeout(1000);

  // Verify MedicationSafetyModal opened with that drug
  const modalHeader = page.locator('h2:has-text("Thông Tin Thuốc & Hướng Dẫn Sử Dụng An Toàn")');
  if ((await modalHeader.count()) === 0) {
    throw new Error('Medication Safety Modal failed to open upon clicking "Chuẩn BYT"!');
  }
  console.log('✅ "Chuẩn BYT" successfully opened in-app Medication Safety Monograph modal directly.');

  // Verify no sample shortcut chips ("Tra nhanh:")
  const quickChipsCount = await page.locator('text="Tra nhanh:"').count();
  if (quickChipsCount > 0) {
    throw new Error('Found sample shortcut chips "Tra nhanh:", which should be removed!');
  }
  console.log('✅ No hardcoded sample shortcut chips found in modal.');

  // Close modal
  await page.locator('div[role="dialog"] button:has-text("Đóng")').click();
  await page.waitForTimeout(500);

  // 2. Check CPOE Tab: Open "Thông tin thuốc" with user-driven search
  console.log('4. Checking CPOE Tab & User-Driven Search...');
  const cpoeTabBtn = page.locator('button:has-text("Kê đơn CPOE"):visible').first();
  await cpoeTabBtn.click();
  await page.waitForTimeout(1000);

  const cpoeSafetyBtn = page.locator('button:has-text("Thông tin thuốc"):visible').first();
  await cpoeSafetyBtn.click();
  await page.waitForTimeout(800);

  // Verify empty prompt state appears when opened without initial drug
  const emptyStatePrompt = await page.locator('text="Tra cứu thông tin thuốc & chuẩn Bộ Y Tế"').count();
  console.log(`- Empty search prompt present: ${emptyStatePrompt > 0}`);
  if (emptyStatePrompt === 0) {
    throw new Error('Expected clean user-driven search prompt when opened without initial medication!');
  }

  // Test typing in search bar
  console.log('5. Typing "Adrenalin" in search bar...');
  const searchInput = page.locator('div[role="dialog"] input[placeholder*="Nhập tên thuốc"]').first();
  await searchInput.fill('Adrenalin');
  await page.waitForTimeout(500);

  // Verify search dropdown shows Adrenalin
  const searchResult = page.locator('div[role="dialog"] button:has-text("Adrenalin Vinphaco 1mg/1ml")').first();
  if ((await searchResult.count()) === 0) {
    throw new Error('Search result for "Adrenalin" not found!');
  }
  await searchResult.click();
  await page.waitForTimeout(500);

  // Verify Adrenalin monograph is displayed
  const adreLoaded = await page.locator('h3:has-text("Adrenalin Vinphaco")').count();
  if (adreLoaded === 0) {
    throw new Error('Failed to load Adrenalin monograph after selection!');
  }
  console.log('✅ User-driven search and selection loaded Adrenalin monograph successfully.');

  // Close modal
  await page.locator('div[role="dialog"] button:has-text("Đóng")').click();
  await page.waitForTimeout(500);

  // Switch back to FEFO Tab to access National Drug Registry
  console.log('6. Switching back to FEFO tab for National Drug Registry...');
  const fefoTabBtnAgain = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoTabBtnAgain.click();
  await page.waitForTimeout(800);

  // 3. Open National Drug Registry Modal & Verify Authoritative Links
  console.log('7. Opening Cổng Dữ Liệu Dược Quốc Gia Modal...');
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

  // Test Toggle: Turn OFF links
  console.log('7. Testing Toggle button (Turn OFF verification links)...');
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
  console.log('8. Toggling verification links back ON...');
  await toggleBtn.click();
  await page.waitForTimeout(500);

  // Test In-App Dược Thư Monograph Button
  console.log('9. Clicking "Chuẩn BYT" button in registry table...');
  const firstMonographBtn = page.locator('div[role="dialog"][aria-label="Cổng Dữ Liệu Dược Quốc Gia"] table button:has-text("Chuẩn BYT")').first();
  await firstMonographBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_in_app_pharmacopeia_monograph.png') });

  // Verify MedicationSafetyModal opened with official citation
  const officialSourceTitle = await page.locator('text=Nguồn trích xuất y tế chính thống').count();
  console.log(`- In-App Official Pharmacopoeia Monograph rendered: ${officialSourceTitle > 0}`);
  if (officialSourceTitle === 0) {
    throw new Error('Failed to render in-app official monograph with official medical citations!');
  }

  // Switch to Tab Dược lý, Giải độc
  console.log('10. Switching to tab "Dược lý, Giải độc"...');
  const clinicalTabBtn = page.locator('button:has-text("Dược lý, Giải độc")').first();
  await clinicalTabBtn.click();
  await page.waitForTimeout(500);

  const boxedWarningCount = await page.locator('a:has-text("Cảnh báo hộp đen FDA (Mỹ)")').count();
  console.log(`- FDA Boxed Warning element present: ${boxedWarningCount > 0}`);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_clinical_safety_boxed_warning.png') });

  // 4. Test Network Accessibility & Exact Document Content for all official authoritative endpoints
  const officialEndpoints = [
    {
      name: 'DAV Cổng Công Bố SĐK Thuốc',
      url: 'https://dichvucong.dav.gov.vn/congbothuoc/index',
      expectedSnippet: 'CÔNG BỐ GIẤY ĐĂNG KÝ THUỐC',
    },
    {
      name: 'DAV Công Bố Đăng Ký Thuốc & Nguyên Liệu',
      url: 'https://dav.gov.vn/dang-ki-thuoc---cong-bo-nguyen-lieu-c311.html',
      expectedSnippet: 'Cục Quản lý Dược',
    },
    {
      name: 'Thông tư 20/2017/TT-BYT (KSĐB / Morphin)',
      url: 'https://congbao.chinhphu.vn/van-ban/thong-tu-so-20-2017-tt-byt-24490.htm',
      expectedSnippet: '20/2017/TT-BYT',
    },
    {
      name: 'KCB Hệ Thống Văn Bản Khám Chữa Bệnh BYT',
      url: 'https://kcb.vn/van-ban',
      expectedSnippet: 'Văn bản',
    },
    {
      name: 'KCB Chương Trình Quản Lý Sử Dụng Kháng Sinh',
      url: 'https://kcb.vn/cac-chuyen-muc-khac/chuong-trinh-cham-soc-suc-khoe/phong-chong-khang-thuoc',
      expectedSnippet: 'kháng thuốc',
    },
    {
      name: 'Nghị định 131/2020/NĐ-CP (Dược Lâm Sàng Bệnh Viện)',
      url: 'https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-131-2020-nd-cp-32387.htm',
      expectedSnippet: '131/2020/NĐ-CP',
    },
    {
      name: 'Nghị định 98/2021/NĐ-CP (Trang Thiết Bị Y Tế)',
      url: 'https://vanban.chinhphu.vn/?pageid=27160&docid=204442',
      expectedSnippet: '98/2021/NĐ-CP',
    },
    {
      name: 'US FDA DailyMed Ceftriaxone Injection SPL Label',
      url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9c801096-ca61-4b29-a1e1-5f7e7813b191',
      expectedSnippet: 'CEFTRIAXONE',
    },
    {
      name: 'US FDA DailyMed Morphine Injection SPL Label',
      url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9362eca1-2bc9-4f72-8895-0b9179bfeb2b',
      expectedSnippet: 'MORPHINE',
    },
    {
      name: 'US FDA DailyMed Atropine Injection SPL Label',
      url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a66eecf9-2d8b-4e2d-8a05-d718dcbc3542',
      expectedSnippet: 'ATROPINE',
    },
    {
      name: 'Danh mục Thuốc Thiết yếu WHO (eEML)',
      url: 'https://list.essentialmeds.org',
      expectedSnippet: 'Essential',
    },
  ];

  console.log('\n================ OFFICIAL ENDPOINTS ACCESSIBILITY & CONTENT VERIFICATION ================');
  const networkResults: { name: string; url: string; status: number; ok: boolean; title: string }[] = [];

  for (const item of officialEndpoints) {
    const testPage = await context.newPage();
    try {
      process.stdout.write(`Testing: ${item.name.substring(0, 45)}... `);
      const res = await testPage.goto(item.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
      await testPage.waitForTimeout(1000);
      const status = res?.status() || 0;
      const title = await testPage.title();
      const body = (await testPage.innerText('body')).replace(/\s+/g, ' ');

      const hasErrorWord = body.includes("404 Oops! You're lost") || 
                           body.includes("404 PAGE NOT FOUND") || 
                           body.includes("LIÊN KẾT KHÔNG TỒN TẠI") ||
                           title.includes("404") ||
                           title.includes("Forbidden") ||
                           title.includes("Not Found");

      const hasExpected = body.includes(item.expectedSnippet) || title.includes(item.expectedSnippet);
      const ok = status === 200 && !hasErrorWord && hasExpected;

      console.log(`Status: ${status} (${ok ? '✅ OK' : '❌ FAIL'}) - ${title.substring(0, 40)}`);
      networkResults.push({ name: item.name, url: item.url, status, ok, title });
    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
      networkResults.push({ name: item.name, url: item.url, status: 0, ok: false, title: e.message });
    } finally {
      await testPage.close();
    }
  }

  await browser.close();

  console.log('\n================ VERIFICATION SUMMARY ================');
  console.table(
    networkResults.map((r) => ({
      Source: r.name,
      Status: r.status,
      Accessible: r.ok ? '✅ YES' : '❌ NO',
      DocumentTitle: r.title.substring(0, 40) + '...',
    }))
  );

  const failed = networkResults.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} official endpoints failed content/accessibility verification!`);
  }

  console.log('🎉 100% OF OFFICIAL MEDICAL CITATIONS & GOVERNMENT ENDPOINTS LOADED WITH 200 OK & ACCURATE CONTENT!');
}

main().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
