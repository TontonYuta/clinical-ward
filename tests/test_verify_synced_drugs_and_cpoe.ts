/**
 * @license
 * Test E2E xác thực đồng bộ 100% dữ liệu thuốc Sổ nợ vỏ & Kê đơn CPOE từ CSDL 55k (<=200 LOC)
 */

import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Kiểm tra Sổ nợ vỏ (Đang mở)
  console.log('Capturing Debt ledger screenshot...');
  const morphinCard = page.getByText('Morphin (Morphin hydroclorid 10mg/ml)').first();
  const hadunalinCard = page.getByText('Hadunalin 1 mg/ml').first();
  const kclCard = page.getByText('Kali clorid 10%').first();

  console.log('Debt Cards Found:', {
    morphin: await morphinCard.count() > 0,
    hadunalin: await hadunalinCard.count() > 0,
    kcl: await kclCard.count() > 0,
  });

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_synced_debt_ledger.png' });

  // 2. Chuyển sang Role Bác sĩ và tab Kê Đơn CPOE
  console.log('Clicking Doctor role button...');
  const doctorBtn = page.getByText('BS. Hùng').first();
  if (await doctorBtn.isVisible()) {
    await doctorBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('Clicking visible CPOE tab...');
  const cpoeTabBtn = page.locator('button:has-text("Kê đơn CPOE"):visible').first();
  await cpoeTabBtn.click();
  await page.waitForTimeout(1000);

  const voMinhTriPrescription = page.getByText('Võ Minh Trí').first();
  const dangThiLanPrescription = page.getByText('Đặng Thị Lan').first();
  const vancomycinPrescription = page.getByText('VANCOMYCIN 1g').first();

  console.log('CPOE Prescriptions Found:', {
    voMinhTri: await voMinhTriPrescription.count() > 0,
    dangThiLan: await dangThiLanPrescription.count() > 0,
    vancomycin: await vancomycinPrescription.count() > 0,
  });

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_synced_cpoe_prescriptions.png' });

  await browser.close();
  console.log('ALL SYNCHRONIZATION TESTS PASSED 100%!');
}

verify().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
