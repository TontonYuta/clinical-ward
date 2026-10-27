import { chromium } from 'playwright';

async function testPharmacy() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Chuyển sang Tab Kho Dược Bệnh Viện
  const pharmacyTabs = page.locator('aside button:has-text("Kho dược")');
  for (let i = 0; i < await pharmacyTabs.count(); i++) {
    if (await pharmacyTabs.nth(i).isVisible()) {
      await pharmacyTabs.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(800);

  // Verify Header: Kho Dược Bệnh Viện (case-insensitive due to CSS uppercase)
  const bodyTextPharmacy = (await page.locator('body').innerText()).toLowerCase();
  const hasPharmacyTitle = bodyTextPharmacy.includes('kho dược bệnh viện');
  console.log('✅ Tiêu đề Kho Dược Bệnh Viện hiển thị:', hasPharmacyTitle);
  if (!hasPharmacyTitle) throw new Error('Kho Dược Bệnh Viện header not found');

  // 2. Click Kho thuốc Nội trú & Tủ trực
  const inpatientBtn = page.locator('button:has-text("Kho thuốc Nội trú & Tủ trực")');
  for (let i = 0; i < await inpatientBtn.count(); i++) {
    if (await inpatientBtn.nth(i).isVisible()) {
      await inpatientBtn.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(500);
  const textInpatient = await page.locator('body').innerText();
  const hasMorphinInpatient = textInpatient.includes('Morphin');
  const hasPanforInInpatient = textInpatient.includes('Panfor');
  console.log('✅ Kho Nội trú có Morphin (thuốc gây nghiện nội trú):', hasMorphinInpatient);
  console.log('✅ Kho Nội trú không lẫn thuốc ngoại trú (Panfor):', !hasPanforInInpatient);
  if (!hasMorphinInpatient || hasPanforInInpatient) throw new Error('Inpatient pharmacy filtering mismatch');

  // 3. Click Kho thuốc Ngoại trú
  const outpatientBtn = page.locator('button:has-text("Kho thuốc Ngoại trú")');
  for (let i = 0; i < await outpatientBtn.count(); i++) {
    if (await outpatientBtn.nth(i).isVisible()) {
      await outpatientBtn.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(500);
  const textOutpatient = await page.locator('body').innerText();
  const hasPanforOutpatient = textOutpatient.includes('Panfor');
  const hasMorphinInOutpatient = textOutpatient.includes('Morphin');
  console.log('✅ Kho Ngoại trú có Panfor (thuốc mạn tính ngoại trú):', hasPanforOutpatient);
  console.log('✅ Kho Ngoại trú không lẫn thuốc gây nghiện nội trú (Morphin):', !hasMorphinInOutpatient);
  if (!hasPanforOutpatient || hasMorphinInOutpatient) throw new Error('Outpatient pharmacy filtering mismatch');

  // 4. Chuyển sang Tab Kê Đơn Thuốc
  const rxTabs = page.locator('aside button:has-text("Kê đơn thuốc")');
  for (let i = 0; i < await rxTabs.count(); i++) {
    if (await rxTabs.nth(i).isVisible()) {
      await rxTabs.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(800);

  const bodyTextRx = await page.locator('body').innerText();
  const hasRxTitle = bodyTextRx.toLowerCase().includes('kê đơn thuốc');
  const hasInpatientSubtab = bodyTextRx.includes('Đơn thuốc Nội trú');
  const hasOutpatientSubtab = bodyTextRx.includes('Đơn thuốc Ngoại trú');
  const containsCpoe = bodyTextRx.includes('CPOE');
  const containsFefo = bodyTextRx.includes('FEFO');

  console.log('✅ Tiêu đề Kê đơn thuốc hiển thị:', hasRxTitle);
  console.log('✅ Có phân loại Đơn thuốc Nội trú (Y lệnh ngày):', hasInpatientSubtab);
  console.log('✅ Có phân loại Đơn thuốc Ngoại trú (Xuất viện):', hasOutpatientSubtab);
  console.log('✅ Đã loại bỏ hoàn toàn từ khóa CPOE:', !containsCpoe);
  console.log('✅ Đã loại bỏ hoàn toàn từ khóa FEFO:', !containsFefo);

  if (!hasRxTitle || !hasInpatientSubtab || !hasOutpatientSubtab || containsCpoe || containsFefo) {
    throw new Error('Prescription tab verification failed or contains CPOE/FEFO buzzwords');
  }

  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_hospital_pharmacy_and_prescriptions.png' });
  console.log('🎉 TOÀN BỘ KIỂM THỬ KHO DƯỢC VÀ KÊ ĐƠN THUỐC ĐẠT 100%!');

  await browser.close();
}

testPharmacy().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
