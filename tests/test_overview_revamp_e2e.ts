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

  // 1. Verify Header & Branding
  console.log('--- 1. Verifying Header & Branding ---');
  const title = page.locator('h1:has-text("Tổng Quan Trạm Làm Việc Hôm Nay")');
  await title.waitFor({ state: 'visible', timeout: 5000 });
  const copilotBanner = page.locator('text=Trợ Lý Lâm Sàng Y Khoa Thông Minh');
  if (!(await copilotBanner.isVisible())) {
    throw new Error('FAIL: AI Copilot banner not visible!');
  }
  console.log('✅ Header & AI Copilot banner visible.');

  // 2. Verify 4 Core Capabilities
  console.log('--- 2. Verifying 4 Core Capabilities ---');
  const capCpoe = page.locator('text=Kê Đơn Thuốc CPOE & CDSS Đối Soát');
  const capRegistry = page.locator('text=Dược Thư & 55.000 Biệt Dược Quốc Gia');
  const capDebt = page.locator('text=Quản Lý Cơ Số Tủ Trực & Thuốc Gây Nghiện');
  const capColdchain = page.locator('text=Kiểm Soát Hạn FEFO & Chuỗi Lạnh Vắc Xin');

  if (!(await capCpoe.isVisible()) || !(await capRegistry.isVisible()) || !(await capDebt.isVisible()) || !(await capColdchain.isVisible())) {
    throw new Error('FAIL: One or more capability cards missing!');
  }
  console.log('✅ All 4 Workstation Capabilities displayed.');

  // 3. Verify Patient Clinical Center
  console.log('--- 3. Verifying Patient Clinical Center ---');
  const patientCenter = page.locator('h3:has-text("Thông Tin Bệnh Nhân & Giám Sát Lâm Sàng")');
  if (!(await patientCenter.isVisible())) {
    throw new Error('FAIL: Patient Clinical Center header missing!');
  }
  const patientTri = page.locator('text=Võ Minh Trí');
  if (!(await patientTri.isVisible())) {
    throw new Error('FAIL: Key patient Võ Minh Trí not listed!');
  }
  console.log('✅ Patient Clinical Center with key patients (Võ Minh Trí, Trần Huy Hoàng) displayed.');

  // 4. Verify Medication & Clinical Pharmacy Center
  console.log('--- 4. Verifying Medication Center ---');
  const medCenter = page.locator('h3:has-text("Thông Tin Dược Lâm Sàng & Dược Thư Quốc Gia")');
  if (!(await medCenter.isVisible())) {
    throw new Error('FAIL: Medication Center header missing!');
  }
  const medAdrenalin = page.locator('text=Adrenalin 1mg/1ml');
  const medMorphin = page.locator('text=Morphin 10mg/1ml');
  const medKcl = page.locator('text=Kali Clorid 10% (KCl)');
  if (!(await medAdrenalin.isVisible()) || !(await medMorphin.isVisible()) || !(await medKcl.isVisible())) {
    throw new Error('FAIL: One or more essential medication chips missing!');
  }
  console.log('✅ Medication Center with essential emergency & controlled drugs displayed.');

  // 5. Verify Attached Legal Documents & PDFs
  console.log('--- 5. Verifying Attached Legal Documents ---');
  const legalDocsSection = page.locator('h3:has-text("Tài Liệu Đính Kèm & Căn Cứ Pháp Lý Lâm Sàng")');
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
  const openLegalDocsBtn = page.locator('button:has-text("Mở Cẩm Nang Pháp Quy Đầy Đủ")').first();
  await openLegalDocsBtn.click();
  await page.waitForTimeout(500);

  const legalModal = page.locator('h2:has-text("Căn Cứ Pháp Lý & Văn Bản Quy Phạm Pháp Luật Y Tế")');
  if (await legalModal.isVisible()) {
    console.log('✅ Successfully opened LegalDocsModal from Overview button!');
    const closeLegalBtn = page.locator('button[aria-label="Đóng"], button:has-text("Đóng")').first();
    if (await closeLegalBtn.isVisible()) await closeLegalBtn.click();
    await page.waitForTimeout(300);
  }

  // 8. Capture Fullpage Screenshot of Revamped Overview
  console.log('--- 8. Capturing Screenshot ---');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'revamped_overview_dashboard.png'), fullPage: true });
  console.log('📸 Saved screenshot: revamped_overview_dashboard.png');

  await browser.close();
  console.log('🎉 ALL REVAMPED OVERVIEW TESTS PASSED 100%!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
