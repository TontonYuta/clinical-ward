import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  if (!await chatInput.isVisible()) {
    const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
    if (await trigger.isVisible()) await trigger.click();
    await chatInput.waitFor({ state: 'visible', timeout: 8000 });
  }

  const query = 'chống chỉ định của Paracetamol';
  console.log(`1. Gửi câu hỏi: "${query}"...`);
  await chatInput.fill(query);
  await page.waitForTimeout(200);

  const sendBtn = page.locator('button[type="submit"]');
  await sendBtn.click();

  console.log('2. Đợi phản hồi stream hoàn tất...');
  await page.waitForTimeout(4500);

  const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
  await lastAgentMsg.waitFor({ state: 'visible', timeout: 10000 });

  const msgText = await lastAgentMsg.innerText();
  console.log('================ NỘI DUNG HIỂN THỊ TRÊN UI ================');
  console.log(msgText);
  console.log('===========================================================');

  // Kiểm tra không còn "Căn cứ y văn:"
  const hasCanCuYVan = await page.locator('text=Căn cứ y văn:').count();
  console.log(`Số lượng khối "Căn cứ y văn:": ${hasCanCuYVan}`);
  if (hasCanCuYVan > 0) {
    throw new Error('❌ Khối "Căn cứ y văn:" vẫn còn tồn tại!');
  }
  console.log('✅ Khối "Căn cứ y văn:" hoàn toàn biến mất khỏi UI!');

  // Kiểm tra không còn trailing "Theo Dược thư Quốc gia..."
  if (msgText.includes('Theo Dược thư Quốc gia Việt Nam')) {
    throw new Error('❌ Dòng thừa "Theo Dược thư Quốc gia..." vẫn còn tồn tại!');
  }
  console.log('✅ Dòng thừa "Theo Dược thư..." đã được loại bỏ hoàn toàn!');

  // Kiểm tra có badge Dược thư ở cuối cụm
  const inlineBadge = lastAgentMsg.locator('button').filter({ hasText: 'Dược thư tr.1118' }).first();
  await inlineBadge.waitFor({ state: 'visible', timeout: 5000 });
  const badgeText = await inlineBadge.innerText();
  console.log(`✅ Badge ở cuối cụm thông tin: "${badgeText.trim()}"`);

  // Bấm vào badge để mở drawer
  console.log('3. Bấm trực tiếp vào badge để kiểm tra mở Drawer chuyên luận...');
  await inlineBadge.click();
  await page.waitForTimeout(1500);

  const drawer = page.locator('[data-testid="in-app-pdf-drawer"]');
  await drawer.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Drawer chuyên luận & PDF gốc đã mở thành công trực tiếp từ badge!');

  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
  const screenshotPath = path.join(artifactDir, 'screen_paracetamol_contraindications_clean_cluster.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Đã lưu ảnh chụp màn hình hoàn chỉnh -> ${screenshotPath}`);

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM THỬ XÁC MINH CỤM THÔNG TIN & LOẠI BỎ "CĂN CỨ Y VĂN" ĐẠT 100% GREEN!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
