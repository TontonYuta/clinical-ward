const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

(async () => {
  console.log('=== OPENING RENDER DASHBOARD VIA PLAYWRIGHT ===');
  let context;
  try {
    context = await chromium.launchPersistentContext('/tmp/chrome_playwright_profile', {
      executablePath: '/opt/google/chrome/chrome',
      headless: true,
      viewport: { width: 1440, height: 960 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    console.log('1. Navigating to https://dashboard.render.com...');
    await page.goto('https://dashboard.render.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    console.log('Title:', await page.title());

    // Chụp ảnh màn hình Render dashboard
    const ssDash = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/render_dashboard_initial.png';
    await page.screenshot({ path: ssDash, fullPage: false });
    console.log('Saved dashboard screenshot:', ssDash);

    // Kiểm tra xem có service clinical-ward-api không
    const serviceLink = page.locator('text=clinical-ward-api').first();
    const serviceCount = await serviceLink.count();
    console.log('Found clinical-ward-api links:', serviceCount);

    if (serviceCount > 0) {
      console.log('2. Clicking clinical-ward-api service...');
      await serviceLink.click();
      await page.waitForTimeout(4000);
      console.log('Service URL:', page.url());

      const ssService = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/render_service_overview.png';
      await page.screenshot({ path: ssService, fullPage: false });
      console.log('Saved service overview screenshot:', ssService);

      // Tìm thông báo failed build
      const failedBadge = page.locator('text=Failed').first();
      const failedCount = await failedBadge.count();
      console.log('Found "Failed" elements:', failedCount);

      if (failedCount > 0) {
        console.log('3. Clicking on Failed deploy to view build logs...');
        await failedBadge.click();
        await page.waitForTimeout(4000);

        const ssLog = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/render_failed_build_log.png';
        await page.screenshot({ path: ssLog, fullPage: false });
        console.log('Saved failed build log screenshot:', ssLog);

        // Lấy text log lỗi
        const logContent = await page.locator('code, pre, [data-testid*="log"], div[class*="log"]').allInnerTexts().catch(() => []);
        console.log('=== EXTRACTED LOGS COUNT ===', logContent.length);
        for (const log of logContent.slice(0, 10)) {
          if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') || log.toLowerCase().includes('traceback')) {
            console.log('--- ERROR LOG SNIPPET ---');
            console.log(log.slice(0, 1000));
          }
        }
      }
    } else {
      console.log('Could not find clinical-ward-api. Body preview:');
      const text = await page.locator('body').innerText();
      console.log(text.slice(0, 500));
    }
  } catch (err) {
    console.error('Playwright Error:', err);
  } finally {
    if (context) await context.close();
  }
})();
