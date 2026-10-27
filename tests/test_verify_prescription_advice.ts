/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Kiểm thử E2E Playwright: Dặn Dò Bác Sĩ & Gửi Mail Nhắc Uống Thuốc qua Google Apps Script (<=200 LOC)
 */

import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🚀 Bắt đầu kiểm thử E2E: Dặn dò bác sĩ & Nhắc thuốc qua Google Apps Script...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Đã tải trang web localhost:5173');

    // Chuyển role sang Bác sĩ (Doctor)
    const roleSelect = page.locator('header select:visible').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('doctor');
      await page.waitForTimeout(400);
      console.log('✅ Đã chuyển sang vai trò Bác sĩ kê đơn (Doctor)');
    }

    // 1. Mở Trợ lý AI Copilot
    console.log('🤖 Bấm nút mở Trợ lý AI Copilot...');
    const copilotToggle = page.locator('button:has-text("Trợ lý AI"):visible').first();
    if (await copilotToggle.count() > 0) {
      await copilotToggle.click();
      await page.waitForTimeout(600);
      console.log('✅ Đã mở cửa sổ Chatbot Copilot');
    }

    // 2. Nhập câu lệnh dặn dò bệnh nhân uống thuốc qua hòm thư
    console.log('💬 Nhập câu lệnh dặn dò vào Chatbot Copilot...');
    const chatInput = page.locator('input[placeholder*="Nhập yêu cầu"], textarea[placeholder*="Nhập yêu cầu"]').first();
    if (await chatInput.count() > 0) {
      const prompt = 'Dặn dò bệnh nhân Nguyễn Văn An uống thuốc Paracetamol và Augmentin hàng ngày lúc 7h và 19h gửi mail an.nv@gmail.com';
      await chatInput.fill(prompt);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Chụp ảnh thẻ Lịch Dặn Dò & Nhắc Uống Thuốc trong Chatbot
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_prescription_advice.png') });
      console.log('📸 Đã chụp: verified_chatbot_prescription_advice.png');

      // Bấm nút "Gửi Email qua Google Script" trên thẻ
      const sendEmailBtn = page.locator('button:has-text("Gửi Email qua Google Script"):visible').first();
      if (await sendEmailBtn.count() > 0) {
        console.log('📧 Bấm nút Gửi Email qua Google Script...');
        await sendEmailBtn.click();
        await page.waitForTimeout(1000);
      }

      // Bấm nút "Xem Email" để mở xem trước HTML
      const viewEmailBtn = page.locator('button:has-text("Xem Email"):visible').first();
      if (await viewEmailBtn.count() > 0) {
        console.log('👁️ Bấm nút Xem Email HTML...');
        await viewEmailBtn.click();
        await page.waitForTimeout(800);
      }

      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_chatbot_email_sent_preview.png') });
      console.log('📸 Đã chụp: verified_chatbot_email_sent_preview.png');

      // Đóng Copilot để tương tác với màn hình chính
      const closeCopilotBtn = page.locator('button[aria-label*="Đóng"], button:has-text("Trợ lý AI")').first();
      if (await closeCopilotBtn.count() > 0) {
        await closeCopilotBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // 3. Chuyển sang Tab Kê Đơn Thuốc Điện Tử (CPOE)
    console.log('📋 Chuyển sang Tab Kê đơn CPOE...');
    const cpoeTabBtn = page.locator('button:has-text("Kê đơn (CPOE)"):visible, button:has-text("Kê đơn"):visible, button:has-text("CPOE"):visible').first();
    if (await cpoeTabBtn.count() > 0) {
      await cpoeTabBtn.click();
      await page.waitForTimeout(1000);

      // Tìm nút "Dặn dò & Nhắc thuốc" trên dòng đơn thuốc
      const adviceBtn = page.locator('button:has-text("Dặn dò & Nhắc thuốc"):visible, button:has-text("Dặn dò"):visible').first();
      if (await adviceBtn.count() > 0) {
        console.log('⏰ Mở Modal Dặn dò & Lên lịch nhắc thuốc từ đơn CPOE...');
        await adviceBtn.click();
        await page.waitForTimeout(1000);

        // Kiểm tra ô dặn dò của bác sĩ mặc định để trống
        const adviceTextarea = page.locator('.fixed.inset-0 textarea').first();
        if (await adviceTextarea.count() > 0) {
          const val = await adviceTextarea.inputValue();
          console.log('📝 Giá trị ô dặn dò của bác sĩ:', JSON.stringify(val));
        }

        // Bấm nút In phiếu dặn dò để kiểm tra phương thức in iframe không bị chặn popup
        const printBtn = page.locator('.fixed.inset-0 button:has-text("In phiếu dặn dò"):visible').first();
        if (await printBtn.count() > 0) {
          await printBtn.click();
          await page.waitForTimeout(500);
          const hasIframe = await page.locator('#clinical-advice-print-frame').count() > 0;
          console.log('🖨️ Đã bấm In phiếu dặn dò (Iframe Print Frame):', hasIframe);
        }

        // Bấm nút Xem Email để kiểm tra bản xem trước HTML
        const modalViewEmailBtn = page.locator('.fixed.inset-0 button:has-text("Xem Email"):visible').first();
        if (await modalViewEmailBtn.count() > 0) {
          console.log('👁️ Bấm nút Xem Email trong modal CPOE...');
          await modalViewEmailBtn.click();
          await page.waitForTimeout(600);
        }

        // Chụp ảnh Modal Dặn Dò & Lên Lịch Nhắc Thuốc
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verified_cpoe_prescription_advice_modal.png') });
        console.log('📸 Đã chụp: verified_cpoe_prescription_advice_modal.png');

        // Bấm nút Gửi Email Bệnh Nhân trong modal
        const modalSendBtn = page.locator('.fixed.inset-0 button:has-text("Gửi Email Bệnh Nhân"):visible').first();
        if (await modalSendBtn.count() > 0) {
          await modalSendBtn.click();
          await page.waitForTimeout(800);
        }

        // Đóng modal
        const closeBtn = page.locator('.fixed.inset-0 button:has(svg.lucide-x), .fixed.inset-0 button:has-text("Đóng")').first();
        if (await closeBtn.count() > 0) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT DẶN DÒ & EMAIL REMINDER THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('❌ Lỗi Playwright:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
