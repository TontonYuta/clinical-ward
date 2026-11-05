import { chromium } from 'playwright';

async function verifyLiveProduction() {
  const prodUrl = 'https://clinical-ward.vercel.app';
  const artifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/live_production_auto_open_cpoe_modal_hide_chat.png';
  const reOpenArtifactPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/live_production_reopen_chat_history_preserved.png';

  console.log('======================================================');
  console.log(`KIỂM THỬ PLAYWRIGHT TRÊN LIVE PRODUCTION: ${prodUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[PROD BROWSER ERROR] ${msg.text()}`);
  });

  // Đợi Vercel hoàn tất build và deploy (tối đa 90s)
  let deployed = false;
  for (let attempt = 1; attempt <= 12; attempt++) {
    console.log(`Kiểm tra phiên bản Live Production (Lần ${attempt}/12)...`);
    try {
      await page.goto(prodUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(2000);

      // Mở Chatbot
      const copilotAside = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
      const toggleBtn = page.locator('[data-testid="copilot-toggle-btn"]');

      if (!await copilotAside.isVisible().catch(() => false)) {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(600);
        if (!await copilotAside.isVisible().catch(() => false) && await toggleBtn.isVisible().catch(() => false)) {
          await toggleBtn.click({ force: true });
          await page.waitForTimeout(600);
        }
      }

      const chatInput = page.locator('[data-testid="chat-input-field"]');
      if (await chatInput.isVisible().catch(() => false)) {
        deployed = true;
        console.log('✅ Live production đã sẵn sàng và hiển thị giao diện mới nhất.');
        break;
      }
    } catch (e) {
      console.log(`Đang đợi deployment sẵn sàng... (${(e as Error).message})`);
    }
    await page.waitForTimeout(6000);
  }

  if (!deployed) {
    throw new Error('THẤT BẠI: Không thể kết nối tới Live Production sau 12 lần thử.');
  }

  const copilotAside = page.locator('aside[aria-label="Trợ lý AI Lâm Sàng"]');
  const toggleBtn = page.locator('[data-testid="copilot-toggle-btn"]');
  const chatInput = page.locator('[data-testid="chat-input-field"]');

  // Gửi lệnh "mở form kê đơn"
  const commandText = 'mở form kê đơn';
  console.log(`Gửi lệnh kiểm thử trên Live Production: "${commandText}"`);
  await chatInput.fill(commandText);
  await page.waitForTimeout(300);

  const sendBtn = page.locator('button[type="submit"]');
  await sendBtn.click();
  console.log('Đã gửi lệnh, đang xác thực Chatbot ẩn và Form CPOE hiện...');

  // Xác nhận Chatbot đã biến mất/ẩn đi
  await page.waitForTimeout(600);
  const isChatVisible = await copilotAside.isVisible().catch(() => false);
  console.log(`Trạng thái Chatbot trên Live Production: ${isChatVisible ? 'VẪN MỞ (LỖI)' : 'ĐÃ ẨN HOÀN TOÀN (ĐẠT ✅)'}`);
  if (isChatVisible) {
    throw new Error('THẤT BẠI: Chatbot không ẩn trên Live Production khi mở form kê đơn!');
  }

  // Xác nhận Form kê đơn CPOE (CpoeOrderModal) đã hiện lên ngay lập tức
  const cpoeModal = page.locator('[data-testid="cpoe-order-modal"]');
  await cpoeModal.waitFor({ state: 'visible', timeout: 10000 });
  const isModalVisible = await cpoeModal.isVisible();
  console.log(`Trạng thái Form Kê Đơn CPOE trên Live Production: ${isModalVisible ? 'ĐÃ HIỆN LÊN TRỰC TIẾP (ĐẠT ✅)' : 'KHÔNG HIỆN (LỖI)'}`);
  if (!isModalVisible) {
    throw new Error('THẤT BẠI: Form kê đơn CPOE không hiện lên trên Live Production!');
  }

  const modalHeader = await cpoeModal.locator('h3').first().innerText();
  console.log(`Tiêu đề Form kê đơn trên Live: "${modalHeader}"`);

  // Chụp ảnh bằng chứng Form Kê Đơn
  await page.screenshot({ path: artifactPath, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình Form Kê Đơn Live Production: ${artifactPath}`);

  // Đóng form kê đơn và mở lại Chatbot
  console.log('Đóng form kê đơn và mở lại Chatbot để kiểm tra lịch sử tin nhắn...');
  const closeBtn = cpoeModal.locator('button:has-text("Đóng"), button[title="Đóng"], button:has-text("Hủy")').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(600);
  if (!await copilotAside.isVisible().catch(() => false)) {
    if (await toggleBtn.isVisible().catch(() => false)) {
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
  }

  const messagesCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số lượng tin nhắn trong phiên hội thoại trên Live: ${messagesCount}`);
  if (messagesCount < 2) {
    throw new Error('THẤT BẠI: Lịch sử tin nhắn không được bảo toàn trên Live Production!');
  }
  console.log('✅ Lịch sử tin nhắn trên Live Production được bảo toàn đầy đủ.');

  // Chụp ảnh bằng chứng Chatbot
  await page.screenshot({ path: reOpenArtifactPath, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình Re-open Chat Live Production: ${reOpenArtifactPath}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT TRÊN LIVE PRODUCTION ĐẠT 100% GREEN!');
  console.log('======================================================');
}

verifyLiveProduction().catch(err => {
  console.error('LỖI KIỂM THỬ LIVE PRODUCTION:', err);
  process.exit(1);
});
