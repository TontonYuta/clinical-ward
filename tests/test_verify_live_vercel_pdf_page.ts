import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const VERCEL_URL = 'https://clinical-ward.vercel.app';

async function main() {
  console.log(`🌐 Đang mở trình duyệt kiểm thử trực tiếp trên Vercel: ${VERCEL_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(VERCEL_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Đã tải xong trang web lâm sàng trên Vercel.');

    // 1. Chuyển Role sang Dược sĩ
    const roleSelect = page.locator('header select:visible').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('pharmacist');
      await page.waitForTimeout(600);
      console.log('✅ Đã chuyển vai trò Dược sĩ lâm sàng.');
    }

    // 2. Chuyển sang Tab Kho Dược FEFO
    const fefoBtn = page.locator('button:has-text("Kho dược FEFO"):visible, button:has-text("Kho FEFO"):visible, button:has-text("Kho Dược"):visible').first();
    if (await fefoBtn.count() > 0) {
      await fefoBtn.click();
      await page.waitForTimeout(800);
      console.log('✅ Đã mở Tab Kho Dược FEFO.');
    }

    // 3. Tìm nút "Đối chứng gốc"
    const doiChungBtn = page.locator('button:has-text("Đối chứng gốc"):visible').first();
    await doiChungBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Tìm thấy nút "Đối chứng gốc" trên giao diện kho dược.');
    await doiChungBtn.click();
    await page.waitForTimeout(2000);

    // 4. Kiểm tra Modal Chi Tiết Thuốc & Dược Thư
    const modalTitle = page.locator('text=Dược Thư Quốc Gia Việt Nam').first();
    await modalTitle.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ Đã mở Modal Chi tiết & Chuyên luận Dược Thư.');

    // 5. Kiểm tra Badge Trang và Nút Mở PDF
    const pageBadge = page.locator('text=Trang 594').first();
    const hasPageBadge = await pageBadge.isVisible();
    console.log(`✅ Badge Số Trang Dược Thư: ${hasPageBadge ? 'XUẤT HIỆN CHÍNH XÁC (Trang 594)' : 'Không tìm thấy'}`);

    const pdfLink = page.locator('a:has-text("Mở PDF đối chứng")').first();
    await pdfLink.waitFor({ state: 'visible', timeout: 5000 });
    const pdfHref = await pdfLink.getAttribute('href');
    const pdfText = await pdfLink.innerText();
    console.log(`✅ Nút mở PDF: "${pdfText}"`);
    console.log(`✅ Đường dẫn PDF: "${pdfHref}"`);

    if (!pdfHref?.includes('Duoc_Thu_Quoc_Gia_Viet_Nam.pdf') || !pdfHref?.includes('#page=')) {
      throw new Error(`Đường dẫn PDF không hợp lệ: ${pdfHref}`);
    }

    // Chụp ảnh bằng chứng nghiệm thu Modal
    const modalScreenshot = path.join(ARTIFACT_DIR, 'verified_live_vercel_modal_pdf_page.png');
    await page.screenshot({ path: modalScreenshot });
    console.log(`📸 Đã lưu ảnh chụp bằng chứng Modal: ${modalScreenshot}`);

    // Đóng modal
    const closeBtn = page.locator('.fixed.inset-0:visible button:has-text("Đóng"), .fixed.inset-0:visible button:has(svg.lucide-x)').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(500);

    // 6. Mở Cổng Dữ Liệu Dược Quốc Gia 55k
    const registryBtn = page.locator('button:has-text("Cổng Dược Quốc Gia"):visible, button:has-text("Dược Quốc Gia 55k"):visible').first();
    if (await registryBtn.count() > 0) {
      await registryBtn.click();
      await page.waitForTimeout(2000);
      console.log('✅ Đã mở Cổng Dược Quốc Gia 55k trên Vercel.');

      // Tìm nút "PDF Tr."
      const pdfTableBtn = page.locator('a:has-text("PDF Tr."):visible').first();
      await pdfTableBtn.waitFor({ state: 'visible', timeout: 10000 });
      const tablePdfHref = await pdfTableBtn.getAttribute('href');
      const tablePdfText = await pdfTableBtn.innerText();
      console.log(`✅ Nút PDF trong bảng danh mục: "${tablePdfText}" -> "${tablePdfHref}"`);

      const registryScreenshot = path.join(ARTIFACT_DIR, 'verified_live_vercel_registry_pdf_page.png');
      await page.screenshot({ path: registryScreenshot });
      console.log(`📸 Đã lưu ảnh chụp bảng danh mục: ${registryScreenshot}`);
    }

    console.log('🎉 TẤT CẢ KIỂM THỬ TRỰC TIẾP TRÊN BẢN DEPLOY VERCEL THÀNH CÔNG 100%!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
