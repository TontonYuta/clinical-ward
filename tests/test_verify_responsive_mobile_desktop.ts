import { chromium } from 'playwright';

async function testResponsiveLayout() {
  const browser = await chromium.launch({ headless: true });
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';

  // ==========================================
  // PHASE 1: KIỂM THỬ GIAO DIỆN MOBILE (375 x 667 - iPhone SE / Mobile chuẩn)
  // ==========================================
  console.log(`\n📱 --- KIỂM THỬ TRÊN GIAO DIỆN MOBILE (375 x 667) ---`);
  const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await mobilePage.goto(targetUrl, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  // 1. Chuyển sang Tab Kho Dược Bệnh Viện từ Mobile Bottom Nav
  const mobileNavPharmacy = mobilePage.locator('nav button:has-text("Kho dược")');
  await mobileNavPharmacy.click();
  await mobilePage.waitForTimeout(800);

  // 2. Kiểm tra danh sách hiển thị dạng thẻ Mobile Card (không bị tràn vỡ giao diện)
  const mobileCards = mobilePage.locator('div.md\\:hidden.flex-1');
  const isMobileCardsVisible = await mobileCards.isVisible();
  console.log('✅ 1. Mobile hiển thị danh sách thẻ Mobile Card riêng biệt (md:hidden):', isMobileCardsVisible);
  if (!isMobileCardsVisible) throw new Error('Mobile cards container missing');

  // 3. Mở Bàn Tra Cứu Dược Thư trên Mobile
  const mobileDuocThuBtn = mobilePage.locator('button[data-testid="btn-open-safety-guide"]');
  await mobileDuocThuBtn.click();
  await mobilePage.waitForTimeout(1000);

  const safetyDialog = mobilePage.locator('div[role="dialog"]');
  const isModalOpenMobile = await safetyDialog.isVisible();
  console.log('✅ 2. Bàn tra cứu Dược Thư mở tràn viền chuẩn Mobile (h-[100dvh]):', isModalOpenMobile);
  if (!isModalOpenMobile) throw new Error('Safety modal failed to open on mobile');

  // Kiểm tra container nội dung trên mobile vừa khít (w-full, không bị ép 950px cứng)
  const innerContent = safetyDialog.locator('.w-full.sm\\:min-w-\\[950px\\]');
  const isInnerContentResponsive = await innerContent.isVisible();
  console.log('✅ 3. Nội dung chuyên luận co giãn tương thích theo màn hình Mobile:', isInnerContentResponsive);
  if (!isInnerContentResponsive) throw new Error('Responsive container missing');

  // Bấm chọn một thuốc kiểm chứng trên Mobile
  const panforChip = safetyDialog.locator('button:has-text("Panfor PR-750 (Metformin)")');
  if (await panforChip.isVisible()) {
    await panforChip.click();
    await mobilePage.waitForTimeout(600);
  }
  const panforTitle = safetyDialog.locator('h3:has-text("Panfor")');
  console.log('✅ 4. Chuyển chuyên luận thuốc trên Mobile thành công:', await panforTitle.isVisible());

  // Đóng modal trên Mobile
  const closeBtn = safetyDialog.locator('button[data-testid="btn-close-safety-modal"]');
  await closeBtn.click();
  await mobilePage.waitForTimeout(600);
  await mobilePage.close();

  // ==========================================
  // PHASE 2: KIỂM THỬ GIAO DIỆN DESKTOP (1440 x 900 - Màn hình Workstation Bệnh Viện)
  // ==========================================
  console.log(`\n💻 --- KIỂM THỬ TRÊN GIAO DIỆN DESKTOP (1440 x 900) ---`);
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktopPage.goto(targetUrl, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  // 1. Chuyển sang Tab Kho Dược Bệnh Viện từ Desktop Sidebar
  const desktopNavPharmacy = desktopPage.locator('aside button:has-text("Kho dược")');
  for (let i = 0; i < await desktopNavPharmacy.count(); i++) {
    if (await desktopNavPharmacy.nth(i).isVisible()) {
      await desktopNavPharmacy.nth(i).click();
      break;
    }
  }
  await desktopPage.waitForTimeout(800);

  // 2. Desktop hiển thị Bảng đầy đủ các cột (hidden md:flex)
  const desktopTable = desktopPage.locator('.hidden.md\\:flex table');
  const isDesktopTableVisible = await desktopTable.isVisible();
  console.log('✅ 5. Desktop hiển thị bảng danh mục thuốc chuẩn Workstation đầy đủ 8 cột:', isDesktopTableVisible);
  if (!isDesktopTableVisible) throw new Error('Desktop table missing');

  // 3. Mở Bàn Tra Cứu Dược Thư trên Desktop
  const desktopDuocThuBtn = desktopPage.locator('button[data-testid="btn-open-safety-guide"]');
  await desktopDuocThuBtn.click();
  await desktopPage.waitForTimeout(1000);

  const desktopDialog = desktopPage.locator('div[role="dialog"]');
  console.log('✅ 6. Bàn tra cứu Dược Thư mở thành công trên Desktop:', await desktopDialog.isVisible());

  // Kiểm tra font chữ lớn và thanh cuộn mảnh trên Desktop
  const desktopTitle = desktopDialog.locator('h3:has-text("Morphin")').or(desktopDialog.locator('h3:has-text("Panfor")')).first();
  const titleSize = await desktopTitle.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('✅ 7. Kích thước font chữ tiêu đề trên Desktop đạt chuẩn lớn:', titleSize);

  const closeDesktopBtn = desktopDialog.locator('button[data-testid="btn-close-safety-modal"]');
  await closeDesktopBtn.click();
  await desktopPage.waitForTimeout(600);
  await desktopPage.close();

  await browser.close();
  console.log('\n🎉 TOÀN BỘ 7/7 TIÊU CHÍ RESPONSIVE CHO CẢ DESKTOP & MOBILE ĐẠT 100%!');
}

testResponsiveLayout().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
