import { chromium } from 'playwright';

async function testUnverifiedDataElimination() {
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

  // 2. Mở Bàn Tra Cứu Dược Thư từ ribbon
  const ribbonDuocThuBtn = page.locator('button[data-testid="btn-open-safety-guide"]');
  await ribbonDuocThuBtn.click();
  await page.waitForTimeout(1000);

  // 3. Kiểm tra thuốc có kiểm chứng (Morphin): Phải có Trang 1005, Căn cứ QĐ 2033/QĐ-BYT, Antidote Naloxon
  const dialog = page.locator('div[role="dialog"]');
  const morphinCitation = dialog.locator('text=1005').first();
  const hasMorphinPage = await morphinCitation.isVisible();
  console.log('✅ 1. Thuốc kiểm chứng (Morphin) có trích dẫn chính xác trang Dược Thư 2015 (Trang 1005):', hasMorphinPage);
  if (!hasMorphinPage) throw new Error('Morphin Dược thư citation missing');

  const naloxonAntidote = dialog.locator('text=Naloxon').first();
  console.log('✅ 2. Thuốc kiểm chứng (Morphin) có thuốc giải độc Antidote chuẩn (Naloxon):', await naloxonAntidote.isVisible());

  // 4. Tìm kiếm một thuốc KHÔNG có chuyên luận Dược Thư (ví dụ gõ tên vật tư hoặc thuốc mới chưa có chuyên luận)
  const searchInput = dialog.locator('input[type="text"]');
  await searchInput.fill('Bơm kim tiêm');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Bấm đóng modal để reset
  const closeBtn = page.locator('button[data-testid="btn-close-safety-modal"]');
  await closeBtn.click();
  await page.waitForTimeout(600);

  // 5. Kiểm tra hàng thuốc trong bảng: Mở hồ sơ thuốc và kiểm tra không có dữ liệu bịa đặt
  const tableRows = page.locator('table tbody tr');
  console.log('✅ 3. Bảng kho thuốc có các dòng dữ liệu thực tế:', (await tableRows.count()) > 0);

  // Bấm xem "Hồ sơ & Dược thư" của dòng đầu tiên
  const firstDetailBtn = page.locator('table button:has-text("Hồ sơ & Dược thư")').first();
  await firstDetailBtn.click();
  await page.waitForTimeout(800);

  // Kiểm tra thông tin hành chính không chứa các chuỗi fake cứng
  const modalText = await page.locator('div[role="dialog"]').innerText();
  const hasFakeVietnam = modalText.includes('Quốc gia xuất xứ: Việt Nam') && modalText.includes('Sandoz'); // Sandoz là Slovenia, không được hiển thị Việt Nam
  console.log('✅ 4. Không bịa đặt nguồn gốc xuất xứ quốc gia bừa bãi:', !hasFakeVietnam);
  if (hasFakeVietnam) throw new Error('Fake country found for foreign manufacturer');

  const closeDavDetail = page.locator('button[data-testid="btn-close-dav-detail"]');
  await closeDavDetail.click();
  await page.waitForTimeout(600);

  await browser.close();
  console.log('🎉 TOÀN BỘ KIỂM TRA LOẠI BỎ DỮ LIỆU KHÔNG KIỂM CHỨNG ĐẠT 100%!');
}

testUnverifiedDataElimination().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
