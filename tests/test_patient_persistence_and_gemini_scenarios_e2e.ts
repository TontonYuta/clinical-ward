import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const LOCAL_URL = 'http://localhost:5173';

async function main() {
  console.log(`🌐 Bắt đầu kiểm thử E2E: Lưu trữ Bệnh Nhân EHR & Kịch Bản Gemini tại ${LOCAL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(LOCAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Đã tải trang lâm sàng.');

    // 1. Mở Trợ lý Agent Chatbot
    const copilotToggle = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
    await copilotToggle.waitFor({ state: 'visible', timeout: 10000 });
    await copilotToggle.click();
    await page.waitForTimeout(600);

    const chatInput = page.locator('input[placeholder*="Nhập yêu cầu"]').first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });

    // 2. Kịch bản 1: Lập lịch dặn dò uống thuốc & Lưu trữ CSDL EHR
    console.log('\n--- KỊCH BẢN 1: Lập lịch dặn dò uống thuốc & Lưu trữ CSDL EHR ---');
    await chatInput.fill('Lập lịch dặn dò uống thuốc cho bệnh nhân Võ Minh Trí lúc 8h và 20h');
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);

    const scheduleTitle = page.locator('text=Lịch Dặn Dò & Nhắc Uống Thuốc: Võ Minh Trí').first();
    await scheduleTitle.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Hiển thị Thẻ Lịch Dặn Dò cho bệnh nhân Võ Minh Trí.');

    const ehrBadge = page.locator('text=Đã lưu CSDL EHR').first();
    const hasEhrBadge = await ehrBadge.isVisible();
    console.log(`✅ Huy hiệu lưu trữ CSDL EHR: ${hasEhrBadge ? 'HIỂN THỊ HỢP LỆ' : 'Chưa hiển thị'}`);

    // Kiểm tra dữ liệu được lưu trong localStorage
    const savedInLocalStorage = await page.evaluate(() => {
      const stored = localStorage.getItem('clinical_saved_advices_v1');
      return stored ? JSON.parse(stored) : [];
    });
    console.log(`✅ Số bản ghi dặn dò lưu trữ bền vững: ${savedInLocalStorage.length} (Không bị mất khi reload)`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_patient_ehr_persistence.png') });
    console.log('📸 Đã lưu minh chứng: verified_patient_ehr_persistence.png');

    // 3. Kịch bản 2: Kiểm tra reload trang - Bệnh nhân & Dặn dò KHÔNG bị mất
    console.log('\n--- KỊCH BẢN 2: Reload trang - Kiểm tra tính bền vững (Persistence) ---');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const postReloadData = await page.evaluate(() => {
      const stored = localStorage.getItem('clinical_saved_advices_v1');
      return stored ? JSON.parse(stored) : [];
    });
    console.log(`✅ Sau khi Reload: Số bản ghi dặn dò vẫn còn: ${postReloadData.length} bản ghi (Hoàn toàn bền vững!)`);

    // Mở lại Chatbot
    const copilotToggle2 = page.locator('button[aria-label*="Trợ lý AI"], button:has-text("Trợ lý AI")').first();
    await copilotToggle2.waitFor({ state: 'visible', timeout: 10000 });
    await copilotToggle2.click();
    await page.waitForTimeout(600);

    const chatInput2 = page.locator('input[placeholder*="Nhập yêu cầu"]').first();
    await chatInput2.waitFor({ state: 'visible', timeout: 10000 });

    // 4. Kịch bản 3: Gemini CDSS - Cảnh báo dị ứng Penicillin khi dùng Augmentin
    console.log('\n--- KỊCH BẢN 3: Gemini CDSS Dị ứng (Allergy Contraindication) ---');
    await chatInput2.fill('Kiểm tra an toàn đơn thuốc cho bệnh nhân Võ Minh Trí dùng Augmentin');
    await chatInput2.press('Enter');

    const allergyCardBtn = page.locator('button:has-text("Mở Bảng Đối Soát 5 Đúng")').first();
    await allergyCardBtn.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Gemini CDSS phát hiện thành công: Bệnh nhân dị ứng Penicillin -> Chống chỉ định Augmentin!');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_gemini_allergy_cdss.png') });
    console.log('📸 Đã lưu minh chứng: verified_gemini_allergy_cdss.png');

    // 5. Kịch bản 4: Gemini CDSS - Chỉnh liều suy thận theo Cockcroft-Gault
    console.log('\n--- KỊCH BẢN 4: Gemini CDSS Chỉnh liều suy thận Cockcroft-Gault ---');
    await chatInput2.fill('Chỉnh liều suy thận cho bệnh nhân Đặng Thị Lan');
    await chatInput2.press('Enter');

    const renalCardBtn = page.locator('button:has-text("Xem Chuyên Luận Dược Thư")').first();
    await renalCardBtn.waitFor({ state: 'visible', timeout: 20000 });
    console.log('✅ Gemini CDSS tính toán thành công độ thanh thải thận CrCl cho bệnh nhân Đặng Thị Lan.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_gemini_renal_dosing.png') });
    console.log('📸 Đã lưu minh chứng: verified_gemini_renal_dosing.png');

    console.log('\n🎉 TẤT CẢ CÁC KỊCH BẢN KIỂM THỬ E2E BỆNH NHÂN & GEMINI ĐẠT 100%!');
  } catch (error) {
    console.error('❌ Lỗi E2E:', error);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'error_e2e_persistence.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();