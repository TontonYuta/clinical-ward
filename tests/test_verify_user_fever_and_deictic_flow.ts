import { chromium } from 'playwright';

async function testUserFeverAndDeicticFlow() {
  const browser = await chromium.launch({ headless: true });
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log(`\n🤖 --- KIỂM THỬ XỬ TRÍ SỐT & ĐẠI TỪ CHỈ ĐỊNH THUỐC ĐÓ (TEST 1 & TEST 2 CỦA USER) (${targetUrl}) ---`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Mở chatbot nếu đang thu nhỏ
  const openChatBtn = page.locator('button[title*="Trợ lý AI"]').or(page.locator('button:has-text("Trợ lý")')).first();
  if (await openChatBtn.isVisible()) {
    await openChatBtn.click();
    await page.waitForTimeout(600);
  }

  const chatInput = page.locator('input[placeholder*="Nhập câu hỏi"]').first();

  async function askQuestion(prompt: string): Promise<string> {
    await page.waitForSelector('input[placeholder*="Nhập câu hỏi"]:not([disabled])', { timeout: 10000 });
    const prevCount = await page.locator('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').count();
    await chatInput.fill(prompt);
    await page.waitForTimeout(300);
    await page.locator('form button[type="submit"]').click();
    
    await page.waitForFunction(
      (c) => document.querySelectorAll('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').length > c,
      prevCount,
      { timeout: 15000 }
    );
    await page.waitForSelector('input[placeholder*="Nhập câu hỏi"]:not([disabled])', { timeout: 10000 });
    await page.waitForTimeout(500);

    const lastMsg = page.locator('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').last();
    return await lastMsg.innerText();
  }

  // ==========================================
  // BÀI TEST 2: "Tôi bị sốt 39 độ, tôi nên làm gì để hạ sốt"
  // ==========================================
  console.log('\n--- 1. Kiểm tra Test 2: Sốt 39 độ (TUYỆT ĐỐI KHÔNG rơi vào chuỗi lạnh vắc xin) ---');
  const resFever39 = await askQuestion('Tôi bị sốt 39 độ, tôi nên làm gì để hạ sốt');
  const notColdChain = !resFever39.includes('CHUỖI LẠNH') && !resFever39.includes('Vaxigrip') && !resFever39.includes('Tủ Lạnh Vaxigrip');
  const hasFeverAdvice = resFever39.includes('PARACETAMOL') || resFever39.includes('Paracetamol') || resFever39.includes('HẠ SỐT');
  console.log('✅ 1.1 Không bị nhầm sang chuỗi lạnh vắc xin:', notColdChain);
  console.log('✅ 1.2 Có phác đồ hạ sốt Paracetamol chuẩn:', hasFeverAdvice);
  if (!notColdChain || !hasFeverAdvice) {
    throw new Error(`Test 2 failed: notColdChain=${notColdChain}, hasFeverAdvice=${hasFeverAdvice}`);
  }

  // ==========================================
  // BÀI TEST 1: "Tôi bị sốt 40 độ, tôi nên làm thế nào"
  // ==========================================
  console.log('\n--- 2. Kiểm tra Test 1 (Lượt 1): Sốt 40 độ nguy hiểm & Hướng dẫn Paracetamol ---');
  const resFever40 = await askQuestion('Tôi bị sốt 40 độ, tôi nên làm thế nào');
  const passFever40 = resFever40.includes('40°C') || resFever40.includes('sốt cao') || resFever40.includes('PARACETAMOL');
  console.log('✅ 2. Nhận diện sốt 40 độ và tư vấn hạ sốt cấp bách:', passFever40);
  if (!passFever40) throw new Error('Test 1 Turn 1 failed');

  // ==========================================
  // BÀI TEST 1 (Lượt 2): "cho tôi thông tin về thuốc đó"
  // ==========================================
  console.log('\n--- 3. Kiểm tra Test 1 (Lượt 2): "cho tôi thông tin về thuốc đó" (Deictic Resolution) ---');
  const resDeictic = await askQuestion('cho tôi thông tin về thuốc đó');
  const notPromptAgain = !resDeictic.includes('vui lòng cho tôi biết tên cụ thể của loại thuốc');
  const resolvedParacetamol = resDeictic.includes('PARACETAMOL') || resDeictic.includes('Paracetamol') || resDeictic.includes('1118');
  console.log('✅ 3.1 Không bắt người dùng nhập lại tên thuốc:', notPromptAgain);
  console.log('✅ 3.2 Tự động giải mã "thuốc đó" thành PARACETAMOL 500mg:', resolvedParacetamol);
  if (!notPromptAgain || !resolvedParacetamol) {
    throw new Error(`Test 1 Turn 2 failed: notPromptAgain=${notPromptAgain}, resolvedParacetamol=${resolvedParacetamol}`);
  }

  await browser.close();
  console.log('\n🎉 TOÀN BỘ CÁC LỖI USER BÁO CÁO ĐÃ ĐƯỢC KHẮC PHỤC TRIỆT ĐỂ VÀ XÁC MINH 100% THÀNH CÔNG!\n');
}

testUserFeverAndDeicticFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
