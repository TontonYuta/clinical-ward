import { chromium } from 'playwright';

async function verifyLiveProductionCdss() {
  const prodUrl = 'https://clinical-ward.vercel.app';
  console.log('======================================================');
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TRỰC TIẾP TRÊN PRODUCTION: ${prodUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[PROD BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(prodUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  // Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(1000);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 15000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat nếu có nút làm mới
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }

  // --------------------------------------------------------------------------
  // TEST CASE 1 TRÊN PRODUCTION: Clopidogrel + Omeprazol -> CDSS Alert Banner + 1-Click Button
  // --------------------------------------------------------------------------
  console.log('\n--- LIVE PRODUCTION TEST 1: Tương tác nguy hiểm Clopidogrel + Omeprazol ---');
  let prevCount = await page.locator('[data-testid*="chat-message"]').count();

  const ddiQuery = 'Tương tác giữa Clopidogrel và Omeprazol';
  console.log(`Gửi query lên Production: "${ddiQuery}"`);
  await chatInput.fill(ddiQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 45000 }
  );
  await page.waitForTimeout(3000);

  const alertBanner = page.locator('[data-testid="cdss-alert-banner"]');
  const bannerCount = await alertBanner.count();
  console.log(`Số lượng CDSS Alert Banner trên Production: ${bannerCount}`);
  if (bannerCount === 0) {
    throw new Error('THẤT BẠI TRÊN PROD: Không tìm thấy [data-testid="cdss-alert-banner"]!');
  }
  const bannerText = await alertBanner.first().textContent();
  console.log(`Nội dung CDSS Banner trên Production:\n${bannerText}`);

  const substituteBtn = page.locator('[data-testid="cdss-substitute-btn"]');
  const hasSubBtn = await substituteBtn.isVisible();
  console.log(`Nút 1-Click Substitution xuất hiện trên Production: ${hasSubBtn}`);
  if (!hasSubBtn) {
    throw new Error('THẤT BẠI TRÊN PROD: Không tìm thấy nút 1-click substitute!');
  }
  const subBtnText = await substituteBtn.textContent();
  console.log(`Text nút thay thế: "${subBtnText?.trim()}"`);

  const screenshot1 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/live_production_cdss_alert_verified.png';
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log(`📸 Đã chụp ảnh Production ca 1 lưu tại: ${screenshot1}`);

  // --------------------------------------------------------------------------
  // TEST CASE 2 TRÊN PRODUCTION: Paracetamol 500mg -> Zero False Alarms
  // --------------------------------------------------------------------------
  console.log('\n--- LIVE PRODUCTION TEST 2: Thuốc đơn lẻ Paracetamol 500mg (Zero False Alarms) ---');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }
  prevCount = await page.locator('[data-testid*="chat-message"]').count();

  const singleDrugQuery = 'Paracetamol 500mg';
  console.log(`Gửi query lên Production: "${singleDrugQuery}"`);
  await chatInput.fill(singleDrugQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 45000 }
  );
  await page.waitForTimeout(3000);

  const bannerCountSingle = await page.locator('[data-testid="cdss-alert-banner"]').count();
  console.log(`Số lượng CDSS Alert Banner trên câu hỏi Paracetamol đơn lẻ (Production): ${bannerCountSingle}`);
  if (bannerCountSingle > 0) {
    throw new Error('THẤT BẠI TRÊN PROD: Báo động giả trên Paracetamol đơn lẻ!');
  }
  console.log('✅ Production giao diện sạch sẽ 100%, không xuất hiện banner cảnh báo giả trên thuốc đơn lẻ!');

  const screenshot2 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/live_production_clean_single_drug.png';
  await page.screenshot({ path: screenshot2, fullPage: true });
  console.log(`📸 Đã chụp ảnh Production ca 2 lưu tại: ${screenshot2}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT TRÊN PRODUCTION ĐÃ THÀNH CÔNG 100%!');
  console.log('======================================================');
}

verifyLiveProductionCdss().catch((err) => {
  console.error('LỖI KIỂM THỬ PRODUCTION:', err);
  process.exit(1);
});
