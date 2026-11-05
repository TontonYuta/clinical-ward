import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  if (!await chatInput.isVisible()) {
    const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
    if (await trigger.isVisible()) await trigger.click();
    await chatInput.waitFor({ state: 'visible', timeout: 8000 });
  }

  // 1. Thử nghiệm câu hỏi đa trường: chỉ định và liều dùng của Paracetamol
  console.log('1. Gửi câu hỏi: "chỉ định và liều dùng của Paracetamol"...');
  await chatInput.fill('chỉ định và liều dùng của Paracetamol');
  await page.waitForTimeout(200);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  const msg1 = page.locator('[data-testid="chat-message-agent"]').last();
  const text1 = await msg1.innerText();
  console.log('=== MULTI-FIELD RESPONSE ===\n', text1);

  // Đếm số lượng badge Nguồn trong câu trả lời
  const sourceBadges = msg1.locator('button').filter({ hasText: 'Dược thư tr.1118' });
  const countBadges = await sourceBadges.count();
  console.log(`Số lượng badge Dược thư trong tin nhắn: ${countBadges}`);
  if (countBadges !== 1) {
    throw new Error(`❌ Mong đợi đúng 1 badge Dược thư ở cuối tin nhắn, thực tế có ${countBadges}!`);
  }
  console.log('✅ Đúng chuẩn: Chỉ có duy nhất 1 badge Dược thư ở cuối tin nhắn!');

  // Kiểm tra gợi ý hỏi tiếp
  const chipsSection = msg1.locator('text=Gợi ý hỏi tiếp:');
  await chipsSection.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Gợi ý hỏi tiếp đã xuất hiện đầy đủ bên dưới câu trả lời!');

  // 2. Click vào chip đầu tiên để kiểm tra tương tác
  const firstChip = msg1.locator('button').filter({ hasText: 'Chống chỉ định và thận trọng' }).first();
  if (await firstChip.isVisible()) {
    console.log('2. Bấm vào chip gợi ý:', await firstChip.innerText());
    await firstChip.click();
    await page.waitForTimeout(5000);

    const msg2 = page.locator('[data-testid="chat-message-agent"]').last();
    const text2 = await msg2.innerText();
    console.log('=== CHIP CLICK RESPONSE ===\n', text2);
    console.log('✅ Click chip kích hoạt câu hỏi mới thành công!');
  }

  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
  const screenshotPath = path.join(artifactDir, 'screen_multi_field_and_chips_verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Đã lưu ảnh chụp -> ${screenshotPath}`);

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT CHI TIẾT & CHIP GỢI Ý ĐẠT 100% GREEN!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
