import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACT_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/6e4038e2-8996-4f83-8957-99a20694c354';
const TARGET_DEST = path.resolve(__dirname, '../backend/data/knowledge_base/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf');

async function main() {
  console.log('🚀 KHỞI ĐỘNG PLAYWRIGHT ĐỂ KIỂM ĐỊNH & TẢI DƯỢC THƯ QUỐC GIA VIỆT NAM...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true
  });

  const page = await context.newPage();

  // 1. Truy cập trang tải của thuvienyhoc.org
  console.log('\n--- BƯỚC 1: TRUY CẬP THUVIENYHOC.ORG ---');
  const targetUrl = 'https://thuvienyhoc.org/duoc-thu-quoc-gia-viet-nam/download/?link=1';
  console.log('Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const pageTitle = await page.title();
  console.log('Tiêu đề trang:', pageTitle);
  const screenshot1 = path.join(ARTIFACT_DIR, 'playwright_thuvienyhoc_download_page.png');
  await page.screenshot({ path: screenshot1 });
  console.log('📸 Đã chụp màn hình trang tải:', screenshot1);

  // Tìm link Google Drive từ nội dung trang
  const html = await page.content();
  const match = html.match(/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Không tìm thấy link Google Drive trên trang!');
  }
  const fileId = match[1];
  const gdriveUrl = `https://drive.google.com/file/d/${fileId}/view`;
  console.log(`✅ Tìm thấy Google Drive File ID: ${fileId}`);
  console.log('Google Drive URL:', gdriveUrl);

  // 2. Mở trang Google Drive
  console.log('\n--- BƯỚC 2: MỞ TRANG XEM TRƯỚC GOOGLE DRIVE ---');
  await page.goto(gdriveUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const gdriveTitle = await page.title();
  console.log('Tiêu đề Google Drive:', gdriveTitle);
  const screenshot2 = path.join(ARTIFACT_DIR, 'playwright_gdrive_duoc_thu_preview.png');
  await page.screenshot({ path: screenshot2 });
  console.log('📸 Đã chụp màn hình Google Drive:', screenshot2);

  // 3. Thực hiện tải tệp từ Google Drive
  console.log('\n--- BƯỚC 3: KÍCH HOẠT QUÁ TRÌNH TẢI TỆP ---');
  const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log('Direct download endpoint:', directDownloadUrl);

  // Lắng nghe sự kiện download
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await page.goto(directDownloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  let download = await downloadPromise;

  // Nếu Google Drive hiện trang cảnh báo tệp quá lớn không thể quét virus
  if (!download) {
    console.log('Kiểm tra nút "Vẫn tải xuống" (Download anyway) trên Google Drive...');
    const downloadAnywayBtn = page.locator('input#uc-download-link, a#uc-download-link, button#uc-download-link, input[value*="tải xuống"], a:has-text("Vẫn tải xuống"), a:has-text("Download anyway")');
    if (await downloadAnywayBtn.count() > 0) {
      console.log('Tìm thấy nút xác nhận tải xuống, đang bấm...');
      const downloadPromise2 = page.waitForEvent('download', { timeout: 60000 });
      await downloadAnywayBtn.first().click();
      download = await downloadPromise2;
    }
  }

  if (download) {
    const suggestedFilename = download.suggestedFilename();
    console.log(`📦 Bắt đầu nhận luồng tải tệp: ${suggestedFilename}`);
    await download.saveAs(TARGET_DEST);
    const stats = fs.statSync(TARGET_DEST);
    console.log(`✅ TẢI THÀNH CÔNG: ${TARGET_DEST} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    console.log('Chụp ảnh màn hình trang xác nhận tải nếu có lỗi:');
    const screenshotErr = path.join(ARTIFACT_DIR, 'playwright_gdrive_download_page.png');
    await page.screenshot({ path: screenshotErr });
    console.log('📸 Đã chụp màn hình:', screenshotErr);
  }

  await browser.close();
  console.log('🏁 HOÀN TẤT BƯỚC THU THẬP BẰNG PLAYWRIGHT!');
}

main().catch(err => {
  console.error('❌ LỖI PLAYWRIGHT:', err);
  process.exit(1);
});
