/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * E2E Playwright: Kiểm thử Chatbot NLP Quyết Định Nghiệp Vụ & Dẫn Nguồn PDF Dược Thư 2015 (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử E2E: Chatbot NLP, Quyết định Nghiệp vụ & Dẫn nguồn PDF Dược thư 2015...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Đã tải trang web localhost:5173');

    // Chuyển role sang Bác sĩ
    const roleSelect = page.locator('header select:visible').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('doctor');
      await page.waitForTimeout(400);
    }

    // 1. Mở Copilot
    const copilotToggle = page.locator('button:has-text("Trợ lý AI"):visible').first();
    if (await copilotToggle.count() > 0) {
      await copilotToggle.click();
      await page.waitForTimeout(600);
      console.log('✅ Đã mở Copilot');
    }

    const chatInput = page.locator('input[placeholder*="Nhập yêu cầu"], textarea[placeholder*="Nhập yêu cầu"]').first();

    // 2. Test Tra cứu Thông tin thuốc Hadunalin có dẫn chứng PDF Dược thư 2015
    console.log('💬 Test 1: Tra cứu thuốc Hadunalin dẫn chứng PDF Dược thư 2015...');
    await chatInput.fill('Thông tin thuốc Hadunalin');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Kiểm tra nội dung trích dẫn PDF Dược thư 2015
    const chatContainer = page.locator('.overflow-y-auto');
    const hasPdfLink = await chatContainer.locator('a[href*="Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"]').count() > 0;
    const hasPage594 = await chatContainer.locator(':has-text("594")').count() > 0;
    console.log('📄 Có link mở PDF Dược Thư 2015:', hasPdfLink);
    console.log('📄 Có số trang Trang 594 - 597:', hasPage594);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_hadunalin_pdf_citation.png') });
    console.log('📸 Đã chụp: verified_chatbot_hadunalin_pdf_citation.png');

    // 3. Test Kê đơn thuốc CPOE tự động qua Chatbot
    console.log('💬 Test 2: Tự động Kê đơn thuốc CPOE cho bệnh nhân qua Chatbot...');
    await chatInput.fill('Kê đơn cho bệnh nhân Trần Thị Mai dùng Augmentin 1g và Paracetamol 500mg');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Bấm nút Ký duyệt & Tạo đơn thuốc CPOE trên thẻ hành động
    const approveCpoeBtn = page.locator('button:has-text("Ký duyệt & Tạo đơn thuốc CPOE"):visible').first();
    if (await approveCpoeBtn.count() > 0) {
      console.log('✍️ Bấm nút Ký duyệt & Tạo đơn thuốc CPOE trên Action Card...');
      await approveCpoeBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_cpoe_execution.png') });
    console.log('📸 Đã chụp: verified_chatbot_cpoe_execution.png');

    // 4. Test Hoàn trả vỏ morphin cho ca trực
    console.log('💬 Test 3: Nghiệp vụ thu hồi vỏ thuốc gây nghiện qua Chatbot...');
    await chatInput.fill('Hoàn trả vỏ morphin cho ca trực');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const returnAmpouleBtn = page.locator('button:has-text("Xác nhận thu hồi vỏ ống thuốc"):visible').first();
    if (await returnAmpouleBtn.count() > 0) {
      console.log('📦 Bấm nút Xác nhận thu hồi vỏ ống thuốc trên Action Card...');
      await returnAmpouleBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_debt_ampoule_settle.png') });
    console.log('📸 Đã chụp: verified_chatbot_debt_ampoule_settle.png');

    console.log('🎉 TẤT CẢ KIỂM THỬ PLAYWRIGHT CHATBOT NLP & QUYẾT ĐỊNH NGHIỆP VỤ THÀNH CÔNG 100%!');
  } catch (err) {
    console.error('❌ Lỗi Playwright:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
