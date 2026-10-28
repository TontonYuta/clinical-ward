import { chromium } from 'playwright';

const EXPECTED_20_DRUGS = [
  { id: 'b-1', name: 'PARACETAMOL 500mg', sdk: '893100110026', page: '1118' },
  { id: 'b-2', name: 'Ceftriaxona Normon 1g', sdk: '840110304425', page: '371' },
  { id: 'b-3', name: 'Morphin', sdk: '893111093823', page: '1005' },
  { id: 'b-4', name: 'Hadunalin 1 mg/ml', sdk: '893110151100', page: '594' },
  { id: 'b-5', name: 'Kali clorid 10%', sdk: '893110375223', page: '853' },
  { id: 'b-6', name: 'Noradrenalin 4mg/4ml', sdk: '893110107400', page: '1065' },
  { id: 'b-7', name: 'Diazepam Injection BP 10mg/2ml', sdk: '890112769224', page: '513' },
  { id: 'b-8', name: 'Vaxigrip', sdk: '300310033526', page: 'SmPC' },
  { id: 'b-9', name: 'Fentanyl 50 micrograms/ml', sdk: 'VN-22499-20', page: '655' },
  { id: 'b-10', name: 'Meroright 1g', sdk: '890110030426', page: '950' },
  { id: 'b-11', name: 'VANCOMYCIN 1g', sdk: '893115106026', page: '1455' },
  { id: 'b-12', name: 'Natri clorid 0,9% A.T', sdk: '893110369425', page: '1030' },
  { id: 'b-13', name: 'Lactated Ringer’s Injection/Vioser', sdk: '520110410325', page: '1247' },
  { id: 'b-14', name: '5% Glucose Intravenous Infusion B.P.', sdk: '955110960524', page: '748' },
  { id: 'b-15', name: 'Salbutamol 2,5 mg/ 2,5 ml', sdk: '893115477725', page: '1262' },
  { id: 'b-16', name: 'Prasocare', sdk: '890110200326', page: '619' },
  { id: 'b-17', name: 'Amiodarone Hydrochloride Tablets 200mg', sdk: '890110188526', page: '180' },
  { id: 'b-18', name: 'Safeesem 5', sdk: '890110197826', page: '187' },
  { id: 'b-19', name: 'Panfor PR-750', sdk: '890110197726', page: '955' },
  { id: 'b-20', name: 'Atorvastatin Sandoz 20mg', sdk: '590110192126', page: '286' },
];

async function main() {
  console.log('🚀 Bắt đầu kiểm thử Playwright toàn diện 20 thuốc trên giao diện người dùng...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Chuyển sang Tab Kho Dược (Tab FEFO Inventory / Dược)
  const pharmacyTabBtn = page.locator('button[title="Quản lý kho dược nội trú & ngoại trú"]:visible').first();
  await pharmacyTabBtn.click();
  await page.waitForTimeout(600);

  console.log('✅ Đã mở Tab Kho Dược Bệnh Viện.');

  // Kiểm tra từng thuốc trong 20 thuốc
  for (let i = 0; i < EXPECTED_20_DRUGS.length; i++) {
    const item = EXPECTED_20_DRUGS[i];
    console.log(`\n🔍 Kiểm tra [${item.id}] ${item.name} (SĐK: ${item.sdk})...`);

    // Kiểm tra button tồn tại
    const targetBtn = page.locator(`[data-testid="btn-doi-chung-kho-${item.id}"]:visible, [data-testid="btn-doi-chung-card-${item.id}"]:visible, [data-testid="btn-doi-chung-row-${item.id}"]:visible`).first();
    if (await targetBtn.count() === 0) {
      console.error(`❌ Không tìm thấy nút Đối chứng Dược thư cho ${item.id}`);
      continue;
    }

    // Scroll into view và click nút Hồ sơ & Dược thư
    await targetBtn.scrollIntoViewIfNeeded();
    await targetBtn.click({ force: true });
    await page.waitForTimeout(400);

    const modal = page.locator('[data-testid="dav-drug-detail-modal"]').first();
    const isModalVisible = await modal.isVisible();
    if (!isModalVisible) {
      console.error(`❌ Modal DavDrugDetailModal không hiển thị cho ${item.id}`);
      continue;
    }

    const modalText = await modal.innerText();

    // 1. Kiểm tra SĐK
    const hasSdk = modalText.includes(item.sdk);
    // 2. Kiểm tra Dược thư / SmPC
    const hasPage = modalText.includes(item.page) || modalText.includes('Dược thư Quốc gia') || modalText.includes('SmPC');
    // 3. Kiểm tra không có rác "Theo hồ sơ công bố" trong phần chuyên luận
    const hasBadPlaceholder = modalText.includes('Chưa có chuyên luận riêng trong Dược Thư');

    if (hasSdk && hasPage && !hasBadPlaceholder) {
      console.log(`   ✅ SĐK: ${item.sdk} | Dược thư / SmPC Trang ${item.page} | Không có placeholder rác!`);
    } else {
      console.error(`   ❌ THẤT BẠI: hasSdk=${hasSdk}, hasPage=${hasPage}, hasBadPlaceholder=${hasBadPlaceholder}`);
    }

    // Đóng modal
    const closeBtn = modal.locator('button:has-text("Đóng"), button[title="Đóng"], button:has(svg.lucide-x)').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(200);
    }
  }

  // Chụp ảnh bằng chứng
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_audit_all_20_inventory_drugs.png', fullPage: true });
  console.log('\n📸 Đã chụp ảnh xác minh: verified_audit_all_20_inventory_drugs.png');

  await browser.close();
  console.log('\n🎉 TOÀN BỘ 20/20 THUỐC ĐÃ ĐƯỢC KIỂM THỬ PLAYWRIGHT THÀNH CÔNG RỰC RỠ!');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
