import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const APP_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/f25324be-2bc8-4450-9006-d204ed53b109/screenshots';
const TEST_DOWNLOADS_DIR = '/home/tontonyuta/Downloads/DoAn2/artifacts/test_downloads';

const SAMPLE_IMG_1 = path.join(TEST_DOWNLOADS_DIR, 'sample_prescription_online.jpg');
const SAMPLE_IMG_2 = path.join(TEST_DOWNLOADS_DIR, 'typical_doctors_prescription.jpg');
const SAMPLE_PDF = path.join(TEST_DOWNLOADS_DIR, 'sample_prescription_medicare_act.pdf');

async function testUploadFeatures() {
  console.log('🚀 Bắt đầu kiểm thử toàn diện các chức năng Upload Ảnh & PDF...');
  console.log(`- Ảnh 1 (Wikimedia): ${SAMPLE_IMG_1} (${fs.statSync(SAMPLE_IMG_1).size} bytes)`);
  console.log(`- Ảnh 2 (Wikimedia): ${SAMPLE_IMG_2} (${fs.statSync(SAMPLE_IMG_2).size} bytes)`);
  console.log(`- PDF (Wikimedia): ${SAMPLE_PDF} (${fs.statSync(SAMPLE_PDF).size} bytes)`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    permissions: ['microphone']
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 [BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    // 1. Đăng nhập
    console.log(`\n[BƯỚC 1] Mở ứng dụng tại ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    const loginBtn = page.locator('button:has-text("Đăng nhập")');
    if (await loginBtn.isVisible()) {
      console.log('🔑 Đăng nhập Bác sĩ...');
      await page.locator('input[placeholder="Tên đăng nhập"]').fill('bac_si_test');
      await page.locator('input[placeholder="Mật khẩu"]').fill('Doctor@2026!');
      await loginBtn.click();
      await page.waitForTimeout(3000);
    }

    // -------------------------------------------------------------
    // CHỨC NĂNG 1: Trợ lý AI Copilot - Upload Ảnh Đơn Thuốc (ImageModal)
    // -------------------------------------------------------------
    console.log('\n[CHỨC NĂNG 1] Kiểm tra upload ảnh đơn thuốc vào Trợ lý AI Copilot...');
    const launcher = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
    await launcher.click();
    await page.waitForTimeout(1000);

    const imageIconBtn = page.locator('button[title*="Đính kèm ảnh"]').first();
    if (await imageIconBtn.isVisible()) {
      console.log('🖼️ Bấm mở ImageModal...');
      await imageIconBtn.click();
      await page.waitForTimeout(1000);

      const fileInput = page.locator('input[type="file"]').first();
      console.log(`📤 Đang chọn tệp ảnh đơn thuốc: ${SAMPLE_IMG_1}...`);
      await fileInput.setInputFiles(SAMPLE_IMG_1);
      await page.waitForTimeout(2000);

      // Chụp ảnh preview modal
      const modalScreenshot = path.join(SCREENSHOTS_DIR, 'upload_01_copilot_image_modal_preview.png');
      await page.screenshot({ path: modalScreenshot });
      console.log(`📸 Đã chụp preview ImageModal: ${modalScreenshot}`);

      const sendImageBtn = page.locator('button:has-text("Gửi ảnh"), button:has-text("Gửi yêu cầu")').first();
      if (await sendImageBtn.isVisible()) {
        console.log('🚀 Bấm gửi ảnh vào khung chat...');
        await sendImageBtn.click();
        await page.waitForTimeout(8000);
      }

      const chatWithImageScreenshot = path.join(SCREENSHOTS_DIR, 'upload_02_copilot_chat_image_sent.png');
      await page.screenshot({ path: chatWithImageScreenshot });
      console.log(`📸 Đã chụp kết quả gửi ảnh vào chat: ${chatWithImageScreenshot}`);
    } else {
      console.log('⚠️ Không tìm thấy nút mở ImageModal');
    }

    // -------------------------------------------------------------
    // CHỨC NĂNG 2: Giám định BHYT - Upload Đơn Thuốc / PDF để OCR bóc tách
    // -------------------------------------------------------------
    console.log('\n[CHỨC NĂNG 2] Kiểm tra upload đơn thuốc trong phân hệ Giám định BHYT...');
    const bhytTab = page.locator('button:has-text("Giám định BHYT"), div:has-text("Giám định BHYT")').first();
    if (await bhytTab.isVisible()) {
      await bhytTab.click();
      await page.waitForTimeout(1500);

      // Tìm input file trong tab BHYT
      const bhytFileInput = page.locator('input[type="file"][accept*="image"]').first();
      if (await bhytFileInput.count() > 0) {
        console.log(`📤 Đang tải ảnh đơn thuốc vào Giám định BHYT: ${SAMPLE_IMG_2}...`);
        await bhytFileInput.setInputFiles(SAMPLE_IMG_2);
        await page.waitForTimeout(2000);

        const analyzeBtn = page.locator('button:has-text("Phân tích"), button:has-text("Phân tích đơn")').first();
        if (await analyzeBtn.isVisible()) {
          console.log('🔍 Bấm nút Phân tích đơn thuốc OCR...');
          await analyzeBtn.click();
          await page.waitForTimeout(5000);
        }

        const bhytScreenshot = path.join(SCREENSHOTS_DIR, 'upload_03_bhyt_audit_ocr_upload.png');
        await page.screenshot({ path: bhytScreenshot });
        console.log(`📸 Đã chụp kết quả upload BHYT: ${bhytScreenshot}`);
      } else {
        console.log('⚠️ Không tìm thấy input file trong tab BHYT');
      }
    }

    // -------------------------------------------------------------
    // CHỨC NĂNG 3: Thư viện Tài liệu Y tế - Upload PDF
    // -------------------------------------------------------------
    console.log('\n[CHỨC NĂNG 3] Kiểm tra Thư viện Tài liệu Y tế...');
    const docTab = page.locator('button:has-text("Tài liệu"), div:has-text("Tài liệu")').first();
    if (await docTab.isVisible()) {
      await docTab.click();
      await page.waitForTimeout(1500);

      const docFileInput = page.locator('input[type="file"][accept*="pdf"]').first();
      if (await docFileInput.count() > 0) {
        console.log(`📤 Đang tải tệp PDF vào thư viện: ${SAMPLE_PDF}...`);
        await docFileInput.setInputFiles(SAMPLE_PDF);
        await page.waitForTimeout(3000);
      }

      const docScreenshot = path.join(SCREENSHOTS_DIR, 'upload_04_documents_library_pdf.png');
      await page.screenshot({ path: docScreenshot });
      console.log(`📸 Đã chụp kết quả Tài liệu: ${docScreenshot}`);
    }

  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
  } finally {
    await browser.close();
  }

  console.log('\n🎉 Hoàn thành kiểm thử upload ảnh & PDF!');
}

testUploadFeatures().catch(console.error);
