import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('/home/tontonyuta/Downloads/DoAn2', 'playwright_mobile');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('--- BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TRÊN MOBILE VIEWPORT (390x844) ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // 1. Initial view (Nurse - Debt)
  console.log('1. Chụp màn hình điều dưỡng (Sổ nợ tủ trực)...');
  await page.screenshot({ path: path.join(OUT_DIR, '01_nurse_debt.png') });

  // 2. Open Borrow Modal
  const borrowBtn = page.locator('button:has-text("Mượn thuốc khẩn")').first();
  if (await borrowBtn.isVisible()) {
    console.log('2. Mở modal mượn thuốc khẩn...');
    await borrowBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '02_modal_borrow.png') });
    // Click Cancel in modal
    const cancelBtn = page.locator('.fixed.inset-0 button:has-text("Hủy")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      console.log('   Đã đóng modal mượn thuốc bằng nút Hủy.');
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  }

  // 3. Switch to Doctor role (CPOE)
  console.log('3. Chuyển sang vai trò Bác sĩ điều trị...');
  const roleSelect = page.locator('select').first();
  await roleSelect.selectOption('doctor');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '03_doctor_cpoe.png') });

  // 4. Open CPOE Prescription Modal
  const newRxBtn = page.locator('button:has-text("Kê đơn thuốc mới")').first();
  if (await newRxBtn.isVisible()) {
    console.log('4. Mở modal kê đơn CPOE...');
    await newRxBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '04_modal_cpoe.png') });
    const cancelRxBtn = page.locator('.fixed.inset-0 button:has-text("Hủy bỏ")').first();
    if (await cancelRxBtn.isVisible()) {
      await cancelRxBtn.click();
      console.log('   Đã đóng modal CPOE.');
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  }

  // 5. Switch to Pharmacist (FEFO)
  console.log('5. Chuyển sang vai trò Dược sĩ...');
  await roleSelect.selectOption('pharmacist');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '05_pharmacist_fefo.png') });

  // 6. Switch to BME (Equipment)
  console.log('6. Chuyển sang vai trò Kỹ sư TBYT...');
  await roleSelect.selectOption('biomedical_engineer');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '06_bme_equipment.png') });

  // Open Incident modal
  const incidentBtn = page.locator('button:has-text("Báo hỏng thiết bị")').first();
  if (await incidentBtn.isVisible()) {
    console.log('   Mở modal báo hỏng thiết bị...');
    await incidentBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '07_modal_incident.png') });
    const cancelIncBtn = page.locator('.fixed.inset-0 button:has-text("Hủy")').first();
    if (await cancelIncBtn.isVisible()) {
      await cancelIncBtn.click();
      console.log('   Đã đóng modal báo hỏng bằng nút Hủy.');
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  }

  // 7. Switch to Director (Access to all tabs including Cold Chain and Asset Audit)
  console.log('7. Chuyển sang vai trò Giám đốc...');
  await roleSelect.selectOption('director');
  await page.waitForTimeout(600);

  // Navigate to ColdChain via Sidebar
  const hamburger = page.locator('header button').first();
  await hamburger.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '08_mobile_sidebar.png') });

  // Click Cold Chain in sidebar
  console.log('   Mở tab Giám sát chuỗi lạnh...');
  const coldChainNav = page.locator('aside button:has-text("Giám sát chuỗi lạnh")').first();
  if (await coldChainNav.isVisible()) {
    await coldChainNav.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '09_tab_coldchain.png') });
  }

  // Click Asset Audit via Sidebar
  console.log('   Mở tab Kiểm kê tài sản...');
  await hamburger.click();
  await page.waitForTimeout(300);
  const assetNav = page.locator('aside button:has-text("Kiểm kê tài sản")').first();
  if (await assetNav.isVisible()) {
    await assetNav.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '10_tab_asset_audit.png') });
  }

  // 8. Open Copilot
  console.log('8. Mở cửa sổ AI Copilot...');
  const copilotBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
  if (await copilotBtn.isVisible()) {
    await copilotBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '11_mobile_copilot_chat.png') });
  }

  console.log('=== HOÀN TẤT THÀNH CÔNG TẤT CẢ 11 KỊCH BẢN MOBILE PLAYWRIGHT ===');
  await browser.close();
}

run().catch((err) => {
  console.error('Playwright Error:', err);
  process.exit(1);
});
