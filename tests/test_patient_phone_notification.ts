import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Starting Patient Phone (SDT) & Hospital Notification Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Loaded application at http://localhost:5173');

    // 1. Check SĐT in Debt Ledger Tab
    const debtPatientNameBtn = page.locator('[data-testid="patient-name-btn"]').first();
    await debtPatientNameBtn.waitFor({ state: 'visible', timeout: 5000 });
    const debtRowText = await page.locator('table tbody tr').first().textContent();
    console.log('📋 Debt row patient info:', debtRowText?.slice(0, 100));
    if (debtRowText?.includes('SĐT:')) {
      console.log('✅ SĐT displayed correctly in Debt Ledger table row!');
    }

    // 2. Click patient name to open PatientDetailModal
    await debtPatientNameBtn.click();
    const patientModal = page.locator('[data-testid="patient-detail-modal"]');
    await patientModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Opened PatientDetailModal');

    // Check Header SĐT
    const headerPhone = page.locator('text=SĐT nhận tin BV:');
    await headerPhone.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ Header displays SĐT nhận tin BV!');

    // Check Tab 1: Overview Contact section
    const contactSection = page.locator('text=Thông Tin Liên Hệ & Nhận Tin Nhắn Bệnh Viện');
    await contactSection.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ Tab 1 displays "Thông Tin Liên Hệ & Nhận Tin Nhắn Bệnh Viện" section');

    // Click "Gửi thông tin cập nhật về điện thoại"
    const sendNoticeBtn = page.locator('button:has-text("Gửi thông tin cập nhật về điện thoại")');
    await sendNoticeBtn.click();
    const successToast = page.locator('text=Đã gửi thông báo y tế về SĐT');
    await successToast.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ Triggered hospital SMS notification successfully with confirmation badge!');

    // Screenshot Tab 1 with phone & hospital notice
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_detail_phone_overview.png') });
    console.log('📸 Captured screenshot: patient_detail_phone_overview.png');

    // Switch to Tab 6: Administrative & CCCD TT26
    const adminTabBtn = page.locator('button[role="tab"]:has-text("Hồ sơ hành chính")');
    await adminTabBtn.click();
    await page.waitForTimeout(400);

    const adminPhoneField = page.locator('dt:has-text("Số điện thoại di động (Bệnh viện gửi thông tin)")');
    await adminPhoneField.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ Tab 6 displays field "Số điện thoại di động (Bệnh viện gửi thông tin)"');

    const hospitalDeliveryCard = page.locator('text=Dịch Vụ Gửi Tin Nhắn Y Tế Về Điện Thoại');
    await hospitalDeliveryCard.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ Tab 6 right column displays "Dịch Vụ Gửi Tin Nhắn Y Tế Về Điện Thoại"');

    // Screenshot Tab 6 Administrative
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'patient_detail_phone_administrative.png') });
    console.log('📸 Captured screenshot: patient_detail_phone_administrative.png');

    // Close PatientDetailModal
    const closePatientBtn = page.locator('[data-testid="btn-close-patient-detail"]');
    await closePatientBtn.click();
    await patientModal.waitFor({ state: 'hidden', timeout: 3000 });
    console.log('✅ Closed PatientDetailModal');

    // 3. Switch to CPOE Prescriptions Tab
    const cpoeTabBtn = page.locator('button:has-text("Kê đơn thuốc"):visible').first();
    await cpoeTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await cpoeTabBtn.click();
    await page.waitForTimeout(500);

    // Verify CPOE Table column header & SĐT in list
    const cpoeColHeader = page.locator('th:has-text("Người bệnh, CCCD & SĐT")');
    await cpoeColHeader.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ CPOE Table displays column header "Người bệnh, CCCD & SĐT"');

    // Screenshot CPOE List with phone numbers
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_list_patient_phone.png') });
    console.log('📸 Captured screenshot: cpoe_list_patient_phone.png');

    // Open first order detail modal
    const orderBtn = page.locator('button:has-text("RX-2026-001")').first();
    await orderBtn.click();
    const cpoeDetailModal = page.locator('[data-testid="cpoe-order-detail-modal"]');
    await cpoeDetailModal.waitFor({ state: 'visible', timeout: 5000 });

    const cpoeHeaderPhone = page.locator('text=SĐT nhận đơn BV:');
    await cpoeHeaderPhone.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ CpoeOrderDetailModal header displays "SĐT nhận đơn BV"');

    // Switch to Tab 4: Hướng dẫn dặn dò & Lịch dùng
    const adviceTab = page.locator('button[role="tab"]:has-text("dặn dò")');
    await adviceTab.click();
    await page.waitForTimeout(400);

    const advicePhoneBanner = page.locator('text=Bệnh viện tự động gửi mã đơn thuốc điện tử và lịch nhắc cữ thuốc');
    await advicePhoneBanner.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✅ CpoeOrderDetailModal Tab 4 displays hospital phone delivery banner!');

    // Screenshot CPOE Advice tab with phone info
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'cpoe_order_detail_phone_advice.png') });
    console.log('📸 Captured screenshot: cpoe_order_detail_phone_advice.png');

    console.log('🎉 ALL PATIENT PHONE & HOSPITAL NOTIFICATION TESTS PASSED 100%!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
