import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- 1. Navigating to http://localhost:3001/#cpoe ---');
  await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  await page.waitForTimeout(800);

  console.log('--- 2. Verifying CPOE Table Columns & Patient Column Width ---');
  const table = page.locator('table').first();
  await table.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Found desktop table!');

  const headers = await page.locator('table thead th').allTextContents();
  console.log('Table Headers:', headers);
  if (headers.includes('Thao tác')) {
    throw new Error('FAIL: Column "Thao tác" still present!');
  }
  console.log('SUCCESS: Column "Thao tác" is completely removed.');

  const colWidths = await page.locator('table colgroup col').evaluateAll((cols) =>
    cols.map((c) => ({
      width: (c as HTMLElement).style.width,
      className: c.className,
    }))
  );
  console.log('Colgroup Specs:', colWidths);

  const orderIdCol = colWidths[1];
  if (orderIdCol.width !== '230px') {
    throw new Error(`FAIL: Order ID column width expected 230px, got: ${orderIdCol.width}`);
  }
  console.log('SUCCESS: Order ID and Timestamp column widened to 230px.');

  const patientCol = colWidths[2];
  if (patientCol.width !== '190px') {
    throw new Error(`FAIL: Patient column width expected 190px, got: ${patientCol.width}`);
  }
  console.log('SUCCESS: Patient column is narrowed to 190px.');

  console.log('--- 3. Opening Prescription Detail Modal ---');
  const firstOrderBtn = page.locator('table [data-testid="cpoe-order-id-btn"]').first();
  await firstOrderBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('[data-testid="cpoe-order-detail-modal"]');
  if (!(await modal.isVisible())) {
    throw new Error('FAIL: Prescription detail modal did not open!');
  }
  console.log('SUCCESS: Modal is open.');

  console.log('--- 4. Verifying Print Portal Attached to Document Body ---');
  const portalDoc = page.locator('body > #prescription-print-portal #prescription-print-document');
  const docCount = await portalDoc.count();
  if (docCount === 0) {
    throw new Error('FAIL: Prescription print document not found in body portal!');
  }

  const docText = await portalDoc.first().innerText();
  console.log('Prescription Print Document Excerpt:\n', docText.slice(0, 300));
  if (!docText.includes('ĐƠN THUỐC') || !docText.includes('Thuốc điều trị:')) {
    throw new Error('FAIL: Print document missing header or medicines!');
  }
  console.log('SUCCESS: Print document contains full prescription data.');

  console.log('--- 5. Emulating Print Media & Verifying Root Hidden & Portal Visible ---');
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);

  const rootVisible = await page.locator('#root').evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  const printDocVisible = await page.locator('#prescription-print-document').evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.clientHeight > 0;
  });

  console.log('In Print Media -> #root visible?', rootVisible, '| #prescription-print-document visible?', printDocVisible);
  if (rootVisible) {
    throw new Error('FAIL: #root should be hidden during print!');
  }
  if (!printDocVisible) {
    throw new Error('FAIL: #prescription-print-document should be visible during print!');
  }
  console.log('SUCCESS: Under print media, #root is hidden and #prescription-print-document is fully visible (NO BLANK PAGE)!');

  // Take screenshot under print emulation
  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/prescription_print_preview.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved print preview screenshot to:', screenshotPath);

  // Return to screen media
  await page.emulateMedia({ media: 'screen' });

  // Take screenshot of CPOE table
  const tableScreenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/cpoe_table_narrowed_patient.png';
  // close modal
  const closeBtn = page.getByRole('button', { name: 'Đóng' }).first();
  await closeBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: tableScreenshotPath });
  console.log('Saved table screenshot to:', tableScreenshotPath);

  await browser.close();
  console.log('🎉 ALL PRINT & TABLE VERIFICATIONS PASSED 100%!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
