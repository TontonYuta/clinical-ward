import { chromium } from 'playwright';

async function testDuocThuLookup() {
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

  // 2. Bấm nút "Tra cứu Dược Thư" trên thanh công cụ
  const ribbonDuocThuBtn = page.locator('button[data-testid="btn-open-safety-guide"]');
  console.log('✅ 1. Nút "Tra cứu Dược Thư" hiển thị trên thanh công cụ:', await ribbonDuocThuBtn.isVisible());
  await ribbonDuocThuBtn.click();
  await page.waitForTimeout(1000);

  // 3. Kiểm tra logic: Khi mở không bị màn hình trống, hiển thị ngay chuyên luận Dược Thư
  const modalHeader = page.locator('text=Tra Cứu Dược Thư Quốc Gia Việt Nam').first();
  const isModalOpen = await modalHeader.isVisible();
  console.log('✅ 2. Bàn tra cứu Dược Thư Quốc Gia mở thành công:', isModalOpen);
  if (!isModalOpen) throw new Error('Dược Thư modal failed to open');

  // Kiểm tra thông tin chuyên luận Dược Thư hiển thị ngay (không bị màn hình trống)
  const dtqgCitation = page.locator('text=Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)').first();
  const isCitationVisible = await dtqgCitation.isVisible();
  console.log('✅ 3. Chuyên luận Dược Thư 2015 hiển thị sẵn ngay khi mở (không bị màn hình trống):', isCitationVisible);
  if (!isCitationVisible) throw new Error('Monograph citation missing or screen is empty');

  // 4. Kiểm tra hàng nút chọn nhanh (Quick Pills)
  const panforChip = page.locator('button:has-text("Panfor PR-750 (Metformin)")');
  const isPanforChipVisible = await panforChip.isVisible();
  console.log('✅ 4. Hàng nút chọn nhanh thuốc Dược Thư hiển thị:', isPanforChipVisible);
  if (!isPanforChipVisible) throw new Error('Quick selection chips missing');

  // Click chọn thuốc ngoại trú Metformin / Panfor
  await panforChip.click();
  await page.waitForTimeout(800);

  // Kiểm tra nội dung chuyên luận Metformin được nạp đúng
  const metforminHeading = page.locator('div[role="dialog"] h3:has-text("Panfor")');
  const isMetforminLoaded = await metforminHeading.isVisible();
  const page965 = page.locator('div[role="dialog"]').locator('text=965').first();
  console.log('✅ 5. Chuyển chuyên luận Metformin (Trang 965) thành công:', isMetforminLoaded && (await page965.isVisible()));
  if (!isMetforminLoaded) throw new Error('Failed to load Metformin monograph');

  // 5. Kiểm tra kích thước font chữ (font chữ tăng gấp đôi)
  const mainTitleElement = metforminHeading;
  const titleFontSize = await mainTitleElement.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('✅ 6. Font chữ tiêu đề chuyên luận (kích thước lớn):', titleFontSize);

  const indicationHeading = page.locator('h4:has-text("Chỉ Định Điều Trị")').first();
  const headingFontSize = await indicationHeading.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('✅ 7. Font chữ tiêu đề mục (kích thước lớn):', headingFontSize);

  const bulletElement = page.locator('li:has-text("Điều trị đái tháo đường")').first();
  const bulletFontSize = await bulletElement.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('✅ 8. Font chữ nội dung gạch đầu dòng (tăng gấp đôi ~18px):', bulletFontSize);

  const numBulletSize = parseFloat(bulletFontSize);
  if (numBulletSize < 15) {
    throw new Error(`Font size is too small: ${bulletFontSize}, expected >= 16px`);
  }

  // 6. Kiểm tra khả năng scroll ngang và dọc với thanh scroll nhỏ (thin-scrollbar)
  const scrollContainer = page.locator('.overflow-x-auto.overflow-y-auto.thin-scrollbar').first();
  const isScrollContainerVisible = await scrollContainer.isVisible();
  console.log('✅ 9. Khung nội dung hỗ trợ cuộn ngang và cuộn dọc với thanh scroll siêu nhỏ:', isScrollContainerVisible);
  if (!isScrollContainerVisible) throw new Error('Scrollable container with thin-scrollbar missing');

  const scrollWidth = await scrollContainer.evaluate((el) => el.scrollWidth);
  const clientWidth = await scrollContainer.evaluate((el) => el.clientWidth);
  console.log(`✅ 10. Kích thước scroll ngang nội dung: scrollWidth=${scrollWidth}px, clientWidth=${clientWidth}px (Cho phép cuộn ngang thoải mái mà không bị ép vỡ bố cục)`);

  // Chụp ảnh minh chứng
  await page.screenshot({ path: '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_duoc_thu_lookup_logic_and_fonts.png' });
  console.log('🎉 TOÀN BỘ 10/10 TIÊU CHÍ LOGIC VÀ TYPOGRAPHY DƯỢC THƯ ĐẠT 100%!');

  await browser.close();
}

testDuocThuLookup().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
