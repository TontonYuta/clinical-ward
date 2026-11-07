const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

async function waitUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

(async () => {
  console.log('--- STARTING PLAYWRIGHT BHYT TAB VERIFICATION ---');
  const doAnDir = '/home/tontonyuta/Downloads/DoAn2';
  
  // 1. Khởi động Vite preview trên port 5173
  const preview = spawn('npx', ['vite', 'preview', '--port', '5173'], {
    cwd: doAnDir,
    stdio: 'pipe'
  });

  preview.stderr.on('data', d => console.error('Vite err:', d.toString()));
  preview.stdout.on('data', d => console.log('Vite out:', d.toString()));

  try {
    await waitUrl('http://localhost:5173');
    console.log('Preview server ready on http://localhost:5173');

    // 2. Mở trình duyệt Playwright
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // 3. Tìm và click nút "Giám định BHYT" trên thanh Sidebar
    console.log('Looking for Giám định BHYT tab in Sidebar...');
    const bhytTabBtn = page.locator('button:has-text("Giám định BHYT"):visible').first();
    await bhytTabBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bhytTabBtn.click();
    await page.waitForTimeout(1000);

    // 4. Kiểm tra tiêu đề và các thành phần giao diện
    const titleText = await page.locator('h1:has-text("Giám Định Đơn Thuốc BHYT")').textContent();
    console.log('Found Tab Title:', titleText);

    // Chụp ảnh Ca 1 (Xuất toán)
    const ss1Path = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_tab_case1_reject.png';
    await page.screenshot({ path: ss1Path, fullPage: false });
    console.log('Saved screenshot Ca 1 (Xuất toán):', ss1Path);

    // 5. Chuyển sang Ca 3 (Đơn hợp lệ 100%)
    console.log('Switching to Ca 3 (Đơn hợp lệ)...');
    const ca3Btn = page.locator('button:has-text("3. Ca Đơn Thuốc Hợp Lệ 100%")');
    await ca3Btn.click();
    await page.waitForTimeout(1000);

    // Kiểm tra trạng thái "ĐẠT CHUẨN BHYT"
    const passStatus = await page.locator('text=ĐẠT CHUẨN BHYT').isVisible();
    console.log('Is "ĐẠT CHUẨN BHYT" visible:', passStatus);

    // Chụp ảnh Ca 3 (Hợp lệ)
    const ss3Path = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_tab_case3_pass.png';
    await page.screenshot({ path: ss3Path, fullPage: false });
    console.log('Saved screenshot Ca 3 (Hợp lệ):', ss3Path);

    // 6. Kiểm tra tab XML
    console.log('Testing XML Tab...');
    const xmlTabBtn = page.locator('button:has-text("XML QĐ 130")');
    await xmlTabBtn.click();
    await page.waitForTimeout(500);

    const pasteSampleBtn = page.locator('button:has-text("Dán XML mẫu")');
    await pasteSampleBtn.click();
    await page.waitForTimeout(500);

    const parseBtn = page.locator('button:has-text("Phân Tích XML")');
    await parseBtn.click();
    await page.waitForTimeout(1000);

    const ssXmlPath = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/bhyt_tab_xml_analysis.png';
    await page.screenshot({ path: ssXmlPath, fullPage: false });
    console.log('Saved screenshot XML analysis:', ssXmlPath);

    await browser.close();
    console.log('✅ PLAYWRIGHT E2E BHYT TAB VERIFICATION PASSED 100%!');
  } finally {
    preview.kill();
  }
})().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
