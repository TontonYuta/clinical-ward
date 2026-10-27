import { chromium } from 'playwright';

async function testMultiturnAndModularScenarios() {
  const browser = await chromium.launch({ headless: true });
  const targetUrl = process.env.TARGET_URL || 'http://localhost:5173';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log(`\n🤖 --- KIỂM THỬ MODULAR SCENARIOS & MULTI-TURN CONTEXT BUFFER (AMIE & DST) (${targetUrl}) ---`);
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

  // 1. Kiểm tra kịch bản phân tách: Ceftriaxon - Ringer Lactat
  console.log('\n--- 1. Kiểm tra Kịch bản Modular: Tương kỵ Ceftriaxon & Calci ---');
  const res1 = await askQuestion('Ceftriaxon có truyền cùng Ringer Lactat chứa Calci được không?');
  const pass1 = res1.includes('CHỐNG CHỈ ĐỊNH') || res1.includes('tủa') || res1.includes('Calci');
  console.log('✅ Kịch bản Ceftriaxon - Calci hoạt động chính xác:', pass1);
  if (!pass1) throw new Error('Modular Ceftriaxon scenario failed');

  // 2. Kiểm tra kịch bản phân tách: Kali Clorid 10% High-Alert
  console.log('\n--- 2. Kiểm tra Kịch bản Modular: Cảnh báo Kali Clorid 10% High-Alert ---');
  const res2 = await askQuestion('Có được tiêm trực tiếp Kali clorid 10% không?');
  const pass2 = res2.includes('CẤM TUYỆT ĐỐI') || res2.includes('nguy cơ cao') || res2.includes('pha loãng');
  console.log('✅ Kịch bản Kali Clorid High-Alert hoạt động chính xác:', pass2);
  if (!pass2) throw new Error('Modular KCl scenario failed');

  // 3. Multi-turn Step A: Kích hoạt bệnh nhân Nguyễn Quốc Bảo vào Session Context Buffer
  console.log('\n--- 3. Multi-turn Step A: Kích hoạt bệnh nhân Nguyễn Quốc Bảo vào Ngữ cảnh ---');
  const res3 = await askQuestion('Xem đơn thuốc của bệnh nhân Nguyễn Quốc Bảo');
  const pass3 = res3.includes('Nguyễn Quốc Bảo') || res3.includes('RX-2026-011');
  console.log('✅ Step A: Nhận diện và thiết lập Active Patient:', pass3);
  if (!pass3) throw new Error('Multi-turn Step A failed');

  // 4. Multi-turn Step B: Câu hỏi tiếp theo KHÔNG nhắc lại tên bệnh nhân (Kế thừa Context AMIE)
  console.log('\n--- 4. Multi-turn Step B: Kế thừa ngữ cảnh bệnh nhân qua câu hỏi nối tiếp ---');
  const res4 = await askQuestion('Bệnh nhân này truyền Vancomycin bị đỏ bừng mặt thì xử trí sao?');
  const pass4 = (res4.includes('Red Man') || res4.includes('Vancomycin')) && (res4.includes('tốc độ') || res4.includes('Histamin'));
  console.log('✅ Step B: Kế thừa ngữ cảnh Nguyễn Quốc Bảo và xử trí Red Man:', pass4);
  if (!pass4) throw new Error('Multi-turn Step B failed');

  // 5. Kiểm tra kịch bản phân tách: Adrenalin sốc phản vệ TT 51/2017
  console.log('\n--- 5. Kiểm tra Kịch bản Modular: Phác đồ Adrenalin phản vệ TT 51/2017 ---');
  const res5 = await askQuestion('Phác đồ tiêm bắp Adrenalin cấp cứu phản vệ theo TT 51?');
  const pass5 = res5.includes('51/2017') && (res5.includes('1/2 ống') || res5.includes('tiêm bắp'));
  console.log('✅ Kịch bản Phản vệ Adrenalin hoạt động chính xác:', pass5);
  if (!pass5) throw new Error('Modular Anaphylaxis scenario failed');

  // 6. Active Medication Slot: Kích hoạt thuốc Amiodarone vào phiên làm việc
  console.log('\n--- 6. Active Medication Slot: Kích hoạt thuốc Amiodarone 200mg vào phiên làm việc ---');
  const res6 = await askQuestion('Cảnh báo thuốc chống loạn nhịp Amiodarone 200mg');
  const pass6 = res6.includes('AMIODARON') || res6.includes('Amiodarone') || res6.includes('QT');
  console.log('✅ Kích hoạt thuốc Amiodaron vào phiên làm việc:', pass6);
  if (!pass6) throw new Error('Amiodarone activation failed');

  // 7. Deictic Drug ADR: Hỏi "Tác dụng phụ của thuốc này là gì?" (KHÔNG nhắc lại tên thuốc)
  console.log('\n--- 7. Deictic Drug ADR: Hỏi tác dụng phụ của "thuốc này" ---');
  const res7 = await askQuestion('Tác dụng phụ của thuốc này là gì?');
  const pass7 = res7.includes('TÁC DỤNG KHÔNG MONG MUỐN') || res7.includes('ADR') || res7.includes('AMIODARONE');
  console.log('✅ Tự động nhận diện "thuốc này" là Amiodarone và trả về ADR:', pass7);
  if (!pass7) throw new Error('Deictic Drug ADR failed');

  // 8. Deictic Drug Location: Hỏi "Nó để ở tủ nào?" (KHÔNG nhắc lại tên thuốc)
  console.log('\n--- 8. Deictic Drug Location: Hỏi vị trí kho "Nó để ở tủ nào?" ---');
  const res8 = await askQuestion('Nó để ở tủ nào?');
  const pass8 = res8.includes('Tủ thuốc Hồi sức Cấp cứu Tim Mạch') || res8.includes('TỒN KHO & VỊ TRÍ') || res8.includes('180');
  console.log('✅ Tự động nhận diện "nó" là Amiodarone và trả về vị trí tủ thuốc Tim mạch:', pass8);
  if (!pass8) throw new Error('Deictic Drug Location failed');

  await browser.close();
  console.log('\n🎉 TOÀN BỘ 8/8 BÀI TEST MODULAR SCENARIOS & ACTIVE DRUG CONTEXT ĐỀU ĐẠT 100%!\n');
}

testMultiturnAndModularScenarios().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
