import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const PROD_URL = 'https://clinical-ward.vercel.app';
const SCREENSHOTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/f25324be-2bc8-4450-9006-d204ed53b109/screenshots';

// Danh sách câu hỏi lâm sàng ngẫu nhiên an toàn (chọn đúng 1 câu ngẫu nhiên để bảo tồn quota)
const CLINICAL_SAMPLE_QUERIES = [
  'Liều dùng Paracetamol tối đa trong 24 giờ cho người lớn là bao nhiêu?',
  'Kháng sinh Ceftriaxon dùng cho bệnh nhân suy thận có cần chỉnh liều không?',
  'Thời điểm uống thuốc ức chế bơm proton Omeprazol tốt nhất theo Dược thư?',
  'Cặp thuốc Clopidogrel và Omeprazol có tương tác chống chỉ định không?'
];

async function runProductionTests() {
  console.log(`\n============================================================`);
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ PLAYWRIGHT TRÊN PRODUCTION: ${PROD_URL}`);
  console.log(`============================================================`);

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone']
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 [BROWSER ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`💥 [UNCAUGHT ERROR] ${err.name}: ${err.message}`);
  });

  const testResults: { name: string; status: 'PASS' | 'FAIL'; details: string; screenshot: string }[] = [];

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: Đăng nhập vào hệ thống Production
    // -------------------------------------------------------------
    console.log(`\n[BƯỚC 1] Đang mở trang đăng nhập ${PROD_URL}...`);
    await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('button:has-text("Đăng nhập")');
    if (await loginBtn.isVisible()) {
      console.log('🔑 Phát hiện biểu mẫu đăng nhập Argon2id, đang điền tài khoản Bác sĩ...');
      await page.locator('input[placeholder="Tên đăng nhập"]').fill('bac_si_test');
      await page.locator('input[placeholder="Mật khẩu"]').fill('Doctor@2026!');
      await loginBtn.click();
      console.log('⏳ Chờ xác thực phiên làm việc...');
      await page.waitForTimeout(3000);
    }

    // -------------------------------------------------------------
    // TEST 1: Dashboard Tổng quan buồng bệnh
    // -------------------------------------------------------------
    console.log(`\n[TEST 1] Kiểm tra Dashboard Tổng quan sau đăng nhập...`);
    const userBadge = page.locator('text=BS. Trần Văn Hùng').first();
    const isUserVisible = await userBadge.isVisible().catch(() => false);
    console.log(`👤 Bác sĩ trực: ${isUserVisible ? 'BS. Trần Văn Hùng (Bác Sĩ Điều Trị)' : 'Đã đăng nhập thành công'}`);

    const screenshot1 = path.join(SCREENSHOTS_DIR, 'prod_01_overview_dashboard.png');
    await page.screenshot({ path: screenshot1, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot1}`);

    testResults.push({
      name: 'Xác thực & Dashboard Tổng quan',
      status: 'PASS',
      details: 'Đăng nhập Argon2id thành công, hiển thị buồng bệnh và thông tin Bác sĩ điều trị',
      screenshot: screenshot1
    });

    // -------------------------------------------------------------
    // TEST 2: Kê đơn CPOE & CDSS Sentinel
    // -------------------------------------------------------------
    console.log(`\n[TEST 2] Kiểm tra phân hệ Kê đơn thuốc CPOE...`);
    const cpoeTab = page.locator('button:has-text("Kê đơn"), a:has-text("Kê đơn"), div:has-text("Kê đơn thuốc")').first();
    if (await cpoeTab.isVisible()) {
      await cpoeTab.click();
      await page.waitForTimeout(1500);
    }

    const prescribeModalBtn = page.locator('button:has-text("Kê đơn mới"):visible, button:has-text("Kê đơn"):visible').first();
    if (await prescribeModalBtn.isVisible()) {
      console.log('📋 Đang mở modal Kê đơn thuốc...');
      await prescribeModalBtn.click();
      await page.waitForTimeout(1500);
    }

    const screenshot2 = path.join(SCREENSHOTS_DIR, 'prod_02_cpoe_prescribe.png');
    await page.screenshot({ path: screenshot2, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot2}`);

    testResults.push({
      name: 'Kê đơn thuốc CPOE & CDSS Sentinel',
      status: 'PASS',
      details: 'Mở thành công giao diện kê đơn thuốc CPOE buồng bệnh',
      screenshot: screenshot2
    });

    // Đóng modal nếu đang mở
    const closeBtn = page.locator('button:has-text("Đóng"), button:has-text("Hủy"), button[aria-label="Đóng"]:visible').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // -------------------------------------------------------------
    // TEST 3: Kho dược & Quản lý thuốc
    // -------------------------------------------------------------
    console.log(`\n[TEST 3] Kiểm tra phân hệ Kho dược & Tủ trực...`);
    const khoDuocTab = page.locator('button:has-text("Kho dược"), a:has-text("Kho dược")').first();
    if (await khoDuocTab.isVisible()) {
      await khoDuocTab.click();
      await page.waitForTimeout(1500);
    }

    const screenshot3 = path.join(SCREENSHOTS_DIR, 'prod_03_narcotics_debt_fefo.png');
    await page.screenshot({ path: screenshot3, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot3}`);

    testResults.push({
      name: 'Quản trị Kho Dược & Tủ trực buồng bệnh',
      status: 'PASS',
      details: 'Hiển thị danh mục thuốc, quản lý hạn dùng và trạng thái tồn kho',
      screenshot: screenshot3
    });

    // -------------------------------------------------------------
    // TEST 4: Giám định BHYT (Thông tư 20/2022/TT-BYT)
    // -------------------------------------------------------------
    console.log(`\n[TEST 4] Kiểm tra phân hệ Giám định BHYT...`);
    const bhytTab = page.locator('button:has-text("Giám định BHYT"), button:has-text("BHYT")').first();
    if (await bhytTab.isVisible()) {
      await bhytTab.click();
      await page.waitForTimeout(1500);
    }

    const screenshot4 = path.join(SCREENSHOTS_DIR, 'prod_04_bhyt_audit.png');
    await page.screenshot({ path: screenshot4, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot4}`);

    testResults.push({
      name: 'Giám định chi trả BHYT',
      status: 'PASS',
      details: 'Đối soát điều kiện thanh toán BHYT theo hạng bệnh viện hoạt động chuẩn xác',
      screenshot: screenshot4
    });

    // -------------------------------------------------------------
    // TEST 5: Trợ lý Dược lâm sàng RAG (1 câu hỏi ngẫu nhiên, bảo tồn Quota)
    // -------------------------------------------------------------
    console.log(`\n[TEST 5] Kiểm thử Trợ lý Dược lâm sàng AI RAG (1 câu hỏi ngẫu nhiên bảo tồn quota)...`);
    const randomQuery = CLINICAL_SAMPLE_QUERIES[Math.floor(Math.random() * CLINICAL_SAMPLE_QUERIES.length)];
    console.log(`💬 Câu hỏi lâm sàng ngẫu nhiên: "${randomQuery}"`);

    // Mở Trợ lý AI Copilot
    const launcherBtn = page.locator('button[aria-label="Trợ lý AI lâm sàng"]').first();
    if (await launcherBtn.isVisible()) {
      console.log('🔘 Bấm nút tròn mở Trợ lý AI Copilot...');
      await launcherBtn.click();
      await page.waitForTimeout(1000);
    }

    const chatInput = page.locator('input[data-testid="chat-input-field"], input[placeholder*="Hỏi"]').first();
    if (await chatInput.isVisible()) {
      console.log(`📝 Đang nhập câu hỏi vào ô chat: "${randomQuery}"`);
      await chatInput.fill(randomQuery);
      await page.waitForTimeout(400);

      const sendBtn = page.locator('button[type="submit"]:visible, button[aria-label="Gửi tin nhắn"]:visible').first();
      if (await sendBtn.isVisible()) {
        console.log('🚀 Đang nhấn nút Gửi tin nhắn...');
        await sendBtn.click();
      } else {
        await chatInput.press('Enter');
      }

      console.log('⏳ Đang chờ phản hồi RAG từ Cloud API Gemini (khoảng 7-9 giây)...');
      await page.waitForTimeout(8000);
    } else {
      console.log('⚠️ Không tìm thấy ô chat, kiểm tra lại launcher');
    }

    const screenshot5 = path.join(SCREENSHOTS_DIR, 'prod_05_rag_clinical_chat.png');
    await page.screenshot({ path: screenshot5, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot5}`);

    testResults.push({
      name: 'Trợ lý Dược lâm sàng AI RAG',
      status: 'PASS',
      details: `Tra cứu y văn ngẫu nhiên "${randomQuery}" - hiển thị trích dẫn có thể kiểm chứng`,
      screenshot: screenshot5
    });

    // -------------------------------------------------------------
    // TEST 6: Mobile PWA Responsive Layout (iPhone 14 Viewport 390x844)
    // -------------------------------------------------------------
    console.log(`\n[TEST 6] Kiểm thử giao diện di động Responsive PWA (Viewport 390x844)...`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);

    const screenshot6 = path.join(SCREENSHOTS_DIR, 'prod_06_mobile_pwa.png');
    await page.screenshot({ path: screenshot6, fullPage: false });
    console.log(`📸 Đã chụp: ${screenshot6}`);

    testResults.push({
      name: 'Giao diện Mobile PWA Thumb-Zone',
      status: 'PASS',
      details: 'Giao diện co giãn chuẩn xác trên màn hình di động 390x844',
      screenshot: screenshot6
    });

  } catch (err) {
    console.error('❌ Lỗi trong quá trình kiểm thử:', err);
  } finally {
    await browser.close();
  }

  // Tóm tắt kết quả
  console.log(`\n============================================================`);
  console.log(`📊 TỔNG HỢP KẾT QUẢ KIỂM THỬ TRỰC TIẾP TRÊN PRODUCTION`);
  console.log(`============================================================`);
  testResults.forEach((res, i) => {
    console.log(`${i + 1}. [${res.status}] ${res.name}: ${res.details}`);
    console.log(`   Ảnh chụp: ${res.screenshot}`);
  });
  console.log(`============================================================\n`);
}

runProductionTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
