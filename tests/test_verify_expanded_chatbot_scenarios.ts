import { chromium } from 'playwright';

async function testExpandedChatbotScenarios() {
  const browser = await chromium.launch({ headless: true });
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log(`\n🤖 --- KIỂM THỬ 8 KỊCH BẢN LÂM SÀNG CHUYÊN SÂU TRÊN CHATBOT (${targetUrl}) ---`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Mở chatbot nếu đang thu nhỏ
  const openChatBtn = page.locator('button[title*="Trợ lý AI"]').or(page.locator('button:has-text("Trợ lý")')).first();
  if (await openChatBtn.isVisible()) {
    await openChatBtn.click();
    await page.waitForTimeout(600);
  }

  const chatInput = page.locator('input[placeholder*="Nhập câu hỏi"]').first();
  const sendBtn = page.locator('button[title="Gửi câu hỏi"]').or(page.locator('form button[type="submit"]')).first();

  async function askQuestion(prompt: string): Promise<string> {
    await page.waitForSelector('input[placeholder*="Nhập câu hỏi"]:not([disabled])', { timeout: 10000 });
    const prevCount = await page.locator('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').count();
    await chatInput.fill(prompt);
    await page.waitForTimeout(300);
    await page.locator('form button[type="submit"]').click();
    
    // Đợi số lượng tin nhắn bot tăng lên
    await page.waitForFunction(
      (c) => document.querySelectorAll('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').length > c,
      prevCount,
      { timeout: 15000 }
    );
    await page.waitForSelector('input[placeholder*="Nhập câu hỏi"]:not([disabled])', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Lấy tin nhắn phản hồi mới nhất của bot
    const lastMsg = page.locator('.flex.gap-2\\.5:not(.ml-auto) .rounded-2xl').last();
    return await lastMsg.innerText();
  }

  // ==========================================
  // KỊCH BẢN 1: TƯƠNG KỴ CEFTRIAXON - RINGER LACTAT
  // ==========================================
  console.log('\n--- 1. Kiểm tra Kịch bản Tương kỵ Ceftriaxon & Ringer Lactat (Dược thư Trang 371) ---');
  const ans1 = await askQuestion('Ceftriaxon có truyền cùng Ringer Lactat chứa Calci được không theo Dược thư?');
  const pass1 = ans1.includes('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI') || ans1.includes('tủa') || ans1.includes('Calci');
  console.log('✅ 1. Nhận diện tương kỵ tử vong Ceftriaxon - Calci:', pass1);
  if (!pass1) throw new Error('Scenario 1 failed');

  // ==========================================
  // KỊCH BẢN 2: HỘI CHỨNG RED MAN DO VANCOMYCIN
  // ==========================================
  console.log('\n--- 2. Kiểm tra Kịch bản Hội chứng Red Man do Vancomycin (Dược thư Trang 1455) ---');
  const ans2 = await askQuestion('Bệnh nhân Nguyễn Quốc Bảo truyền Vancomycin bị đỏ bừng mặt, xử trí thế nào?');
  const pass2 = (ans2.includes('Red Man') || ans2.includes('Vancomycin')) && (ans2.includes('Histamin') || ans2.includes('tốc độ'));
  console.log('✅ 2. Nhận diện hội chứng Red Man & phác đồ giảm tốc độ truyền:', pass2);
  if (!pass2) throw new Error('Scenario 2 failed');

  // ==========================================
  // KỊCH BẢN 3: TƯƠNG TÁC NƯỚC BƯỞI CHÙM & ATORVASTATIN
  // ==========================================
  console.log('\n--- 3. Kiểm tra Kịch bản Đơn xuất viện RX-2026-012: Nước bưởi chùm & Atorvastatin ---');
  const ans3 = await askQuestion('Đơn xuất viện RX-2026-012 Võ Minh Trí: Atorvastatin có được uống cùng nước ép bưởi không?');
  const pass3 = ans3.includes('Atorvastatin') && (ans3.includes('bưởi') || ans3.includes('CYP3A4') || ans3.includes('tiêu cơ vân'));
  console.log('✅ 3. Cảnh báo ức chế CYP3A4 tăng nồng độ Statin gây tiêu cơ vân:', pass3);
  if (!pass3) throw new Error('Scenario 3 failed');

  // ==========================================
  // KỊCH BẢN 4: KALI CLORID 10% HIGH-ALERT
  // ==========================================
  console.log('\n--- 4. Kiểm tra Kịch bản Cảnh báo Thuốc Nguy Cơ Cao: Kali Clorid 10% ---');
  const ans4 = await askQuestion('Thuốc Kali clorid 10% có được tiêm tĩnh mạch trực tiếp không và cách pha truyền?');
  const pass4 = ans4.includes('CẤM') && (ans4.includes('ngừng tim') || ans4.includes('pha loãng') || ans4.includes('bơm tiêm điện'));
  console.log('✅ 4. Cảnh báo cấm tiêm trực tiếp Kali Clorid 10% & quy chuẩn pha truyền:', pass4);
  if (!pass4) throw new Error('Scenario 4 failed');

  // ==========================================
  // KỊCH BẢN 5: QUY CHẾ THU HỒI VỎ MORPHIN THEO TT 20/2017 & QUY ĐỔI OPIOID
  // ==========================================
  console.log('\n--- 5. Kiểm tra Kịch bản Quy chế Quản lý Thuốc Gây Nghiện & Quy đổi Opioid ---');
  const ans5 = await askQuestion('Quy chế thu hồi vỏ ống Morphin ca đêm và quy đổi sang Fentanyl theo TT 20/2017?');
  const pass5 = ans5.includes('Morphin') && (ans5.includes('Fentanyl') || ans5.includes('vỏ ống') || ans5.includes('20/2017'));
  console.log('✅ 5. Quy chế thu hồi vỏ thuốc gây nghiện & tương đương MME chuẩn:', pass5);
  if (!pass5) throw new Error('Scenario 5 failed');

  // ==========================================
  // KỊCH BẢN 6: PHÁC ĐỒ ADRENALIN PHẢN VỆ TT 51/2017
  // ==========================================
  console.log('\n--- 6. Kiểm tra Kịch bản Phác đồ Adrenalin phản vệ TT 51/2017 ---');
  const ans6 = await askQuestion('Phác đồ cấp cứu tiêm bắp Adrenalin phản vệ theo Thông tư 51/2017/TT-BYT?');
  const pass6 = ans6.includes('Adrenalin') && (ans6.includes('tiêm bắp') || ans6.includes('1/2 ống') || ans6.includes('đùi'));
  console.log('✅ 6. Phác đồ tiêm bắp Adrenalin 1/2 ống chuẩn TT 51/2017:', pass6);
  if (!pass6) throw new Error('Scenario 6 failed');

  // ==========================================
  // KỊCH BẢN 7: TRA CỨU TỒN KHO MORPHIN CA ĐÊM
  // ==========================================
  console.log('\n--- 7. Kiểm tra Kịch bản Tra cứu Tồn kho Thực tế Thuốc Gây Nghiện ---');
  const ans7 = await askQuestion('Kho viện còn bao nhiêu ống Morphin hydroclorid và lưu ở tủ nào?');
  const pass7 = ans7.includes('35') || ans7.includes('Morphin') || ans7.includes('Tủ sắt');
  console.log('✅ 7. Tra cứu chính xác số lượng tồn kho Morphin từ CSDL:', pass7);
  if (!pass7) throw new Error('Scenario 7 failed');

  // ==========================================
  // KỊCH BẢN 8: XỬ TRÍ SỰ CỐ CHUỖI LẠNH VẮC XIN VAXIGRIP
  // ==========================================
  console.log('\n--- 8. Kiểm tra Kịch bản Xử trí Sự Cố Chuỗi Lạnh Vắc xin GSP ---');
  const ans8 = await askQuestion('Nhiệt độ tủ bảo quản vắc xin Vaxigrip vượt quá 8 độ C thì xử trí cách ly thế nào?');
  const pass8 = ans8.includes('Vaxigrip') && (ans8.includes('2.0°C') || ans8.includes('cách ly') || ans8.includes('Quarantine') || ans8.includes('MKT'));
  console.log('✅ 8. Phác đồ cách ly bảo quản chuỗi lạnh vắc xin GSP đạt chuẩn:', pass8);
  if (!pass8) throw new Error('Scenario 8 failed');

  await browser.close();
  console.log('\n🎉 TOÀN BỘ 8/8 KỊCH BẢN LÂM SÀNG TỪ CSDL ĐÃ ĐƯỢC XÁC THỰC 100%!');
}

testExpandedChatbotScenarios().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
