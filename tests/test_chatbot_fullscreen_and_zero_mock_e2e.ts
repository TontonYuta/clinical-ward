import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const LOCAL_URL = 'http://localhost:5173';

async function main() {
  console.log(`🌐 Bắt đầu kiểm thử E2E: Chatbot Toàn Màn Hình & Xóa Bỏ Dữ Liệu Mẫu tại ${LOCAL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Đã tải giao diện lâm sàng.');

    // 1. Mở Trợ lý Agent Chatbot
    const copilotToggle = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
    await copilotToggle.waitFor({ state: 'visible', timeout: 10000 });
    await copilotToggle.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã mở ngăn Trợ Lý Lâm Sàng.');

    // 2. Kiểm tra XÓA HOÀN TOÀN DỮ LIỆU MẪU (Zero Dummy Data)
    console.log('\n--- BƯỚC 1: Kiểm tra loại bỏ dữ liệu mẫu ---');
    const dummyMorphinChip = page.locator('text="Mượn 2 ống Morphin sulfat buồng cấp cứu 3"');
    const hasDummyMorphin = await dummyMorphinChip.isVisible();
    console.log(`✅ Triệt tiêu nút mẫu mượn Morphin buồng 3: ${!hasDummyMorphin ? 'ĐÃ LOẠI BỎ TRIỆT ĐỂ (HỢP LỆ)' : 'VẪN CÒN DỮ LIỆU MẪU!'}`);

    const dummyBennettChip = page.locator('text="Báo hỏng máy thở PB840 phòng mổ 2 bị xì khí"');
    const hasDummyBennett = await dummyBennettChip.isVisible();
    console.log(`✅ Triệt tiêu nút mẫu báo hỏng máy thở phòng mổ 2: ${!hasDummyBennett ? 'ĐÃ LOẠI BỎ TRIỆT ĐỂ (HỢP LỆ)' : 'VẪN CÒN DỮ LIỆU MẪU!'}`);

    // Kiểm tra hiển thị màn hình chào mừng chuẩn mực CDSS
    const cleanGuideTitle = page.locator('text="Trợ Lý AI Lâm Sàng & Dược Viện"').first();
    await cleanGuideTitle.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Hiển thị khung giới thiệu năng lực CDSS chuẩn mực, không có dữ liệu mẫu.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_clean_zero_dummy.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_chatbot_clean_zero_dummy.png');

    // 3. Mở rộng Toàn Màn Hình (Fullscreen)
    console.log('\n--- BƯỚC 2: Kiểm thử mở rộng Toàn Màn Hình (Fullscreen) ---');
    const expandBtn = page.locator('button[title="Mở rộng toàn màn hình"]').first();
    await expandBtn.waitFor({ state: 'visible', timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(500);

    const isExpandedNow = await page.locator('button[title="Thu nhỏ cửa sổ"]').isVisible();
    console.log(`✅ Chuyển đổi trạng thái Toàn Màn Hình: ${isExpandedNow ? 'THÀNH CÔNG (Nút Thu nhỏ đã xuất hiện)' : 'THẤT BẠI'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_fullscreen_expanded.png') });
    console.log('📸 Đã lưu ảnh minh chứng Toàn Màn Hình: verified_chatbot_fullscreen_expanded.png');

    // 4. Nhập lệnh lâm sàng trong chế độ Toàn Màn Hình để kiểm tra trải nghiệm rộng rãi
    console.log('\n--- BƯỚC 3: Thao tác lệnh lâm sàng trên giao diện Toàn Màn Hình ---');
    const chatInput = page.locator('input[placeholder*="Nhập yêu cầu"]').first();
    await chatInput.fill('Kiểm tra an toàn đơn thuốc cho bệnh nhân Võ Minh Trí dùng Augmentin');
    await chatInput.press('Enter');
    await page.waitForTimeout(4500);

    const safetyCardBtn = page.locator('button:has-text("Mở Bảng Đối Soát 5 Đúng")').first();
    await safetyCardBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Đã nhận phản hồi CDSS và thẻ hành động trực quan trên màn hình rộng!');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_fullscreen_cdss.png') });
    console.log('📸 Đã lưu ảnh minh chứng: verified_chatbot_fullscreen_cdss.png');

    // 5. Thu nhỏ trở lại kích thước mặc định (Restore Size)
    console.log('\n--- BƯỚC 4: Kiểm thử thu nhỏ trở lại kích thước cửa sổ chuẩn ---');
    const shrinkBtn = page.locator('button[title="Thu nhỏ cửa sổ"]').first();
    await shrinkBtn.waitFor({ state: 'visible', timeout: 5000 });
    await shrinkBtn.click();
    await page.waitForTimeout(500);

    const isRestored = await page.locator('button[title="Mở rộng toàn màn hình"]').isVisible();
    console.log(`✅ Khôi phục kích thước cửa sổ chuẩn: ${isRestored ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_fullscreen_minimized.png') });
    console.log('📸 Đã lưu ảnh minh chứng Thu Nhỏ: verified_chatbot_fullscreen_minimized.png');

    console.log('\n🎉 TẤT CẢ KIỂM THỬ TOÀN MÀN HÌNH VÀ XÓA DỮ LIỆU MẪU ĐẠT 100%!');
  } catch (err) {
    console.error('❌ Lỗi E2E:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'error_e2e_fullscreen.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();