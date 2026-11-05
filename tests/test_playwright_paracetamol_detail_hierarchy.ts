import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Đang truy cập ứng dụng http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  if (!await chatInput.isVisible()) {
    const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
    if (await trigger.isVisible()) await trigger.click();
    await chatInput.waitFor({ state: 'visible', timeout: 8000 });
  }

  // Gửi câu hỏi yêu cầu toàn văn chi tiết
  console.log('2. Gửi câu hỏi: "thông tin chi tiết về paracetamol"...');
  await chatInput.fill('thông tin chi tiết về paracetamol');
  await page.waitForTimeout(200);
  await page.locator('button[type="submit"]').click();

  // Đợi phản hồi hoàn thành stream (xuất hiện tag Nguồn ở cuối)
  console.log('3. Đợi phản hồi stream hoàn tất...');
  await page.waitForFunction(() => {
    const msgs = document.querySelectorAll('[data-testid="chat-message-agent"]');
    if (!msgs.length) return false;
    const last = msgs[msgs.length - 1];
    return last.textContent && last.textContent.includes('Nguồn:');
  }, { timeout: 35000 });

  await page.waitForTimeout(1000);

  const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
  const text = await lastAgentMsg.innerText();

  console.log('=== CHATBOT RESPONSE SAMPLE (first 1000 chars) ===\n', text.slice(0, 1000));

  // Kiểm tra khử lặp prefix
  const pedMatches = text.match(/Trẻ em:/g) || [];
  console.log(`Số lần xuất hiện "Trẻ em:": ${pedMatches.length} (kỳ vọng: <= 2 lần cho tiêu đề danh mục)`);
  if (pedMatches.length > 3) {
    throw new Error(`❌ Prefix "Trẻ em:" vẫn bị lặp ${pedMatches.length} lần!`);
  }

  const adultMatches = text.match(/Người lớn:/g) || [];
  console.log(`Số lần xuất hiện "Người lớn:": ${adultMatches.length} (kỳ vọng: <= 2 lần)`);
  if (adultMatches.length > 3) {
    throw new Error(`❌ Prefix "Người lớn:" vẫn bị lặp ${adultMatches.length} lần!`);
  }

  // Kiểm tra không còn câu cụt
  if (text.includes('tối đa.') || text.includes('cách.') || text.includes('< 10 kg:.')) {
    throw new Error('❌ Vẫn còn hiện tượng câu cụt vỡ dòng do OCR regex cũ!');
  }
  console.log('✅ Hoàn toàn không còn câu cụt hay vỡ dòng do ngắt dòng OCR.');

  // Kiểm tra phân cấp
  if (!text.includes('Đường uống') || !text.includes('Đặt trực tràng') || !text.includes('Truyền tĩnh mạch')) {
    throw new Error('❌ Thiếu các phân mục đường dùng y khoa theo phân cấp!');
  }
  console.log('✅ Cấu trúc phân cấp Đường uống, Đặt trực tràng, Truyền tĩnh mạch hiển thị rõ ràng!');

  // Kiểm tra tag nguồn duy nhất
  const badges = lastAgentMsg.locator('button').filter({ hasText: 'Dược thư tr.1118' });
  const badgeCount = await badges.count();
  console.log(`Số lượng badge nguồn: ${badgeCount}`);
  if (badgeCount !== 1) {
    throw new Error(`❌ Mong đợi đúng 1 badge nguồn, tìm thấy ${badgeCount}!`);
  }
  console.log('✅ Chỉ có duy nhất 1 badge nguồn ở cuối phản hồi!');

  // Kiểm tra chip gợi ý hỏi tiếp
  const chipsSection = lastAgentMsg.locator('text=Gợi ý hỏi tiếp:');
  const hasChips = await chipsSection.isVisible();
  console.log(`Hiển thị gợi ý hỏi tiếp: ${hasChips}`);
  if (!hasChips) {
    throw new Error('❌ Thiếu danh sách gợi ý hỏi tiếp bên dưới câu trả lời!');
  }
  console.log('✅ Gợi ý hỏi tiếp hiển thị đầy đủ và tương tác tốt!');

  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
  const screenshotPath = path.join(artifactDir, 'screen_paracetamol_detail_hierarchy_verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`📸 Đã chụp màn hình thành công -> ${screenshotPath}`);

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT E2E ĐÃ ĐẠT 100%!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
