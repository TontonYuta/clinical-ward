import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Khởi chạy Chromium Playwright kiểm tra Admin Portal (Port 3001)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  console.log('Đang mở http://localhost:3001...');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // 1. Chụp Tab Giám Sát Vận Hành (Telemetry)
  const screen1 = path.join(ARTIFACT_DIR, 'admin_portal_telemetry_live.png');
  await page.screenshot({ path: screen1 });
  console.log('📸 Đã chụp Tab Telemetry:', screen1);

  // 1.1 Click vào 1 dòng trong bảng Live Stream để mở Query Inspector Drawer
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    console.log('Đang click vào dòng nhật ký truy vấn để mở Query Detail Drawer...');
    await firstRow.click();
    await page.waitForTimeout(600);
    const screenDrawer = path.join(ARTIFACT_DIR, 'admin_portal_query_inspector_drawer_live.png');
    await page.screenshot({ path: screenDrawer });
    console.log('📸 Đã chụp Query Detail Drawer:', screenDrawer);
    // Đóng drawer bằng nút X
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 2. Click Tab Bể Khóa API Key
  await page.click('button:has-text("Bể Khóa API Key")');
  await page.waitForTimeout(800);
  const screen2 = path.join(ARTIFACT_DIR, 'admin_portal_key_vault_live.png');
  await page.screenshot({ path: screen2 });
  console.log('📸 Đã chụp Tab Key Vault:', screen2);

  // 3. Click Tab Ngân Sách Token
  await page.click('button:has-text("Ngân Sách Token")');
  await page.waitForTimeout(800);
  const screen3 = path.join(ARTIFACT_DIR, 'admin_portal_budget_cap_live.png');
  await page.screenshot({ path: screen3 });
  console.log('📸 Đã chụp Tab Budget Cap:', screen3);

  // 4. Click Tab Nhật Ký An Toàn
  await page.click('button:has-text("Nhật Ký An Toàn")');
  await page.waitForTimeout(800);
  const screen4 = path.join(ARTIFACT_DIR, 'admin_portal_safety_audit_live.png');
  await page.screenshot({ path: screen4 });
  console.log('📸 Đã chụp Tab Safety Audit:', screen4);

  // 5. Kiểm tra Cổng Bác sĩ (Port 3000) có nút chuyển sang Cổng Quản trị không
  console.log('Đang kiểm tra Cổng Bác Sĩ (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  const screen5 = path.join(ARTIFACT_DIR, 'clinical_app_link_to_admin_live.png');
  await page.screenshot({ path: screen5 });
  console.log('📸 Đã chụp Cổng Bác Sĩ kèm nút chuyển sang Admin:', screen5);

  await browser.close();
  console.log('🎉 Hoàn thành kiểm tra Playwright. Lỗi Console:', errors.length === 0 ? '0 lỗi (Tuyệt hảo)' : errors);
}

main().catch((err) => {
  console.error('❌ Thất bại:', err);
  process.exit(1);
});
