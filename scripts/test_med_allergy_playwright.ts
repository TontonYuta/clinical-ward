import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('/home/tontonyuta/Downloads/DoAn2', 'playwright_mobile');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log('--- BẮT ĐẦU KIỂM THỬ PLAYWRIGHT: KHO THUỐC, CHỈ ĐỊNH & CẢNH BÁO DỊ ỨNG ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // 1. Chuyển sang Phân hệ Kho Dược FEFO từ Sidebar hiển thị
  console.log('1. Chuyển sang Phân hệ Kho Dược FEFO...');
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(800);

  // 2. Bấm vào một loại thuốc trong kho để xem thông tin và cảnh báo dị ứng
  console.log('2. Bấm chọn thuốc trong bảng Kho Dược (Ceftriaxone / Morphin)...');
  const allergyBtn = page.locator('button:has-text("Thông tin thuốc"):visible').first();
  await allergyBtn.click();
  await page.waitForTimeout(600);

  // Chụp ảnh Modal Chỉ định & Dị ứng
  await page.screenshot({ path: path.join(OUT_DIR, '16_fefo_medication_allergy_modal.png') });
  console.log('   Đã chụp ảnh: 16_fefo_medication_allergy_modal.png');

  // Đóng Modal
  await page.locator('button:has-text("Đóng"):visible').first().click();
  await page.waitForTimeout(400);

  // 3. Mở Trợ lý AI và gửi câu hỏi: "Morphin dùng để làm gì"
  console.log('3. Mở cửa sổ Trợ lý AI Copilot...');
  const copilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]:visible').first();
  await copilotBtn.click();
  await page.waitForTimeout(600);

  console.log('   Gửi câu hỏi: "Morphin dùng để làm gì"...');
  const inputArea = page.locator('input[placeholder*="yêu cầu" i]:visible, input[placeholder*="gõ tắt" i]:visible').first();
  await inputArea.fill('Morphin dùng để làm gì');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT_DIR, '17_chatbot_morphin_indication_allergy.png') });
  console.log('   Đã chụp ảnh: 17_chatbot_morphin_indication_allergy.png');

  // 4. Bấm nút hành động trên thẻ "Xem Thông Tin Thuốc Chi Tiết"
  console.log('4. Bấm nút mở Thông Tin Thuốc từ thẻ Chatbot...');
  const cardActionBtn = page.locator('button:has-text("Xem Thông Tin Thuốc Chi Tiết"):visible, button:has-text("Mở Dược Thư"):visible').first();
  if (await cardActionBtn.isVisible()) {
    await cardActionBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '18_card_action_open_modal.png') });
    console.log('   Đã chụp ảnh: 18_card_action_open_modal.png');
  }

  console.log('=== HOÀN TẤT KIỂM THỬ PLAYWRIGHT THÀNH CÔNG ===');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
