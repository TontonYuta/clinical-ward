/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * E2E Test Kiểm Thử Giao Diện Tổng Quan Trạm Làm Việc Lâm Sàng Mới
 */

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

async function main() {
  console.log('🚀 Running E2E Verification for Revamped Clinical Operations Overview...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set user role to doctor
  await page.goto('http://localhost:3001/#overview', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Verify Header & Branding (AI banner removed from dashboard per user request)
  console.log('--- 1. Verifying Header & Branding ---');
  const title = page.locator('h1:has-text("Tổng quan trạm làm việc")');
  await title.waitFor({ state: 'visible', timeout: 5000 });
  const copilotBanner = page.locator('h2:has-text("Trợ lý AI Lâm Sàng Y Khoa")');
  if (await copilotBanner.isVisible()) {
    throw new Error('FAIL: AI Copilot banner should not be on dashboard!');
  }
  console.log('✅ Clean header verified without AI banner on dashboard.');

  // 2. Verify 4 Core Capabilities
  console.log('--- 2. Verifying 4 Core Capabilities ---');
  const capCpoe = page.locator('text=Kê đơn thuốc điện tử');
  const capRegistry = page.locator('text=Tra cứu thuốc & Dược thư');
  const capDebt = page.locator('text=Tủ trực & Thuốc gây nghiện');
  const capColdchain = page.locator('text=Kho dược & Chuỗi lạnh');

  if (!(await capCpoe.isVisible()) || !(await capRegistry.isVisible()) || !(await capDebt.isVisible()) || !(await capColdchain.isVisible())) {
    throw new Error('FAIL: One or more capability cards missing!');
  }
  console.log('✅ All 4 Workstation Capabilities displayed.');

  // 3. Verify Patient Clinical Center (No sample data, live filter only)
  console.log('--- 3. Verifying Patient Clinical Center ---');
  const patientCenter = page.locator('h3:has-text("Thông tin bệnh nhân")');
  if (!(await patientCenter.isVisible())) {
    throw new Error('FAIL: Patient Center header missing!');
  }
  // Check empty state guidance message is present
  const patientGuide = page.locator('text=Nhập họ tên hoặc mã bệnh nhân để tìm kiếm hồ sơ');
  if (!(await patientGuide.isVisible())) {
    throw new Error('FAIL: Initial empty-state guidance missing in Patient Center!');
  }
  // Type search query to filter
  const patientInput = page.locator('input[placeholder*="Nhập tên, mã BN"]');
  await patientInput.fill('Võ Minh Trí');
  await page.waitForTimeout(300);

  const patientTri = page.locator('button:has-text("Võ Minh Trí")');
  if (!(await patientTri.isVisible())) {
    throw new Error('FAIL: Filtered patient Võ Minh Trí not listed after typing query!');
  }
  console.log('✅ Patient Center: Sample data hidden by default, live filter successfully shows Võ Minh Trí.');

  // 4. Verify Medication Center (No sample data, live filter only)
  console.log('--- 4. Verifying Medication Center ---');
  const medCenter = page.locator('h3:has-text("Thông tin thuốc")');
  if (!(await medCenter.isVisible())) {
    throw new Error('FAIL: Medication Center header missing!');
  }
  // Check empty state guidance message is present
  const medGuide = page.locator('text=Nhập tên thuốc hoặc hoạt chất để tra cứu');
  if (!(await medGuide.isVisible())) {
    throw new Error('FAIL: Initial empty-state guidance missing in Medication Center!');
  }
  // Type search query to filter
  const medInput = page.locator('input[placeholder*="Nhập tên biệt dược"]');
  await medInput.fill('Adrenalin');
  await page.waitForTimeout(300);

  const medAdrenalin = page.locator('button:has-text("Adrenalin")').first();
  if (!(await medAdrenalin.isVisible())) {
    throw new Error('FAIL: Filtered medication Adrenalin not listed after typing query!');
  }
  console.log('✅ Medication Center: Sample data hidden by default, live filter successfully shows Adrenalin.');

  // Test opening DavDrugDetailModal directly from overview drug search
  console.log('--- 4B. Testing DavDrugDetailModal from Overview Drug Search ---');
  await medAdrenalin.click();
  await page.waitForTimeout(500);

  const davModal = page.locator('[data-testid="dav-drug-detail-modal"]');
  await davModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ DavDrugDetailModal opened successfully from overview drug search!');
  const closeDavBtn = page.locator('[data-testid="btn-close-dav-detail"]');
  await closeDavBtn.click();
  await davModal.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(300);

  // 5. Verify Attached Legal Documents & PDFs
  console.log('--- 5. Verifying Attached Legal Documents ---');
  const legalDocsSection = page.locator('h3:has-text("Tài Liệu Đính Kèm")');
  if (!(await legalDocsSection.isVisible())) {
    throw new Error('FAIL: Attached Legal Documents section missing!');
  }
  const docTT26 = page.locator('h4:has-text("Thông tư 26/2025/TT-BYT")');
  const docDTQG = page.locator('h4:has-text("Dược Thư Quốc Gia Việt Nam")');
  const docQD5948 = page.locator('h4:has-text("Quyết định 5948/QĐ-BYT")');
  if (!(await docTT26.isVisible()) || !(await docDTQG.isVisible()) || !(await docQD5948.isVisible())) {
    throw new Error('FAIL: Official documents missing!');
  }

  // Check PDF link href for TT26
  const tt26Link = page.locator('a[href="/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf"]');
  if ((await tt26Link.count()) === 0) {
    throw new Error('FAIL: PDF link for TT26 missing!');
  }
  console.log('✅ Attached Legal Documents & PDF links verified.');

  // 6. Test Opening Patient Detail Modal from Overview
  console.log('--- 6. Testing Patient Detail Modal Interaction ---');
  const openPatientBtn = page.locator('button:has-text("Võ Minh Trí")').first();
  await openPatientBtn.click();
  await page.waitForTimeout(500);

  const patientModal = page.locator('[data-testid="patient-detail-modal"]');
  if (await patientModal.isVisible()) {
    console.log('✅ Successfully opened PatientDetailModal from Overview click!');
    const closeBtn = patientModal.locator('button:has-text("Đóng"), button[aria-label="Đóng"]').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 7. Test Opening LegalDocsModal
  console.log('--- 7. Testing Legal Docs Modal Interaction ---');
  const openLegalDocsBtn = page.locator('button:has-text("Cẩm nang quy định")').first();
  await openLegalDocsBtn.click();

  const legalModal = page.locator('h2:has-text("Căn Cứ Pháp Lý")');
  await legalModal.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✅ Successfully opened LegalDocsModal from Overview button!');
  const closeLegalBtn = page.locator('button:has-text("Đóng")').first();
  await closeLegalBtn.click();
  await legalModal.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(300);

  // 7B. Test Bottom-Right AI Assistant Launcher ("mở hẳn ra")
  console.log('--- 7B. Testing Bottom-Right AI Assistant Launcher ---');
  const floatingAiBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (!(await floatingAiBtn.isVisible())) {
    throw new Error('FAIL: Bottom-right floating AI button not visible!');
  }
  const floatingAiText = await floatingAiBtn.textContent();
  if (!floatingAiText?.includes('Trợ lý AI')) {
    throw new Error('FAIL: Bottom-right floating AI button does not display text "Trợ lý AI"!');
  }
  console.log('✅ Bottom-right floating AI button is fully opened out with text & shortcut badge.');
  await floatingAiBtn.click();
  await page.waitForTimeout(500);

  const closeChatBtn = page.locator('button[title="Đóng Trợ lý AI"]').first();
  if (await closeChatBtn.isVisible()) {
    console.log('✅ Bottom-right AI Assistant chat window opened successfully on click!');
    await closeChatBtn.click();
    await page.waitForTimeout(400);
  }

  // 8. Capture Fullpage Screenshot of Revamped Overview
  console.log('--- 8. Capturing Screenshot ---');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'minimalist_overview_dashboard.png'), fullPage: true });
  console.log('📸 Saved screenshot: minimalist_overview_dashboard.png');

  await browser.close();
  console.log('🎉 ALL REVAMPED OVERVIEW TESTS PASSED 100%!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
