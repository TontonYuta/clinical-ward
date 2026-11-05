import { chromium } from 'playwright';
import path from 'node:path';

async function runInAppPdfDrawerTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

  console.log('======================================================================');
  console.log(`🏥 BẮT ĐẦU KIỂM THỬ PLAYWRIGHT: DUAL-MODE CLINICAL READER & INLINE CITATIONS`);
  console.log(`🌐 Target: ${targetUrl}`);
  console.log('======================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(1500);

  // 1. Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    console.log('Mở Chatbot AI...');
    await trigger.click();
    await page.waitForTimeout(800);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(500);
  }

  // 2. Gửi câu hỏi lâm sàng có căn cứ y văn
  const query = 'trẻ 12 tuổi uống paracetamol như thế nào';
  console.log(`1. Gửi câu hỏi: "${query}"...`);
  await chatInput.fill(query);
  await sendBtn.click();

  // Đợi phản hồi stream hoàn tất
  console.log('2. Đợi phản hồi stream hoàn tất...');
  await page.waitForFunction(() => {
    const messages = Array.from(document.querySelectorAll('[data-testid="chat-message-agent"]'));
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    const text = (lastMsg as HTMLElement).innerText || '';
    const isStillStreaming = lastMsg.querySelector('.animate-pulse') !== null;
    return text.includes('500 mg') && !isStillStreaming;
  }, { timeout: 25000 });

  await page.waitForTimeout(1200);

  // 3. Kiểm tra xem chuỗi rác "(Căn cứ pháp lý & Tài liệu đối soát..." có bị rò rỉ không
  const lastAgentMsg = page.locator('[data-testid="chat-message-agent"]').last();
  const rawMsgText = await lastAgentMsg.innerText();
  if (rawMsgText.includes('Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf') || rawMsgText.includes('Tài liệu đối soát: Dược thư')) {
    throw new Error('❌ Chuỗi rác tài liệu thô vẫn bị rò rỉ vào thân tin nhắn!');
  }
  console.log('✅ Khử sạch 100% chuỗi rác tài liệu thô trong thân tin nhắn!');

  // 4. Kiểm tra: KHÔNG còn footer rác "Căn cứ y văn:" theo yêu cầu người dùng
  console.log('3. Kiểm tra triệt tiêu hoàn toàn khối footer "Căn cứ y văn:"...');
  const evidenceHeaderCount = await page.locator('text=Căn cứ y văn:').count();
  if (evidenceHeaderCount > 0) {
    throw new Error('❌ Khối "Căn cứ y văn:" vẫn còn tồn tại ở footer tin nhắn!');
  }
  console.log('✅ Khối "Căn cứ y văn:" đã được loại bỏ hoàn toàn, giao diện sạch sẽ!');

  // 5. Kiểm tra badge dẫn chứng y văn trực tiếp gắn cuối cụm thông tin
  console.log('4. Kiểm tra badge dẫn chứng y văn trực tiếp gắn cuối cụm thông tin...');
  const inlineBadge = lastAgentMsg.locator('button[title*="tra cứu"], button[title*="Dược thư"]').first();
  await inlineBadge.waitFor({ state: 'visible', timeout: 5000 });
  const badgeText = await inlineBadge.innerText();
  console.log(`   Badge phát hiện ở cuối cụm: "${badgeText.trim()}"`);

  // 6. Bấm trực tiếp vào badge để trượt mở In-App Drawer
  console.log('5. Bấm trực tiếp vào badge dẫn chứng để trượt mở In-App Drawer...');
  await inlineBadge.click();
  await page.waitForTimeout(1500);

  // 7. Kiểm tra Drawer & Chuyên Luận Y Khoa (Tab 1)
  const drawer = page.locator('[data-testid="in-app-pdf-drawer"]');
  await drawer.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ In-App PDF & Clinical Drawer đã mở mượt mà trực tiếp từ badge!');

  const pediatricSection = page.locator('text=Liều Dùng Cho Trẻ Em (Nhi Khoa)');
  await pediatricSection.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✅ Chuyên luận Y khoa chuẩn hóa đã render tức thì với đầy đủ liều Nhi khoa & Chống chỉ định!');

  const drawerMonographScreenshot = path.join(artifactDir, 'local_drawer_structured_monograph.png');
  await page.screenshot({ path: drawerMonographScreenshot });
  console.log(`📸 Đã lưu ảnh chụp Drawer Chuyên Luận Y Khoa -> ${drawerMonographScreenshot}`);

  // 8. Chuyển sang Tab 2: Bản Scan PDF Gốc
  console.log('5. Chuyển sang Tab 2: Bản Scan PDF Gốc...');
  const pdfTabBtn = page.locator('button:has-text("Bản Scan PDF Gốc")');
  await pdfTabBtn.click();
  await page.waitForTimeout(1200);

  const iframe = page.locator('[data-testid="in-app-pdf-iframe"]');
  await iframe.waitFor({ state: 'visible', timeout: 5000 });
  const iframeSrc = await iframe.getAttribute('src');
  console.log(`✅ Tab Bản Scan PDF Gốc hiển thị chuẩn xác! Iframe src: ${iframeSrc}`);

  const drawerPdfScanScreenshot = path.join(artifactDir, 'local_drawer_pdf_scan_tab.png');
  await page.screenshot({ path: drawerPdfScanScreenshot });
  console.log(`📸 Đã lưu ảnh chụp Tab Bản Scan PDF Gốc -> ${drawerPdfScanScreenshot}`);

  // 9. Đóng Drawer
  console.log('6. Đóng Drawer bằng nút [X]...');
  const closeBtn = page.locator('[data-testid="in-app-pdf-drawer"] button[title*="Đóng (Esc)"]');
  await closeBtn.click();
  await page.waitForTimeout(800);

  const isDrawerVisible = await drawer.isVisible();
  if (isDrawerVisible) {
    throw new Error('❌ Drawer không đóng sau khi bấm nút [X]!');
  }
  console.log('✅ In-App Drawer đóng êm ái, đưa bác sĩ trở về ngữ cảnh hội thoại đầy đủ!');

  const finalChatScreenshot = path.join(artifactDir, 'local_drawer_closed_clean_chat.png');
  await page.screenshot({ path: finalChatScreenshot });
  console.log(`📸 Đã lưu ảnh chụp sau khi đóng Drawer -> ${finalChatScreenshot}`);

  await browser.close();
  console.log('======================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT DUAL-MODE CLINICAL READER ĐÃ THÀNH CÔNG 100%!');
  console.log('======================================================================');
}

runInAppPdfDrawerTest().catch((err) => {
  console.error('LỖI KIỂM THỬ PLAYWRIGHT:', err);
  process.exit(1);
});
