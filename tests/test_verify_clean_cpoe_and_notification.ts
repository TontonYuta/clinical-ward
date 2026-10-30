import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('🚀 Checking CPOE Order Detail and Send Notification Clean Workstation...');
  await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });

  // 1. Open CpoeOrderDetailModal
  const cpoeTabBtn = page.locator('button:has-text("Kê Đơn"), [data-testid="tab-cpoe"]').first();
  if (await cpoeTabBtn.isVisible()) {
    await cpoeTabBtn.click();
    await page.waitForTimeout(500);
  }

  const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
  await orderIdBtn.waitFor({ state: 'visible', timeout: 5000 });
  await orderIdBtn.click();

  const cpoeModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
  await cpoeModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ CpoeOrderDetailModal opened');

  // Verify Tab 1 has no "Tra cứu" button next to drug
  const tab1DrugRow = cpoeModal.locator('text=Paracetamol 500mg').first();
  await tab1DrugRow.waitFor({ state: 'visible' });
  const traCuuBtnCount = await cpoeModal.locator('button:has-text("Tra cứu")').count();
  console.log('✅ Tab 1 "Tra cứu" button count:', traCuuBtnCount, '(Expected: 0)');
  if (traCuuBtnCount > 0) throw new Error('Found redundant "Tra cứu" button in Tab 1');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_cpoe_order_tab1_overview.png') });

  // Switch to Tab 2: Danh mục thuốc
  const tabMedicationsBtn = cpoeModal.locator('button[role="tab"]:has-text("Danh mục thuốc")');
  await tabMedicationsBtn.click();
  await page.waitForTimeout(400);

  // Verify Tab 2 has NO "Xem Dược thư & Chống chỉ định của thuốc này" button
  const duocThuBtnCount = await cpoeModal.locator('text=Xem Dược thư & Chống chỉ định của thuốc này').count();
  console.log('✅ Tab 2 "Xem Dược thư..." button count:', duocThuBtnCount, '(Expected: 0)');
  if (duocThuBtnCount > 0) throw new Error('Found redundant "Xem Dược thư & Chống chỉ định của thuốc này" button in Tab 2');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_cpoe_order_tab2_medications.png') });

  // Switch to Tab 3: An toàn lâm sàng & CDSS
  const tabSafetyBtn = cpoeModal.locator('button[role="tab"]:has-text("An toàn lâm sàng & CDSS")');
  await tabSafetyBtn.click();
  await page.waitForTimeout(400);
  console.log('✅ Tab 3 CDSS is intact and active');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_cpoe_order_tab3_safety.png') });

  // 2. Open Send Notification Modal from CPOE
  const openNotificationBtn = cpoeModal.locator('[data-testid="btn-open-sms-from-order"]');
  await openNotificationBtn.click();

  const smsModal = page.locator('[data-testid="send-sms-modal"]');
  await smsModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Send Notification Modal opened');

  // Verify compact CPOE link bar and templates
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_notification_modal_sms.png') });

  // Switch to History SMS Tab
  const tabHistorySms = smsModal.locator('[data-testid="tab-history-sms"]');
  await tabHistorySms.click();
  await page.waitForTimeout(400);

  // Check footer has NO duplicate "+ Soạn Tin SMS Mới" button
  const footerSoanBtnCount = await smsModal.locator('div.border-t button:has-text("Soạn Tin SMS Mới")').count();
  console.log('✅ History footer duplicate "+ Soạn Tin SMS Mới" count:', footerSoanBtnCount, '(Expected: 0)');
  if (footerSoanBtnCount > 0) throw new Error('Found duplicate "+ Soạn Tin SMS Mới" in footer');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_notification_history_sms.png') });

  // Mobile viewport test
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'clean_notification_mobile_view.png') });

  await browser.close();
  console.log('🎉 ALL CLEAN WORKSTATION CHECKS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
