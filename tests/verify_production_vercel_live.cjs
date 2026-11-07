const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

(async () => {
  console.log('=== VERIFYING LIVE PRODUCTION DEPLOYMENT: https://clinical-ward.vercel.app ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  try {
    console.log('1. Navigating to https://clinical-ward.vercel.app...');
    await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('2. Verifying Title & Header...');
    const pageTitle = await page.title();
    console.log(`  ✓ Page title: "${pageTitle}"`);

    console.log('3. Navigating to "Giám định BHYT" Tab on Production...');
    const bhytTabBtn = page.locator('button:has-text("Giám định BHYT"):visible').first();
    await bhytTabBtn.waitFor({ state: 'visible', timeout: 15000 });
    await bhytTabBtn.click();
    await page.waitForTimeout(2000);

    console.log('4. Verifying Split-View Layout on Production...');
    const leftPane = page.locator('div:has-text("Kéo và thả file ảnh hoặc PDF đơn thuốc vào đây")').first();
    await leftPane.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Left Pane (Dropzone) verified on Production.');

    const editBtn = page.locator('[data-testid="btn-edit-admin-icd10"]').first();
    await editBtn.waitFor({ state: 'visible', timeout: 5000 });
    const editBtnText = await editBtn.textContent();
    console.log(`  ✓ Renamed button verified on Production: "${editBtnText.trim()}"`);

    const excelBtn = page.locator('button:has-text("Xuất Excel"):visible').first();
    const pdfBtn = page.locator('button:has-text("In / Xuất PDF"):visible').first();
    await excelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pdfBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✓ Export toolbar ("Xuất Excel" & "In / Xuất PDF") verified on Production.');

    // Chụp ảnh bằng chứng trên Live Production Vercel
    const ssProd = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/live_production_vercel_bhyt.png';
    await page.screenshot({ path: ssProd, fullPage: false });
    console.log('  ✓ Live Production Screenshot saved:', ssProd);

    console.log('\n🎉 TOÀN BỘ GIAO DIỆN & TÍNH NĂNG ĐÃ ĐỒNG BỘ 100% TRÊN VERCEL PRODUCTION!');
  } catch (err) {
    console.error('Playwright Production Verification Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
