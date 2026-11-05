import { chromium } from 'playwright';
import path from 'node:path';

async function runCitationExcerptMarkdownTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  const artifactDir = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';

  console.log('======================================================================');
  console.log(`🏥 BẮT ĐẦU KIỂM THỬ PLAYWRIGHT: RENDER MARKDOWN TRÍCH DẪN Y VĂN ĐỐI CHỨNG`);
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

  // Làm sạch chat nếu có
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

  // 3. Click citation badge
  console.log('3. Tìm và click badge căn cứ y văn...');
  const citationBadge = page.locator('button:has-text("Dược Thư Quốc Gia")').first();
  await citationBadge.waitFor({ state: 'visible', timeout: 8000 });
  await citationBadge.click();
  await page.waitForTimeout(800);

  // 4. Kiểm tra preview card và Trích dẫn y văn đối chứng
  console.log('4. Kiểm tra thẻ Trích dẫn y văn đối chứng...');
  const excerptContainer = page.locator('[data-testid="citation-excerpt-content"]');
  await excerptContainer.waitFor({ state: 'visible', timeout: 5000 });

  const excerptText = await excerptContainer.innerText();
  const rawHtml = await excerptContainer.innerHTML();

  console.log(`Excerpt text:\n${excerptText.slice(0, 160)}...`);
  console.log(`Excerpt HTML snippet:\n${rawHtml.slice(0, 160)}...`);

  // Kiểm tra không có dấu ngoặc kép thừa thãi bọc quanh toàn bộ chuỗi
  if (excerptText.startsWith('"') && excerptText.endsWith('"')) {
    throw new Error('FAILED: Excerpt is still wrapped with outer literal quotes!');
  }

  // Chụp ảnh thẻ Trích dẫn y văn đối chứng
  const previewCardPath = path.join(artifactDir, 'local_citation_excerpt_markdown_fixed.png');
  await page.screenshot({ path: previewCardPath });
  console.log(`✅ Đã chụp ảnh thẻ preview: ${previewCardPath}`);

  // 5. Mở Drawer toàn văn
  console.log('5. Bấm xem toàn văn chuyên luận & PDF trong Drawer...');
  const openFullPdfBtn = page.locator('[data-testid="citation-open-full-pdf-btn"]');
  await openFullPdfBtn.waitFor({ state: 'visible', timeout: 5000 });
  await openFullPdfBtn.click();
  await page.waitForTimeout(1000);

  const drawerExcerpt = page.locator('[data-testid="drawer-excerpt-content"]');
  await drawerExcerpt.waitFor({ state: 'visible', timeout: 5000 });
  const drawerText = await drawerExcerpt.innerText();
  console.log(`Drawer excerpt text:\n${drawerText.slice(0, 160)}...`);

  if (drawerText.startsWith('"') && drawerText.endsWith('"')) {
    throw new Error('FAILED: Drawer excerpt is still wrapped with outer literal quotes!');
  }

  const drawerPicPath = path.join(artifactDir, 'local_drawer_excerpt_markdown_fixed.png');
  await page.screenshot({ path: drawerPicPath });
  console.log(`✅ Đã chụp ảnh Drawer: ${drawerPicPath}`);

  await browser.close();
  console.log('======================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT RENDER MARKDOWN TRÍCH DẪN ĐÃ THÀNH CÔNG 100%!');
  console.log('======================================================================');
}

runCitationExcerptMarkdownTest().catch(err => {
  console.error('❌ LỖI KIỂM THỬ PLAYWRIGHT:', err);
  process.exit(1);
});
