import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('/home/tontonyuta/Downloads/DoAn2', 'playwright_mobile');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('--- CHỤP ẢNH GIAO DIỆN TỐI GIẢN CLEAN UI ---');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(1000);

  // 1. Tab Sổ nợ vỏ thuốc
  await page.screenshot({ path: path.join(OUT_DIR, '24_clean_dashboard_debt.png') });
  console.log('   Đã chụp: 24_clean_dashboard_debt.png');

  // 2. Tab Kho dược FEFO
  const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible').first();
  await fefoBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '25_clean_dashboard_fefo.png') });
  console.log('   Đã chụp: 25_clean_dashboard_fefo.png');

  // 3. Tab Kê đơn CPOE (chuyển sang role Bác sĩ)
  const roleSelect = page.locator('select').first();
  await roleSelect.selectOption('doctor');
  await page.waitForTimeout(600);
  const cpoeBtn = page.locator('button:has-text("Kê đơn CPOE"):visible').first();
  await cpoeBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '26_clean_cpoe_tab.png') });
  console.log('   Đã chụp: 26_clean_cpoe_tab.png');

  await browser.close();
  console.log('=== HOÀN TẤT CHỤP ẢNH CLEAN UI ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
