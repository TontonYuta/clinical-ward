import { mockClinicalReads } from './helpers/mockClinicalReads.mjs';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const out = process.env.UI_SCREENSHOTS || '/tmp/clinical-workspace-redesign';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext();
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"detail":"Test: backend unavailable"}',
      }),
  );
  await mockDemoAuth(context);
  await mockClinicalReads(context);
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 1366, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: width < 768 ? 667 : 900 });
    for (const tab of ['overview', 'cpoe', 'fefo', 'coldchain']) {
      await page.goto(`http://localhost:3000/#${tab}`, { waitUntil: 'domcontentloaded' });
      await page.locator('main').waitFor();
      assert.equal(
        await page.locator('.workspace-shell h1:visible').count(),
        1,
        `${tab}: one clear page heading`,
      );
      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        clippedTables: [...document.querySelectorAll('main table')].filter(
          (e) =>
            e.getBoundingClientRect().width > 0 && e.scrollWidth > e.parentElement.clientWidth + 2,
        ).length,
      }));
      assert.ok(layout.width <= layout.viewport + 1, `${width}/${tab}: page overflow`);
      if (width >= 1366)
        assert.equal(layout.clippedTables, 0, `${width}/${tab}: table fits desktop`);
      if (tab === 'coldchain' && width < 768) {
        const first = page.locator('main [data-workspace-record]:visible').first();
        assert.ok(
          (await first.boundingBox()).y < 570,
          'cold-chain inventory reachable above bottom navigation',
        );
      }
      if (tab === 'coldchain' && width < 768) {
        await page.getByTestId('subtab-datalogger').click();
        await page.locator('.workspace-page').evaluate((e) => (e.scrollTop = e.scrollHeight));
        const last = await page.locator('main tr[data-workspace-record]').last().boundingBox();
        assert.ok(
          last && last.y >= 0 && last.y + last.height <= 610,
          'mobile log final row reachable by page scrolling',
        );
        await page.getByTestId('subtab-inventory').click();
        await page.locator('.workspace-page').evaluate((e) => (e.scrollTop = 0));
      }
      if (width === 1440 || width === 375)
        await page.screenshot({ path: `${out}/${width}-${tab}.png` });
      console.log(`PASS ${width}/${tab}`);
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  const nav = page.getByRole('navigation', { name: 'Điều hướng nhanh' });
  assert.equal(await nav.locator('button').count(), 4);
  for (const button of await nav.locator('button').all()) {
    const r = await button.boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= 376, 'all mobile destinations visible');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/#cpoe');
  const search = page.getByRole('searchbox', { name: 'Tìm đơn thuốc điện tử' });
  await search.fill('KHONGCOBENHNHAN');
  assert.equal(await page.locator('[data-testid="cpoe-order-id-btn"]:visible').count(), 0);
  await search.fill('');
  await page.locator('[data-testid="cpoe-order-id-btn"]:visible').first().click();
  await page.getByTestId('cpoe-order-detail-modal').waitFor();
  assert.ok(
    (await page.getByTestId('cpoe-order-detail-modal').innerText()).toLowerCase().includes('thuốc'),
  );
  assert.deepEqual(errors, [], 'no React runtime errors');
  console.log(`Workspace checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
}
