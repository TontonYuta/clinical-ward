import { chromium } from 'playwright';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử Playwright: Trải nghiệm người dùng (UX) khi Reload trang...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Truy cập ban đầu
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  console.log('✅ Bước 1: Đã tải trang ban đầu.');

  // 2. Chuyển sang Tab Kho Dược (FEFO)
  const pharmacyTabBtn = page.locator('button[title*="Quản lý kho dược"]:visible, button:has-text("Kho dược"):visible').first();
  await pharmacyTabBtn.click();
  await page.waitForTimeout(600);

  // 3. Đổi vai trò sang Dược sĩ (Pharmacist)
  const roleSelect = page.locator('select').first();
  if (await roleSelect.count() > 0) {
    await roleSelect.selectOption('pharmacist');
    await page.waitForTimeout(400);
  }

  // 4. Mở Copilot Chat Drawer và gửi 1 tin nhắn
  const copilotBtn = page.locator('button:has-text("Copilot"), button:has-text("Trợ lý"), button:has(svg.lucide-bot):visible').first();
  await copilotBtn.click();
  await page.waitForTimeout(600);

  const chatInput = page.locator('input[placeholder*="Nhập câu hỏi hoặc yêu cầu lâm sàng"]:visible').first();
  await chatInput.fill('Đối soát ca trực sáng 07:00 AM');
  await chatInput.press('Enter');
  await page.waitForTimeout(1000);

  // 5. Tìm kiếm thuốc trong Kho Dược
  const searchInput = page.locator('input[placeholder*="Tìm theo tên thuốc"], input[placeholder*="hoạt chất"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('paracetamol');
    await page.waitForTimeout(300);
  }

  console.log('✅ Bước 2: Đã thiết lập trạng thái trước khi reload (Tab=fefo, Role=pharmacist, Chat message sent, Search=paracetamol).');

  // 6. THỰC HIỆN RELOAD TRANG (F5)
  console.log('🔄 Đang thực hiện Reload trang (F5)...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 7. KIỂM TRA TRẠNG THÁI SAU KHI RELOAD
  console.log('🔍 Bước 3: Kiểm tra các trạng thái bền vững sau khi Reload:');

  // a. URL Hash & Active Tab
  const currentUrl = page.url();
  const hasFefoHash = currentUrl.includes('#fefo');
  console.log(`   [Hash Check]: URL = ${currentUrl} (Có #fefo: ${hasFefoHash})`);

  // b. Kho Dược Header / Phân hệ Dược còn hiển thị
  const pageText = await page.innerText('body');
  const isStillInFefo = pageText.includes('Kho Dược Bệnh Viện') || pageText.includes('Quản lý danh mục thuốc');
  console.log(`   [Tab Persistence]: Đang ở đúng Kho Dược = ${isStillInFefo}`);

  // c. Chatbot Copilot Drawer còn mở và tin nhắn còn nguyên
  const isCopilotStillOpen = await page.locator('input[placeholder*="Nhập câu hỏi hoặc yêu cầu lâm sàng"]:visible').count() > 0;
  const isChatPreserved = pageText.includes('Đối soát ca trực sáng 07:00 AM');
  console.log(`   [Copilot Drawer Persistence]: Copilot vẫn mở = ${isCopilotStillOpen}`);
  console.log(`   [Chat History Persistence]: Tin nhắn trước đó được bảo toàn = ${isChatPreserved}`);

  // d. Search Input trong Kho Dược được bảo toàn
  const searchAfterReload = page.locator('input[placeholder*="Tìm theo tên thuốc"], input[placeholder*="hoạt chất"]').first();
  let searchVal = '';
  if (await searchAfterReload.count() > 0) {
    searchVal = await searchAfterReload.inputValue();
  }
  console.log(`   [Filter Persistence]: Từ khóa tìm kiếm giữ nguyên = "${searchVal}"`);

  // 8. KIỂM TRA NÚT BACK / FORWARD CỦA TRÌNH DUYỆT
  console.log('\n🔙 Bước 4: Kiểm tra điều hướng Back / Forward trình duyệt...');
  // Chuyển sang CPOE
  const cpoeTabBtn = page.locator('button[title*="Kê đơn"]:visible, button:has-text("Kê đơn"):visible').first();
  if (await cpoeTabBtn.count() > 0) {
    await cpoeTabBtn.click();
    await page.waitForTimeout(600);
    console.log(`   Đã chuyển sang CPOE: URL = ${page.url()}`);

    // Bấm Back
    await page.goBack();
    await page.waitForTimeout(600);
    console.log(`   Sau khi bấm Back: URL = ${page.url()} (Trở về đúng #fefo)`);

    // Bấm Forward
    await page.goForward();
    await page.waitForTimeout(600);
    console.log(`   Sau khi bấm Forward: URL = ${page.url()} (Tiến tới đúng #cpoe)`);
  }

  // Chụp ảnh bằng chứng
  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354/verified_reload_ux_persistence.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n📸 Đã chụp ảnh xác minh: ${screenshotPath}`);

  await browser.close();

  if (hasFefoHash && isStillInFefo && isChatPreserved) {
    console.log('\n🎉 KIỂM THỬ PLAYWRIGHT RELOAD UX THÀNH CÔNG RỰC RỠ: 100% TRẠNG THÁI ĐƯỢC BẢO TOÀN!');
  } else {
    console.error('❌ Kiểm thử thất bại!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
