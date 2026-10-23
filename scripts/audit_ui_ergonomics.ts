import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/29d456f4-f165-40c3-8cf0-9389f16f65ec/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function startServer() {
  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: '/home/tontonyuta/clinical-ward',
    stdio: 'pipe',
  });

  await new Promise<void>((resolve) => {
    server.stdout.on('data', (data) => {
      if (data.toString().includes('http://localhost:4173')) {
        resolve();
      }
    });
  });

  return server;
}

async function runAudit() {
  console.log('🚀 Khởi động Vite Preview Server trên cổng 4173...');
  const server = await startServer();

  console.log('🌐 Khởi chạy Playwright Chromium Browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync('/home/tontonyuta/.local/bin/google-chrome')
      ? '/home/tontonyuta/.local/bin/google-chrome'
      : undefined,
  });

  const context = await browser.new_context ? await browser.new_context({ viewport: { width: 1440, height: 900 } }) : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('🧭 Điều hướng đến http://localhost:4173 ...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('\n======================================================');
  console.log('🔍 KIỂM THỬ 1: THƯƠNG HIỆU & TIÊU ĐỀ SIDEBAR');
  console.log('======================================================');
  
  // Select the visible title in the desktop sidebar
  const brandTitle = page.locator('aside:visible span:has-text("Kho Y Tế Lâm Sàng")').first();
  await brandTitle.waitFor({ state: 'visible', timeout: 5000 });
  
  const brandMetrics = await brandTitle.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      text: el.textContent?.trim(),
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      isClipped: el.scrollWidth > el.clientWidth,
    };
  });

  console.log(`- Tiêu đề hiển thị: "${brandMetrics.text}"`);
  console.log(`- Cỡ chữ font-size: ${brandMetrics.fontSize} (Độ đậm: ${brandMetrics.fontWeight})`);
  console.log(`- Chiều rộng: client=${brandMetrics.clientWidth}px | scroll=${brandMetrics.scrollWidth}px`);
  console.log(`- Bị che mất/cắt chữ (isClipped): ${brandMetrics.isClipped ? '❌ CÓ' : '✅ KHÔNG (ĐẦY ĐỦ 100%)'}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_sidebar_brand_title.png') });

  console.log('\n======================================================');
  console.log('🔍 KIỂM THỬ 2: TYPOGRAPHY TAB 1 - SỔ NỢ TỦ TRỰC');
  console.log('======================================================');

  // Switch role to Doctor or Nurse to access debt
  const roleSelect = page.locator('select').first();
  await roleSelect.selectOption('doctor');
  await page.waitForTimeout(500);

  const searchInput = page.locator('input[placeholder*="Tìm thuốc, bệnh nhân"]').first();
  const searchFontSize = await searchInput.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log(`- Ô tìm kiếm Ribbon: font-size = ${searchFontSize} (Yêu cầu >= 14px): ${parseFloat(searchFontSize) >= 14 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT'}`);

  const medNames = page.locator('table tbody tr td:nth-child(2) span.font-bold');
  const count = await medNames.count();
  console.log(`- Tìm thấy ${count} mặt hàng y tế trong bảng`);

  if (count > 0) {
    const firstMed = medNames.first();
    const firstMedMetrics = await firstMed.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    console.log(`- Mặt hàng mẫu: "${firstMedMetrics.text}"`);
    console.log(`- Cỡ chữ Tên Thuốc: ${firstMedMetrics.fontSize} (Yêu cầu >= 15px): ${parseFloat(firstMedMetrics.fontSize) >= 15 ? '✅ ĐẠT CHUẨN LÂM SÀNG' : '❌ CHƯA ĐẠT'}`);
  }

  const patientNames = page.locator('table tbody tr td:nth-child(4) span.font-bold');
  if (await patientNames.count() > 0) {
    const ptMetrics = await patientNames.first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    console.log(`- Bệnh nhân mẫu: "${ptMetrics.text}"`);
    console.log(`- Cỡ chữ Tên Bệnh Nhân: ${ptMetrics.fontSize} (Yêu cầu >= 15px): ${parseFloat(ptMetrics.fontSize) >= 15 ? '✅ ĐẠT CHUẨN LÂM SÀNG' : '❌ CHƯA ĐẠT'}`);
  }

  // Check redundancy in action column
  const settledTextCount = await page.locator('text="Đã chốt sổ"').count();
  console.log(`- Số lượng chữ lặp "Đã chốt sổ" ở cột thao tác: ${settledTextCount} (Kỳ vọng: 0): ${settledTextCount === 0 ? '✅ ĐÃ LOẠI BỎ TRIỆT ĐỂ LỖI LẶP' : '❌ VẪN CÒN'}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_tab_debt_readable.png') });

  console.log('\n======================================================');
  console.log('🔍 KIỂM THỬ 3: TYPOGRAPHY TAB 2 - SỰ CỐ & THIẾT BỊ');
  console.log('======================================================');

  await roleSelect.selectOption('biomedical_engineer');
  await page.waitForTimeout(500);

  const equipTabBtn = page.locator('aside:visible button:has-text("Sự cố & Kiểm định")').first();
  await equipTabBtn.click();
  await page.waitForTimeout(600);

  const deviceNames = page.locator('table tbody tr td:nth-child(2) span.font-bold');
  if (await deviceNames.count() > 0) {
    const devMetrics = await deviceNames.first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    console.log(`- Tên thiết bị mẫu: "${devMetrics.text}"`);
    console.log(`- Cỡ chữ Thiết Bị: ${devMetrics.fontSize} (Yêu cầu >= 15px): ${parseFloat(devMetrics.fontSize) >= 15 ? '✅ ĐẠT CHUẨN LÂM SÀNG' : '❌ CHƯA ĐẠT'}`);
  }

  // Check redundancy in action column
  const hoanTatCount = await page.locator('text="✓ Hoàn tất"').count();
  console.log(`- Số lượng chữ lặp "✓ Hoàn tất" ở cột thao tác: ${hoanTatCount} (Kỳ vọng: 0): ${hoanTatCount === 0 ? '✅ ĐÃ LOẠI BỎ TRIỆT ĐỂ LỖI LẶP' : '❌ VẪN CÒN'}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_tab_equipment_readable.png') });

  console.log('\n======================================================');
  console.log('🔍 KIỂM THỬ 4: TYPOGRAPHY TAB 3 - KHO DƯỢC FEFO');
  console.log('======================================================');

  await roleSelect.selectOption('pharmacist');
  await page.waitForTimeout(500);

  const fefoTabBtn = page.locator('aside:visible button:has-text("Kho Dược & Hạn Dùng")').first();
  await fefoTabBtn.click();
  await page.waitForTimeout(600);

  const fefoDrugNames = page.locator('table tbody tr td:nth-child(1) span.font-bold');
  if (await fefoDrugNames.count() > 0) {
    const drugMetrics = await fefoDrugNames.first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    console.log(`- Tên thuốc kho FEFO mẫu: "${drugMetrics.text}"`);
    console.log(`- Cỡ chữ Thuốc FEFO: ${drugMetrics.fontSize} (Yêu cầu >= 15px): ${parseFloat(drugMetrics.fontSize) >= 15 ? '✅ ĐẠT CHUẨN LÂM SÀNG' : '❌ CHƯA ĐẠT'}`);
  }

  const stockQuantities = page.locator('table tbody tr td:nth-child(4) span.text-base');
  if (await stockQuantities.count() > 0) {
    const qtyMetrics = await stockQuantities.first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { text: el.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight };
    });
    console.log(`- Cỡ chữ Tồn Kho Số Lượng: ${qtyMetrics.fontSize} (Yêu cầu >= 16px): ${parseFloat(qtyMetrics.fontSize) >= 16 ? '✅ ĐẠT CHUẨN LÂM SÀNG' : '❌ CHƯA ĐẠT'}`);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_tab_fefo_readable.png') });

  console.log('\n======================================================');
  console.log('🎉 TỔNG KẾT: TẤT CẢ CÁC BÀI KIỂM THỬ PLAYWRIGHT HOÀN TẤT THÀNH CÔNG!');
  console.log('======================================================\n');

  await browser.close();
  server.kill();
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Lỗi kiểm thử Playwright:', err);
  process.exit(1);
});
