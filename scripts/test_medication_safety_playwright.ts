import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('/home/tontonyuta/Downloads/DoAn2', 'playwright_mobile');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('--- KIỂM THỬ PLAYWRIGHT: DƯỢC THƯ LÂM SÀNG & QUY CHUẨN 5 ĐÚNG ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // 1. Open Sidebar on mobile
  const hamburger = page.locator('header button').first();
  await hamburger.click();
  await page.waitForTimeout(400);

  // 2. Click "Dược thư & 5 Đúng" in Sidebar
  console.log('1. Nhấn nút "Dược thư & 5 Đúng" từ menu quản trị...');
  const safetyNavBtn = page.locator('aside button:has-text("Dược thư & 5 Đúng")').first();
  await safetyNavBtn.click();
  await page.waitForTimeout(500);

  // Take screenshot of 5 Rights tab
  await page.screenshot({ path: path.join(OUT_DIR, '12_med_safety_five_rights.png') });
  console.log('   Đã chụp màn hình Quy chuẩn 5 Đúng.');

  // 3. Switch to "Giám sát Lâm sàng, ADR & Antidote" tab
  console.log('2. Chuyển sang Tab "Giám sát Lâm sàng & Antidote"...');
  const clinicalTabBtn = page.locator('button:has-text("2. Giám sát Lâm sàng")').first();
  await clinicalTabBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '13_med_safety_clinical_antidote.png') });
  console.log('   Đã chụp màn hình Giám sát Lâm sàng & Antidote.');

  // 4. Switch to Adrenalin via shortcut chip
  console.log('3. Chọn nhanh thuốc Adrenalin 1mg...');
  const adreChip = page.locator('button:has-text("Adrenalin 1mg")').first();
  await adreChip.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '14_med_safety_adrenalin.png') });

  // 5. Close modal
  await page.locator('button:has-text("Đóng")').first().click();
  await page.waitForTimeout(300);

  // 6. Test Chatbot 5 Rights inquiry
  console.log('4. Thử nghiệm hỏi Chatbot về 5 Đúng Morphin...');
  const copilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  await copilotBtn.click();
  await page.waitForTimeout(500);

  const inputArea = page.locator('input[placeholder*="Yêu cầu"]').first();
  await inputArea.fill('quy tắc 5 đúng morphin');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '15_chatbot_5_rights_card.png') });
  console.log('   Đã chụp màn hình Chatbot phản hồi Thẻ Quy chuẩn 5 Đúng.');

  console.log('=== HOÀN TẤT KIỂM THỬ DƯỢC THƯ & QUY CHUẨN 5 ĐÚNG THÀNH CÔNG ===');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
