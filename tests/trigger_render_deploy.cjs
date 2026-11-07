const { chromium } = require('/home/tontonyuta/Downloads/DoAn2/node_modules/playwright');

(async () => {
  console.log('=== TRIGGERING RENDER MANUAL DEPLOY FOR COMMIT c1590ed (AUTO-SEED BHYT) ===');
  let context;
  try {
    context = await chromium.launchPersistentContext('/tmp/chrome_playwright_profile', {
      executablePath: '/opt/google/chrome/chrome',
      headless: true,
      viewport: { width: 1440, height: 960 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    console.log('1. Navigating to Render service page...');
    await page.goto('https://dashboard.render.com/web/srv-dbj33lu7bikc73e9kr00', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('2. Opening "Manual Deploy" dropdown...');
    const manualDeployBtn = page.locator('button:has-text("Manual Deploy")').first();
    await manualDeployBtn.waitFor({ state: 'visible', timeout: 10000 });
    await manualDeployBtn.click();
    await page.waitForTimeout(1000);

    // Chụp ảnh dropdown menu
    const ssDropdown = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/render_manual_deploy_menu.png';
    await page.screenshot({ path: ssDropdown, fullPage: false });
    console.log('  ✓ Saved dropdown menu screenshot:', ssDropdown);

    console.log('3. Clicking "Clear build cache & deploy"...');
    const clearCacheBtn = page.locator('text=Clear build cache & deploy').first();
    await clearCacheBtn.waitFor({ state: 'visible', timeout: 5000 });
    await clearCacheBtn.click();
    await page.waitForTimeout(4000);

    console.log('  ✓ Triggered deployment! Current URL:', page.url());

    // 4. Theo dõi log deployment
    console.log('4. Monitoring deploy progress...');
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(10000);
      const url = page.url();
      const bodySnippet = await page.locator('body').innerText().catch(() => '');
      
      const isLive = bodySnippet.includes('==> Live') || bodySnippet.includes('Application startup complete') || bodySnippet.includes('Uvicorn running');
      const isFailed = bodySnippet.includes('Deploy failed') && i > 3;

      console.log(`  [Poll ${i + 1}/20 (${(i + 1) * 10}s)] URL: ${url}`);
      
      if (isLive) {
        console.log('🎉 DEPLOYMENT IS LIVE ON RENDER!');
        break;
      }
      if (isFailed) {
        console.log('⚠️ Detected deploy failure in log.');
        break;
      }
    }

    const ssFinal = '/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312/render_deploy_after_fix.png';
    await page.screenshot({ path: ssFinal, fullPage: false });
    console.log('  ✓ Final deploy screenshot saved:', ssFinal);

  } catch (err) {
    console.error('Playwright Error:', err);
  } finally {
    if (context) await context.close();
  }
})();
