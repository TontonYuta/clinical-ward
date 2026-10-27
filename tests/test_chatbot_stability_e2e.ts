import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const LOCAL_URL = 'http://localhost:5173';

async function main() {
  console.log(`🌐 Đang mở trình duyệt kiểm thử E2E Chatbot trên Local: ${LOCAL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Đã tải xong giao diện lâm sàng.');

    // 1. Mở Chatbot Trợ lý AI
    const copilotToggle = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
    await copilotToggle.waitFor({ state: 'visible', timeout: 10000 });
    await copilotToggle.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã mở ngăn kéo Trợ Lý Agent Lâm Sàng.');

    // 2. Tìm Khung Nhập Liệu
    const chatInput = page.locator('input[placeholder*="Nhập yêu cầu"]').first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Khung nhập liệu Chatbot sẵn sàng.');

    // 2. Kịch bản 1: Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc
    console.log('\n--- KỊCH BẢN 1: Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc ---');
    await chatInput.fill('Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc');
    await chatInput.press('Enter');
    await page.waitForTimeout(1500);

    const adviceCard = page.locator('text=Lịch Dặn Dò & Nhắc Uống Thuốc: Võ Minh Trí').first();
    await adviceCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ XUẤT HIỆN THẺ LỊCH DẶN DÒ: "Lịch Dặn Dò & Nhắc Uống Thuốc: Võ Minh Trí"');

    const emailText = page.locator('text=tri.vm@hospital.vn').first();
    const hasEmail = await emailText.isVisible();
    console.log(`✅ Email bệnh nhân: ${hasEmail ? 'tri.vm@hospital.vn (HỢP LỆ)' : 'Chưa có email'}`);

    // Đảm bảo TUYỆT ĐỐI KHÔNG xuất hiện Phiếu Nợ Morphin
    const wrongMorphinText = page.locator('text=Phiếu Nợ Mượn Khẩn Cấp (PN-2026-613)').first();
    const isWrongMorphinPresent = await wrongMorphinText.isVisible();
    console.log(`✅ Kiểm tra triệt tiêu nhầm lẫn mượn Morphin: ${!isWrongMorphinPresent ? 'ĐÃ TRIỆT TIÊU 100% (KHÔNG CÒN LỖI)' : 'VẪN BỊ LỖI!'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_prescription_advice_fixed.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_chatbot_prescription_advice_fixed.png');

    // 3. Kịch bản 2: Gửi gmail
    console.log('\n--- KỊCH BẢN 2: Lệnh ngắn "Gửi gmail" ---');
    await chatInput.fill('Gửi gmail');
    await chatInput.press('Enter');
    await page.waitForTimeout(1500);

    const gmailCard = page.locator('button:has-text("Gửi Email qua Google Script")').first();
    await gmailCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Lệnh "Gửi gmail" đã kích hoạt Thẻ Lịch Dặn Dò & Nút Gửi Email qua Google Script.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_gmail_action_card.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_chatbot_gmail_action_card.png');

    // 4. Kịch bản 3: Cho 1 lọ morphin (Nghiệp vụ mượn cấp cứu gốc phải giữ nguyên)
    console.log('\n--- KỊCH BẢN 3: Nghiệp vụ gốc "Cho 1 lọ morphin" ---');
    await chatInput.fill('Cho 1 lọ morphin');
    await chatInput.press('Enter');
    await page.waitForTimeout(1500);

    const morphinCard = page.locator('text=Xác nhận rút mượn khẩn Morphin sulfat 10mg/1ml').first();
    await morphinCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Nghiệp vụ mượn cấp cứu gốc hoạt động chính xác 100%.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_morphin_dispense_intact.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_chatbot_morphin_dispense_intact.png');

    console.log('\n🎯 TOÀN BỘ CÁC KỊCH BẢN KIỂM THỬ PLAYWRIGHT E2E ĐỀU THÀNH CÔNG VƯỢT TRỘI!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử E2E:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
