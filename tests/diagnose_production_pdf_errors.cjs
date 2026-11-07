const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== DIAGNOSING PRODUCTION PDF DISPLAY & UPLOAD ERRORS ===');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push(`[NET FAIL] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}\n${err.stack}`);
  });

  console.log('1. Navigating to https://clinical-ward.vercel.app ...');
  await page.goto('https://clinical-ward.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('2. Opening Giám định BHYT tab...');
  const bhytTab = page.locator('button:has-text("Giám định BHYT"):visible').first();
  await bhytTab.waitFor({ state: 'visible', timeout: 15000 });
  await bhytTab.click();
  await page.waitForTimeout(2000);

  // --- TEST CASE 1: BẤM NGUỒN PDF TỪ TAB DANH MỤC HOẶC VI PHẠM ---
  console.log('3. Testing "Nguồn PDF" click...');
  const catalogSubtab = page.locator('button:has-text("Danh mục TT 20/2022")').first();
  if (await catalogSubtab.isVisible()) {
    await catalogSubtab.click();
    await page.waitForTimeout(1000);

    const pdfPageBtn = page.locator('button:has-text("Trang ")').first();
    console.log('Found PDF page button:', await pdfPageBtn.isVisible());
    if (await pdfPageBtn.isVisible()) {
      const popupPromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(e => null);
      await pdfPageBtn.click();
      const newPage = await popupPromise;
      if (newPage) {
        console.log('Opened new page URL:', newPage.url());
        await newPage.waitForTimeout(3000);
        console.log('New page title:', await newPage.title());
        const ssNewPage = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/prod_new_tab_pdf.png';
        await newPage.screenshot({ path: ssNewPage });
        console.log('Saved new page screenshot:', ssNewPage);
      } else {
        console.log('WARNING: No popup window was opened when clicking Trang button!');
      }
    }
  }

  // --- TEST CASE 2: THỬ UPLOAD TỆP PDF ---
  console.log('4. Testing Upload PDF...');
  // Chuyển lại tab tổng quan hoặc phân tách để thấy dropzone
  const overviewSubtab = page.locator('button:has-text("Bảng phân tách"), button:has-text("Đơn thuốc mẫu")').first();
  if (await overviewSubtab.isVisible()) {
    await overviewSubtab.click();
    await page.waitForTimeout(1000);
  }

  // Tạo một file PDF test mẫu nhỏ
  const testPdfPath = '/tmp/test_prescription.pdf';
  // Copy từ một file pdf thực tế trong repo
  const samplePdfs = [
    '/home/tontonyuta/Downloads/DoAn2/public/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf',
    '/home/tontonyuta/Downloads/DoAn2/dist/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf'
  ];
  let foundSamplePdf = samplePdfs.find(p => fs.existsSync(p));
  if (foundSamplePdf) {
    console.log('Using sample PDF:', foundSamplePdf);
    const fileInput = page.locator('input[type="file"]').first();
    console.log('File input found:', await fileInput.count());
    if (await fileInput.count() > 0) {
      console.log('Uploading PDF to input...');
      await fileInput.setInputFiles(foundSamplePdf);
      await page.waitForTimeout(3000);

      const ssAfterUpload = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/prod_after_pdf_upload.png';
      await page.screenshot({ path: ssAfterUpload });
      console.log('Saved after-upload screenshot:', ssAfterUpload);

      // Check iframe in left column
      const iframe = page.locator('iframe[title="PDF Đơn Thuốc"]').first();
      console.log('PDF Iframe present:', await iframe.isVisible().catch(() => false));
      if (await iframe.isVisible().catch(() => false)) {
        const iframeSrc = await iframe.getAttribute('src');
        console.log('Iframe src:', iframeSrc);
      }

      // Check OCR processing or error
      const bodyText = await page.locator('body').innerText();
      console.log('Contains error:', bodyText.includes('Lỗi') || bodyText.includes('thất bại'));
    }
  }

  console.log('\n--- BROWSER CONSOLE LOGS ---');
  console.log(consoleLogs.join('\n') || 'None');

  console.log('\n--- NETWORK FAILED REQUESTS ---');
  console.log(failedRequests.join('\n') || 'None');

  await browser.close();
})();
