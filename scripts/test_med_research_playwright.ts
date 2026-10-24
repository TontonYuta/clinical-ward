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

  console.log('--- BẮT ĐẦU DOUBLE CHECK PLAYWRIGHT: TIÊU CHUẨN THÔNG TIN THUỐC BỆNH VIỆN ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // 1. Chuyển sang Kho Dược FEFO
  console.log('1. Mở Kho Dược FEFO...');
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(800);

  // 2. Mở Modal Dược Thư & Cảnh báo Dị ứng từ bảng thuốc
  console.log('2. Bấm nút "Dị ứng & 5 Đúng" trên dòng thuốc...');
  const allergyBtn = page.locator('button:has-text("Dị ứng & 5 Đúng"):visible').first();
  await allergyBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.fixed.inset-0');

  // Chụp Tab 1: Chỉ định ("Dùng để làm gì") & Cảnh báo Dị ứng
  await page.screenshot({ path: path.join(OUT_DIR, '19_med_research_tab_allergy.png') });
  console.log('   Đã chụp ảnh: 19_med_research_tab_allergy.png');

  // 3. Chuyển sang Tab 2: Quy chuẩn 5 Đúng
  console.log('3. Chuyển sang Tab Quy chuẩn 5 Đúng (Đúng BN, thuốc, liều trần 24h, đường dùng, thời gian)...');
  const fiveRightsTab = modal.locator('button:has-text("Quy chuẩn 5 Đúng")').first();
  await fiveRightsTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '20_med_research_tab_five_rights.png') });
  console.log('   Đã chụp ảnh: 20_med_research_tab_five_rights.png');

  // 4. Chuyển sang Tab 3: Dược lý, Giám sát lâm sàng, TDM & Antidote
  console.log('4. Chuyển sang Tab Dược lý & Giải độc (TDM, Lọc máu, Antidote, DDI, Thai kỳ)...');
  const clinicalTab = modal.locator('button:has-text("Dược lý & Giải độc")').first();
  await clinicalTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '21_med_research_tab_clinical_safety_tdm.png') });
  console.log('   Đã chụp ảnh: 21_med_research_tab_clinical_safety_tdm.png');

  // 5. Chọn Ceftriaxone từ thanh chip tra nhanh trong Modal
  console.log('5. Chuyển nhanh sang Ceftriaxone trong thanh chip modal...');
  const ceftriaChip = modal.locator('button:has-text("Ceftriaxone")').first();
  await ceftriaChip.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '22_med_research_ceftriaxone_safety.png') });
  console.log('   Đã chụp ảnh: 22_med_research_ceftriaxone_safety.png');

  // 6. Đóng modal và kiểm tra Chatbot AI
  await modal.locator('button:has-text("Đóng")').first().click();
  await page.waitForTimeout(400);

  console.log('6. Mở Chatbot kiểm tra hỏi đáp lâm sàng chuyên sâu...');
  const copilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]:visible').first();
  await copilotBtn.click();
  await page.waitForTimeout(600);

  const inputArea = page.locator('input[placeholder*="yêu cầu" i]:visible, input[placeholder*="gõ tắt" i]:visible').first();
  await inputArea.fill('Morphin dùng để làm gì và ai dị ứng không được dùng');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT_DIR, '23_chatbot_research_double_check.png') });
  console.log('   Đã chụp ảnh: 23_chatbot_research_double_check.png');

  console.log('=== HOÀN TẤT DOUBLE CHECK PLAYWRIGHT THÀNH CÔNG ===');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
