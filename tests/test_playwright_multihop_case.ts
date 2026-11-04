import { chromium } from 'playwright';

async function runMultihopPlaywrightTest() {
  const targetUrl = 'http://127.0.0.1:5173';
  console.log('======================================================');
  console.log(`BẮT ĐẦU KIỂM THỬ PLAYWRIGHT MULTI-HOP CLINICAL AGENT TẠI: ${targetUrl}`);
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(2000);

  // 1. Mở Chatbot nếu đang ẩn
  const trigger = page.locator('button[aria-label="Trợ lý AI lâm sàng"]');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.waitForTimeout(1000);
  }

  const chatInput = page.locator('[data-testid="chat-input-field"]');
  await chatInput.waitFor({ state: 'visible', timeout: 10000 });
  const sendBtn = page.locator('button[type="submit"]');

  // Làm sạch chat nếu có nút làm mới
  const clearBtn = page.locator('[data-testid="chat-clear-btn"]');
  if (await clearBtn.isVisible()) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }

  let prevCount = await page.locator('[data-testid*="chat-message"]').count();
  console.log(`Số tin nhắn ban đầu trong khung chat: ${prevCount}`);

  const testQuery = {
    q: 'Bệnh nhân suy thận ClCr 25 ml/phút, suy tim NYHA III, đái tháo đường typ 2, gout. Đang dùng Coversyl 4mg, Metformin 500mg, Spironolacton 25mg. Định kê thêm Meloxicam 7.5mg và Colchicin 1mg',
    expectedSubstrings: [
      'HỘI CHẨN DƯỢC LÂM SÀNG',
      'Metformin',
      'Perindopril',
      'Spironolacton',
      'Meloxicam',
      'Colchicin',
      'Linagliptin 5 mg/ngày',
      'Prednisolon',
      'Self-RAG',
      'ĐÃ XÁC THỰC'
    ],
    desc: 'Multi-Hop Clinical Agent & Chain-of-Thought Polypharmacy Case (Direction A)'
  };

  console.log(`\n--- KIỂM THỬ: ${testQuery.desc} ---`);
  console.log(`Gửi câu hỏi: "${testQuery.q}"`);

  await chatInput.fill(testQuery.q);
  await sendBtn.click();

  // Đợi phản hồi xuất hiện
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid*="chat-message"]').length > count,
    prevCount,
    { timeout: 30000 }
  );
  await page.waitForTimeout(3000);

  // Lấy tin nhắn phản hồi mới nhất
  const messages = page.locator('[data-testid*="chat-message"]');
  const count = await messages.count();
  const latestMessage = messages.nth(count - 1);
  const textContent = (await latestMessage.textContent()) || '';

  console.log(`Phản hồi nhận được (${textContent.length} ký tự):\n${textContent.slice(0, 300)}...`);

  for (const exp of testQuery.expectedSubstrings) {
    if (textContent.includes(exp)) {
      console.log(`  ✅ Tìm thấy nội dung mong đợi: "${exp}"`);
    } else {
      console.error(`  ❌ KHÔNG tìm thấy nội dung: "${exp}"`);
      throw new Error(`Thiếu nội dung kiểm thử: ${exp}`);
    }
  }

  // Chụp ảnh bằng chứng
  const screenshotPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/multihop_clinical_agent_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n📸 Đã chụp ảnh màn hình lưu tại: ${screenshotPath}`);

  await browser.close();
  console.log('======================================================');
  console.log('🎉 KIỂM THỬ PLAYWRIGHT MULTI-HOP CLINICAL AGENT THÀNH CÔNG 100%!');
  console.log('======================================================');
}

runMultihopPlaywrightTest().catch((err) => {
  console.error('LỖI KIỂM THỬ PLAYWRIGHT:', err);
  process.exit(1);
});
