import { mockClinicalReads } from './helpers/mockClinicalReads.mjs';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const b = await chromium.launch();
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = (c) =>
  c
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const l = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (l[0] + 0.05) / (l[1] + 0.05);
};
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.route(
    (u) => u.pathname.startsWith('/api/'),
    (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(c);
  await mockClinicalReads(c);
  await c.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
  });
  const p = await c.newPage();
  await p.goto('http://localhost:3000/#cpoe');
  await p.locator('[data-testid="cpoe-order-id-btn"]:visible').first().click();
  await p.getByRole('button', { name: 'An toàn', exact: true }).click();
  await p.getByRole('tab', { name: 'Thẩm định', exact: true }).click();
  const title = p.getByRole('heading', { name: 'Chưa có kết quả thẩm định', exact: true });
  await title.waitFor();
  const color = rgb(await title.evaluate((e) => getComputedStyle(e).color));
  assert.ok(
    color[0] > color[1] * 1.25 && color[1] > color[2] * 1.2,
    'unavailable audit is visibly amber, not neutral grey',
  );
  assert.ok(contrast(color, [255, 250, 235]) >= 4.5, 'warning text contrast');
  await p.getByTestId('btn-close-cpoe-detail').click();
  await p.goto('http://localhost:3000/#coldchain');
  const expired = p.locator('main .status-pill.danger:visible').first();
  await expired.waitFor();
  const style = await expired.evaluate((e) => ({
    fg: getComputedStyle(e).color,
    bg: getComputedStyle(e).backgroundColor,
    weight: getComputedStyle(e).fontWeight,
    text: e.innerText,
  }));
  assert.ok(contrast(rgb(style.fg), rgb(style.bg)) >= 4.5, 'expired label contrast');
  assert.ok(Number(style.weight) >= 600, 'critical status is emphasized');
  assert.ok(style.text.includes('Hết hạn'), 'explicit text accompanies color');
  console.log('Semantic severity color checks passed');
} finally {
  await b.close();
}
