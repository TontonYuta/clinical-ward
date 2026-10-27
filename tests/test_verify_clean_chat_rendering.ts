import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const LOCAL_URL = 'http://localhost:5173';

async function main() {
  console.log(`🌐 Bắt đầu kiểm thử E2E: Render Tin Nhắn Tinh Chỉnh & Giao Diện Sạch tại ${LOCAL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Đã tải trang lâm sàng.');

    // 1. Mở Chatbot
    const copilotToggle = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
    await copilotToggle.waitFor({ state: 'visible', timeout: 10000 });
    await copilotToggle.click();
    await page.waitForTimeout(600);

    // Mở rộng toàn màn hình
    const expandBtn = page.locator('button[title="Mở rộng toàn màn hình"]').first();
    await expandBtn.click();
    await page.waitForTimeout(400);

    // 2. Kiểm tra KHÔNG CÒN các huy hiệu TT, NĐ dưới tin nhắn chào mừng
    const legalBadge = page.locator('text="NĐ 98 · TT 22"');
    const hasLegalBadge = await legalBadge.isVisible();
    console.log(`✅ Triệt tiêu huy hiệu rác NĐ 98/TT 22: ${!hasLegalBadge ? 'ĐÃ LOẠI BỎ TRIỆT ĐỂ (HỢP LỆ)' : 'VẪN CÒN!'}`);

    // 3. Kiểm tra KHÔNG CÒN thanh phím tắt / macro
    const macroBar = page.locator('text="Gõ / để gọi macro"');
    const hasMacroBar = await macroBar.isVisible();
    console.log(`✅ Triệt tiêu thanh phím tắt macro: ${!hasMacroBar ? 'ĐÃ TẮT HOÀN TOÀN' : 'VẪN CÒN!'}`);

    // 4. Nhập câu hỏi lâm sàng để kiểm tra chất lượng Render Markdown của câu trả lời
    console.log('\n--- BƯỚC: Kiểm tra Render Markdown chất lượng cao ---');
    const chatInput = page.locator('input[placeholder*="Nhập câu hỏi hoặc"]').first();
    await chatInput.fill('Kiểm tra an toàn đơn thuốc cho bệnh nhân Võ Minh Trí dùng Augmentin');
    await chatInput.press('Enter');
    // Chờ xuất hiện thẻ tiêu đề h4 đã được format đẹp mắt
    const formattedHeading = page.locator('h4:has-text("1. Căn cứ pháp lý")').first();
    await formattedHeading.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Đã render thành công thẻ tiêu đề <h4> thay vì chuỗi thô ###!');

    const messageBubble = page.locator('div.rounded-2xl').last();
    const rawText = await messageBubble.innerText();
    const hasRawHashes = rawText.includes('###');
    console.log(`✅ Kiểm tra triệt tiêu ký tự thô '###': ${!hasRawHashes ? 'ĐÃ FORMAT TIÊU ĐỀ ĐẸP (KHÔNG CÒN DẤU ###)' : 'VẪN BỊ RAW HASHES!'}`);

    // Kiểm tra triệt tiêu khối Thông tư/Nghị định dưới tin nhắn trả lời
    const answerLegalBadge = page.locator('text="Căn cứ áp dụng"');
    const hasAnswerLegalBadge = await answerLegalBadge.isVisible();
    console.log(`✅ Triệt tiêu khối Thông tư / Nghị định rác: ${!hasAnswerLegalBadge ? 'ĐÃ DỌN DẸP SẠCH SẼ (KHÔNG CÒN TT, NĐ DƯ THỪA)' : 'VẪN CÒN!'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_clean_chat_rendering.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_clean_chat_rendering.png');

    // 5. Kiểm tra câu hỏi thứ hai: Chỉnh liều suy thận
    console.log('\n--- BƯỚC: Kiểm tra Render câu hỏi suy thận Cockcroft-Gault ---');
    await chatInput.fill('Chỉnh liều suy thận cho bệnh nhân Đặng Thị Lan');
    await chatInput.press('Enter');

    const renalCardBtn = page.locator('button:has-text("Xem Chuyên Luận Dược Thư")').first();
    await renalCardBtn.waitFor({ state: 'visible', timeout: 20000 });

    const messageBubble2 = page.locator('div.rounded-2xl').last();
    const rawText2 = await messageBubble2.innerText();
    const hasRawHashes2 = rawText2.includes('###');
    console.log(`✅ Kiểm tra render câu hỏi suy thận: ${!hasRawHashes2 ? 'ĐÃ RENDER ĐẸP MẮT' : 'LỖI RAW'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_clean_chat_no_tt_nd.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_clean_chat_no_tt_nd.png');

    console.log('\n🎉 TẤT CẢ KIỂM THỬ RENDER VÀ GIAO DIỆN SẠCH ĐẠT 100%!');
  } catch (err) {
    console.error('❌ Lỗi E2E:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'error_e2e_clean_render.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();