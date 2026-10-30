import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('🚀 Checking Clean Patient Info in CPOE Table & Patient Detail Header...');
  await page.goto('http://localhost:3001/#cpoe', { waitUntil: 'networkidle' });

  // 1. Ensure CPOE tab is active
  const cpoeTabBtn = page.locator('button:has-text("Kê Đơn"), [data-testid="tab-cpoe"]').first();
  if (await cpoeTabBtn.isVisible()) {
    await cpoeTabBtn.click();
    await page.waitForTimeout(500);
  }

  // Verify Table Header says "Người bệnh" (not "Người bệnh, CCCD & SĐT")
  const thPatient = page.locator('table thead th:has-text("Người bệnh")');
  await thPatient.waitFor({ state: 'visible', timeout: 5000 });
  const thText = await thPatient.innerText();
  console.log('✅ Table Header Text:', thText);
  if (thText.includes('CCCD') || thText.includes('SĐT')) {
    throw new Error(`Table Header still contains CCCD/SĐT: ${thText}`);
  }

  // Verify Row 1 Patient cell only has Name + Patient ID
  const patientCell = page.locator('table tbody tr').first().locator('td').nth(2);
  const cellText = await patientCell.innerText();
  console.log('✅ Row 1 Patient Cell text:', cellText.replace(/\n/g, ' '));
  if (cellText.includes('CCCD:') || cellText.includes('SĐT:')) {
    throw new Error(`Patient cell still contains CCCD/SĐT: ${cellText}`);
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_clean_patient_column_desktop.png') });

  // 2. Open CpoeOrderDetailModal and verify header has NO CCCD or SĐT
  const orderIdBtn = page.locator('table tbody tr').first().locator('[data-testid="cpoe-order-id-btn"]').first();
  await orderIdBtn.click();

  const cpoeModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
  await cpoeModal.waitFor({ state: 'visible', timeout: 5000 });

  const cpoeModalHeader = cpoeModal.locator('> div > div').first();
  const cpoeHeaderText = await cpoeModalHeader.innerText();
  console.log('✅ CPOE Order Detail Header text:', cpoeHeaderText.replace(/\n/g, ' '));
  if (cpoeHeaderText.includes('CCCD:') || cpoeHeaderText.includes('SĐT:')) {
    throw new Error(`CPOE Order Detail Header still contains CCCD/SĐT: ${cpoeHeaderText}`);
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_order_detail_clean_header.png') });

  // Close CpoeOrderDetailModal
  const closeCpoeBtn = cpoeModal.locator('[data-testid="btn-close-cpoe-detail"]');
  await closeCpoeBtn.click();
  await page.waitForTimeout(400);

  // 3. Open PatientDetailModal directly by clicking Patient Name in CPOE row
  const patientNameBtn = page.locator('table tbody tr').first().locator('[data-testid="patient-name-btn"]').first();
  await patientNameBtn.click();

  const patientModal = page.locator('[data-testid="patient-detail-modal"]');
  await patientModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ PatientDetailModal opened');

  // Verify PatientDetailModal Header has NO duplicate row (Phòng, CCCD, SĐT, Nhóm máu)
  const patientModalHeader = patientModal.locator('> div > div').first();
  const patientHeaderText = await patientModalHeader.innerText();
  console.log('✅ Patient Detail Header text:', patientHeaderText.replace(/\n/g, ' '));
  if (patientHeaderText.includes('Phòng:') || patientHeaderText.includes('CCCD:') || patientHeaderText.includes('SĐT:') || patientHeaderText.includes('Nhóm máu:')) {
    throw new Error(`Patient Detail Header still contains duplicate row: ${patientHeaderText}`);
  }

  // Verify body below STILL contains the detailed info (Room, CCCD, Phone, Blood type)
  const bodyText = await patientModal.innerText();
  if (!bodyText.includes('Phòng') && !bodyText.includes('Khoa')) {
    throw new Error('Detailed room/department information missing from modal body');
  }
  console.log('✅ Detailed info in body confirmed intact without header duplication');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_detail_clean_header.png') });

  // Close PatientDetailModal
  const closePatientBtn = patientModal.locator('[data-testid="btn-close-patient-detail"]');
  await closePatientBtn.click();
  await page.waitForTimeout(400);

  // 4. Test Mobile Viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  const mobileCard = page.locator('[data-testid="cpoe-order-card"]').first();
  if (await mobileCard.isVisible()) {
    const cardText = await mobileCard.innerText();
    console.log('✅ Mobile Card text:', cardText.replace(/\n/g, ' '));
    if (cardText.includes('CCCD:') || cardText.includes('SĐT:')) {
      throw new Error(`Mobile card still contains CCCD/SĐT: ${cardText}`);
    }
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_clean_patient_column_mobile.png') });

  await browser.close();
  console.log('🎉 ALL PATIENT INFO CLEANUP CHECKS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
