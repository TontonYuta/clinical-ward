const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== VERIFYING PRODUCTION PDF FEATURES (IN-APP DRAWER & UPLOAD PREVIEW) ===');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });

  console.log('1. Navigating to https://clinical-ward.vercel.app ...');
  await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);

  console.log('2. Opening Giám định BHYT tab...');
  const bhytTab = page.locator('button:has-text("Giám định BHYT"):visible').first();
  await bhytTab.waitFor({ state: 'visible', timeout: 15000 });
  await bhytTab.click();
  await page.waitForTimeout(2000);

  // --- TEST 1: BẤM NGUỒN PDF TỪ TAB DANH MỤC THÔNG TƯ 20 ---
  console.log('3. Testing In-App PDF Drawer from Tra cứu TT 20...');
  const catalogSubtab = page.locator('button:has-text("Tra cứu TT 20")').first();
  await catalogSubtab.waitFor({ state: 'visible', timeout: 10000 });
  await catalogSubtab.click();
  await page.waitForTimeout(1500);

  const pageBtn = page.locator('button:has-text("Trang ")').first();
  await pageBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Clicking PDF page button:', await pageBtn.innerText());
  await pageBtn.click();
  await page.waitForTimeout(2000);

  const pdfDrawer = page.locator('[data-testid="in-app-pdf-drawer"]').first();
  const isDrawerVisible = await pdfDrawer.isVisible();
  console.log('✓ In-App PDF Drawer visible:', isDrawerVisible);

  const drawerIframe = page.locator('[data-testid="in-app-pdf-iframe"]').first();
  const iframeSrc = await drawerIframe.getAttribute('src');
  console.log('✓ Drawer iframe src:', iframeSrc);

  const ssDrawer = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/prod_verified_pdf_drawer.png';
  await page.screenshot({ path: ssDrawer });
  console.log('✓ Saved screenshot of PDF Drawer:', ssDrawer);

  // Close drawer
  const closeBtn = page.locator('button[title="Đóng (Esc)"]').first();
  await closeBtn.click();
  await page.waitForTimeout(1000);

  // --- TEST 2: UPLOAD PDF ĐƠN THUỐC ---
  console.log('4. Testing Prescription PDF Upload & Inline Preview...');
  const overviewSubtab = page.locator('button[data-testid="tab-pure-breakdown"], button:has-text("Bảng phân tách")').first();
  await overviewSubtab.click();
  await page.waitForTimeout(1000);

  const samplePdfPath = '/home/tontonyuta/Downloads/DoAn2/public/pdf/bhyt/Quyet_Dinh_130_QD_BYT_2023_Chuan_Du_Lieu_Dau_Ra_BHYT.pdf';
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(samplePdfPath);
  console.log('Uploaded PDF file to input...');
  await page.waitForTimeout(4000);

  const uploadPreviewIframe = page.locator('iframe[title="PDF Đơn Thuốc"]').first();
  const isPreviewVisible = await uploadPreviewIframe.isVisible();
  console.log('✓ Uploaded PDF Preview Iframe visible:', isPreviewVisible);

  const previewSrc = await uploadPreviewIframe.getAttribute('src');
  console.log('✓ Uploaded Preview iframe src:', previewSrc);

  const ssUpload = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/prod_verified_pdf_upload.png';
  await page.screenshot({ path: ssUpload });
  console.log('✓ Saved screenshot of PDF Upload preview:', ssUpload);

  console.log('\n--- CONSOLE ERRORS ENCOUNTERED ---');
  const relevantErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('chrome-extension'));
  console.log(relevantErrors.length === 0 ? '🎉 ZERO CONSOLE ERRORS!' : relevantErrors.join('\n'));

  await browser.close();
  console.log('=== VERIFICATION SCRIPT COMPLETED ===');
})();
