import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const b = await chromium.launch();
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.route(
    (u) => u.pathname.startsWith('/api/'),
    (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(c);
  await c.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
  });
  const p = await c.newPage();
  for (const [tab, title] of [
    ['overview', 'Tổng quan'],
    ['cpoe', 'Đơn thuốc'],
    ['fefo', 'Kho dược'],
    ['coldchain', 'Chuỗi lạnh'],
  ]) {
    await p.goto(`http://localhost:3000/?single-header=${tab}#${tab}`);
    await p.locator('main').waitFor();
    assert.equal(
      await p.locator('.workspace-shell .workspace-heading:visible').count(),
      0,
      'no second page-header band',
    );
    assert.equal(await p.locator('.workspace-shell h1:visible').count(), 1, 'one primary heading');
    assert.equal((await p.locator('.workspace-shell h1:visible').innerText()).trim(), title);
    assert.equal(await p.locator('.workspace-shell > header').count(), 1);
    if (tab === 'cpoe') {
      await p
        .locator('.workspace-shell > header')
        .getByRole('button', { name: 'Kê đơn mới', exact: true })
        .click();
      await p.getByRole('button', { name: 'Đóng form kê đơn' }).click();
    }
  }
  console.log('Single page header checks passed');
} finally {
  await b.close();
}
