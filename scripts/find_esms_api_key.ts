import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312';
const USER_DATA_DIR = path.join(process.cwd(), '.esms_browser_profile');

async function main() {
  console.log('🚀 Đang mở trình duyệt Playwright để truy cập https://account.esms.vn/SMS/SMSManager...');
  
  // Mở trình duyệt dạng Persistent Context để lưu session nếu cần
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log('🌐 Đang kết nối tới https://account.esms.vn/SMS/SMSManager ...');
  await page.goto('https://account.esms.vn/SMS/SMSManager', { waitUntil: 'domcontentloaded' });

  // Kiểm tra nếu đang ở trang đăng nhập
  if (page.url().includes('SignIn') || page.url().includes('Login')) {
    console.log('================================================================');
    console.log('👉 VUI LÒNG ĐĂNG NHẬP TRÊN CỬA SỔ TRÌNH DUYỆT VỪA MỞ TRÊN MÀN HÌNH');
    console.log('   (Hệ thống đang chờ bạn đăng nhập thành công...)');
    console.log('================================================================');

    // Chờ người dùng đăng nhập xong (URL chuyển hướng khỏi SignIn)
    await page.waitForURL((url) => !url.href.includes('SignIn') && !url.href.includes('Login'), {
      timeout: 180000 // 3 phút để người dùng đăng nhập
    });
    console.log('🎉 Đăng nhập thành công! Đang chuyển hướng vào bảng điều khiển...');
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  console.log(`📍 URL hiện tại: ${page.url()}`);
  await page.waitForTimeout(2000);

  // 1. Tìm kiếm menu hoặc liên kết "Quản lý API" hoặc "API"
  console.log('🔍 Đang rà soát menu và các mục liên kết để tìm trang "Quản lý API"...');
  
  const allLinks = await page.$$eval('a', (elements) => 
    elements.map((el) => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      href: el.getAttribute('href') || ''
    }))
  );

  const apiLinks = allLinks.filter((l) => 
    /api/i.test(l.text) || 
    /quản lý api/i.test(l.text) || 
    /tích hợp/i.test(l.text) || 
    /kết nối/i.test(l.text) ||
    /api/i.test(l.href)
  );

  console.log('📋 Danh sách liên kết liên quan đến API tìm thấy:', apiLinks);

  // Thử điều hướng hoặc bấm vào menu API
  let navigatedToApi = false;
  if (apiLinks.length > 0) {
    const targetLink = apiLinks.find(l => /quản lý api/i.test(l.text)) || apiLinks[0];
    console.log(`👉 Bấm vào mục API: "${targetLink.text}" (${targetLink.href})`);
    
    try {
      const linkLocator = page.locator(`a:has-text("${targetLink.text}")`).first();
      if (await linkLocator.isVisible()) {
        await linkLocator.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        navigatedToApi = true;
      }
    } catch (e) {
      console.log('Không bấm trực tiếp được link, thử mở URL trực tiếp...');
      if (targetLink.href.startsWith('http')) {
        await page.goto(targetLink.href, { waitUntil: 'networkidle' });
      } else {
        await page.goto(new URL(targetLink.href, page.url()).href, { waitUntil: 'networkidle' });
      }
      navigatedToApi = true;
    }
  }

  // Nếu chưa vào được trang API, thử các URL phổ biến của eSMS
  if (!navigatedToApi) {
    const commonApiUrls = [
      'https://account.esms.vn/Manage/Api',
      'https://account.esms.vn/Api/ManageApi',
      'https://account.esms.vn/Api',
      'https://account.esms.vn/SMS/ApiManager'
    ];
    for (const testUrl of commonApiUrls) {
      console.log(`Thử truy cập: ${testUrl}...`);
      await page.goto(testUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      const title = await page.title();
      if (!title.includes('404') && !title.includes('Error')) {
        console.log(`✅ Truy cập được: ${testUrl} (${title})`);
        break;
      }
    }
  }

  await page.waitForTimeout(2000);
  console.log(`📍 Trang đang dừng: ${page.url()} - Tiêu đề: ${await page.title()}`);

  // Chụp ảnh màn hình lưu vào artifacts
  const screenshotPath = path.join(ARTIFACTS_DIR, 'esms_api_key_page.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Đã chụp ảnh màn hình lưu tại: ${screenshotPath}`);

  // Tìm kiếm giá trị ApiKey và SecretKey trên trang
  const extractedKeys = await page.evaluate(() => {
    const result: { apiKey?: string; secretKey?: string; textSnippets: string[] } = { textSnippets: [] };
    
    // Tìm trong các input / textarea
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    for (const inp of inputs) {
      const val = (inp as HTMLInputElement).value || '';
      const name = inp.getAttribute('name') || '';
      const id = inp.getAttribute('id') || '';
      const placeholder = inp.getAttribute('placeholder') || '';
      
      if (/api.*key/i.test(name) || /api.*key/i.test(id) || /api.*key/i.test(placeholder)) {
        result.apiKey = val;
      }
      if (/secret.*key/i.test(name) || /secret.*key/i.test(id) || /secret.*key/i.test(placeholder)) {
        result.secretKey = val;
      }
    }

    // Tìm trong văn bản text hiển thị
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (/API\s*Key/i.test(lines[i]) || /Secret\s*Key/i.test(lines[i])) {
        result.textSnippets.push(lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join(' | '));
      }
    }

    return result;
  });

  console.log('\n================== KẾT QUẢ TÌM KIẾM KEY ==================');
  console.log('API Key tìm thấy:', extractedKeys.apiKey || '(Chưa tìm thấy tự động trong input)');
  console.log('Secret Key tìm thấy:', extractedKeys.secretKey || '(Chưa tìm thấy tự động trong input)');
  if (extractedKeys.textSnippets.length > 0) {
    console.log('Đoạn văn bản chứa từ khóa API Key trên trang:');
    extractedKeys.textSnippets.forEach(s => console.log(' -', s));
  }
  console.log('=========================================================\n');

  // Đóng trình duyệt sau 10 giây hoặc để người dùng xem
  console.log('Trình duyệt sẽ giữ mở thêm 15 giây để bạn quan sát...');
  await page.waitForTimeout(15000);
  await context.close();
  console.log('Đã đóng trình duyệt.');
}

main().catch((err) => {
  console.error('Lỗi khi chạy Playwright:', err);
  process.exit(1);
});
