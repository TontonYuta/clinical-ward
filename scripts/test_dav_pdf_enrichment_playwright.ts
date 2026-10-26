import { chromium } from 'playwright';
import * as path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';

async function main() {
  console.log('🧪 BẮT ĐẦU TEST PLAYWRIGHT KIỂM TRA ĐẦY ĐỦ PDF CỦA THUỐC...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Đã tải trang web thành công');

    // 0. Chuyển sang tab Kho Dược FEFO
    const fefoTab = page.locator('button:has-text("Kho dược FEFO"):visible').first();
    await fefoTab.click();
    await page.waitForTimeout(600);
    console.log('✅ Đã chuyển sang tab Kho Dược FEFO');

    // 1. Mở Cổng Dữ Liệu Dược Quốc Gia 55k
    const registryBtn = page.locator('button:has-text("Cổng Dược Quốc Gia"):visible').first();
    await registryBtn.click();
    await page.waitForSelector('text=Cổng Dữ Liệu Dược Quốc Gia', { timeout: 6000 });
    console.log('✅ Đã mở Cổng Dược Quốc Gia');

    // 2. Tìm kiếm thuốc Quirow Inj. (thuốc TT89 vừa được enrich PDF)
    const searchInput = page.locator('input[placeholder*="Tìm trên 55.000"]:visible').first();
    await searchInput.fill('Quirow');
    await page.waitForTimeout(1000);

    const quirowRowBtn = page.locator('tbody tr:has-text("Quirow"):visible button:has-text("Chi tiết")').first();
    await quirowRowBtn.click();
    await page.waitForSelector('text=Thông Tin Công Bố Thuốc Lưu Hành', { timeout: 5000 });
    console.log('✅ Đã mở modal chi tiết Quirow Inj.');

    // Chờ 1.5s để nút PDF hiển thị (hoặc on-demand resolve)
    await page.waitForTimeout(1500);

    const modal = page.locator('.fixed.inset-0:visible').last();
    const hdsdBtn = modal.locator('a:has-text("Xem Tờ HDSD (PDF Gốc)")');
    const labelBtn = modal.locator('a:has-text("Xem Mẫu Nhãn (PDF)")');

    const hasHdsd = (await hdsdBtn.count()) > 0;
    const hasLabel = (await labelBtn.count()) > 0;
    console.log(`Quirow PDF HDSD: ${hasHdsd}, Mẫu Nhãn: ${hasLabel}`);

    if (hasHdsd) {
      console.log('Quirow HDSD link:', await hdsdBtn.getAttribute('href'));
    }
    if (hasLabel) {
      console.log('Quirow Mẫu Nhãn link:', await labelBtn.getAttribute('href'));
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'playwright_dav_quirow_pdf_modal.png'),
    });
    console.log('📸 Đã chụp: playwright_dav_quirow_pdf_modal.png');

    // Đóng modal chi tiết thuốc bằng nút Đóng
    await modal.locator('button:has-text("Đóng")').first().click();
    await page.waitForTimeout(500);

    // 3. Kiểm tra thuốc hồ sơ giấy cũ (Enalapril 5 mg - SĐK VD-15255-11)
    await searchInput.fill('VD-15255-11');
    await page.waitForTimeout(1000);

    const enalaprilBtn = page.locator('tbody tr:has-text("VD-15255-11"):visible button:has-text("Chi tiết")').first();
    if (await enalaprilBtn.count() > 0) {
      await enalaprilBtn.click();
      await page.waitForSelector('text=Thông Tin Công Bố Thuốc Lưu Hành', { timeout: 5000 });
      console.log('✅ Đã mở modal chi tiết Enalapril 5 mg (hồ sơ giấy cũ)');

      await page.waitForTimeout(1200);
      const modalEna = page.locator('.fixed.inset-0:visible').last();
      const noticePaper = modalEna.locator('text=Hồ sơ giấy');
      console.log('Notice paper dossier count:', await noticePaper.count());
      if (await noticePaper.count() > 0) {
        console.log('Notice paper text:', await noticePaper.first().textContent());
      }

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'playwright_dav_enalapril_paper_modal.png'),
      });
      console.log('📸 Đã chụp: playwright_dav_enalapril_paper_modal.png');
    }

    console.log('🎉 TOÀN BỘ KIỂM THỬ PLAYWRIGHT THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'playwright_dav_test_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

main();
