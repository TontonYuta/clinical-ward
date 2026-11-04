import { chromium } from 'playwright';

async function runCdssSentinelPlaywrightTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU TEST PLAYWRIGHT CDSS ALERT SENTINEL TẠI: ${targetUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

  // Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(1000);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat nếu có nút làm mới
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }

  // --------------------------------------------------------------------------
  // TEST CASE 1: TƯƠNG TÁC NGUY HIỂM (Clopidogrel + Omeprazol) -> BẮT BUỘC CÓ BANNER VÀ NÚT 1-CLICK THAY THẾ
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 1: Tương tác nguy hiểm Clopidogrel + Omeprazol ---');
  let prevCount = await page.locator('[data-testid*="chat-message"]').count();

  const ddiQuery = 'Tương tác giữa Clopidogrel và Omeprazol';
  console.log(`Gửi query: "${ddiQuery}"`);
  await chatInput.fill(ddiQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500);

  // Kiểm tra sự xuất hiện của CdssAlertBanner
  const alertBanner = page.locator('[data-testid="cdss-alert-banner"]');
  const bannerCount = await alertBanner.count();
  console.log(`Số lượng CDSS Alert Banner tìm thấy: ${bannerCount}`);
  if (bannerCount === 0) {
    throw new Error('THẤT BẠI: Không tìm thấy [data-testid="cdss-alert-banner"] cho tương tác nguy hiểm!');
  }
  const bannerText = await alertBanner.first().textContent();
  console.log(`Nội dung CDSS Banner:\n${bannerText}`);

  // Kiểm tra nút thay thế 1-click
  const substituteBtn = page.locator('[data-testid="cdss-substitute-btn"]');
  const hasSubBtn = await substituteBtn.isVisible();
  console.log(`Nút thay thế 1-Click xuất hiện: ${hasSubBtn}`);
  if (!hasSubBtn) {
    throw new Error('THẤT BẠI: Không tìm thấy nút 1-click substitute [data-testid="cdss-substitute-btn"]!');
  }
  const subBtnText = await substituteBtn.textContent();
  console.log(`Nút thay thế: "${subBtnText?.trim()}"`);
  if (!subBtnText?.includes('Pantoprazol 40mg')) {
    throw new Error(`THẤT BẠI: Nút thay thế không chứa "Pantoprazol 40mg", thực tế: ${subBtnText}`);
  }

  // Chụp ảnh bằng chứng ca 1
  const screenshot1 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/cdss_sentinel_alert_verified.png';
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình ca 1 lưu tại: ${screenshot1}`);

  // --------------------------------------------------------------------------
  // TEST CASE 2: THUỐC ĐƠN LẺ (Paracetamol 500mg) -> TUYỆT ĐỐI KHÔNG CÓ CẢNH BÁO CDSS (TRÁNH BÁO ĐỘNG GIẢ)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 2: Thuốc đơn lẻ Paracetamol 500mg (Zero False Alarms) ---');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }
  prevCount = await page.locator('[data-testid*="chat-message"]').count();

  const singleDrugQuery = 'Paracetamol 500mg';
  console.log(`Gửi query: "${singleDrugQuery}"`);
  await chatInput.fill(singleDrugQuery);
  await sendBtn.click();

  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500);

  const bannerCountSingle = await page.locator('[data-testid="cdss-alert-banner"]').count();
  console.log(`Số lượng CDSS Alert Banner trên câu hỏi Paracetamol đơn lẻ: ${bannerCountSingle}`);
  if (bannerCountSingle > 0) {
    throw new Error('THẤT BẠI: Phát hiện báo động giả! Paracetamol đơn lẻ không được hiển thị CDSS Alert Banner.');
  }
  console.log('✅ Giao diện sạch sẽ 100%, không xuất hiện banner cảnh báo giả trên thuốc đơn lẻ!');

  // Chụp ảnh bằng chứng ca 2
  const screenshot2 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/cdss_sentinel_clean_single_drug.png';
  await page.screenshot({ path: screenshot2, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình ca 2 lưu tại: ${screenshot2}`);

  // --------------------------------------------------------------------------
  // TEST CASE 3: BẤM NÚT 1-CLICK THAY THẾ (Pantoprazol 40mg)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 3: Thực thi 1-Click Substitution Engine ---');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }
  prevCount = await page.locator('[data-testid*="chat-message"]').count();

  await chatInput.fill(ddiQuery);
  await sendBtn.click();
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2000);

  const subBtnToClick = page.locator('[data-testid="cdss-substitute-btn"]').first();
  await subBtnToClick.waitFor({ state: 'visible', timeout: 5000 });
  const prevCountBeforeClick = await page.locator('[data-testid*="chat-message"]').count();

  console.log('Bấm nút "⚡ Đổi sang Pantoprazol 40mg (1-Click)"...');
  await subBtnToClick.click();

  // Đợi câu trả lời tiếp theo từ trợ lý AI
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count + 1,
    prevCountBeforeClick,
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500);

  const finalMessages = page.locator('[data-testid*="chat-message"]');
  const finalCount = await finalMessages.count();
  const latestReply = await finalMessages.nth(finalCount - 1).textContent();
  console.log(`Phản hồi sau khi đổi thuốc (300 ký tự đầu):\n${latestReply?.slice(0, 300)}...`);

  // Chụp ảnh bằng chứng ca 3
  const screenshot3 = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/cdss_sentinel_1click_substituted.png';
  await page.screenshot({ path: screenshot3, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình ca 3 lưu tại: ${screenshot3}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 KIỂM THỬ PLAYWRIGHT CDSS ALERT SENTINEL THÀNH CÔNG 100%!');
  console.log('======================================================');
}

runCdssSentinelPlaywrightTest().catch((err) => {
  console.error('LỖI TEST PLAYWRIGHT CDSS SENTINEL:', err);
  process.exit(1);
});
