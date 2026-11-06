import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  await context.route(
    (u) => u.pathname.startsWith('/api/'),
    (r) =>
      r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await mockDemoAuth(context);
  await context.route('https://fonts.googleapis.com/**', (r) => r.abort());
  // Exercise the real offline decoding/UI with a bounded subset of repository data.
  // The full compressed catalog is 83MiB / 415MiB decoded and is covered separately.
  const catalog = JSON.parse(await readFile(new URL('../public/data/vietnam_drug_registry/dav_essential_formulary.json', import.meta.url), 'utf8')).slice(0,24);
  await context.route('**/data/canonical-drug-catalog.json.gz', route => route.fulfill({status:200,contentType:'application/gzip',body:gzipSync(JSON.stringify(catalog))}));
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
  });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:3000/#cpoe');
  await p.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
  const save = p.getByRole('button', { name: 'Lưu bản nháp', exact: true });
  const r = await save.boundingBox();
  assert.ok(
    r.height <= 50 && r.width >= 120,
    'mobile save action remains a single readable line',
  );
  await save.click();
  assert.ok(
    (await p.locator('form :invalid').count()) > 0 ||
      (await p.getByRole('alert').count()) > 0,
    'empty prescription is blocked by validation',
  );
  await p.screenshot({
    path: '/tmp/clinical-workspace-redesign/375-composer-validated.png',
  });
  await p.getByRole('button', { name: 'Đóng form kê đơn' }).click();
  await p.goto('http://localhost:3000/#fefo');
  await p.getByRole('button', { name: 'Bộ lọc', exact: false }).click();
  await p.getByRole('combobox', { name: 'Vị trí kho', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Tra cứu thuốc', exact: true }).click();
  const registry = p.getByRole('dialog', {
    name: 'Tra cứu thuốc',
    exact: true,
  });
  await registry.locator('.registry-card').first().waitFor({ timeout: 15000 });
  assert.equal(
    await registry.evaluate((e) => e.scrollWidth > innerWidth),
    false,
    'registry fits mobile',
  );
  await p.screenshot({
    path: '/tmp/clinical-workspace-redesign/375-registry.png',
  });
  await registry.locator('.record-link').first().click();
  await p.getByTestId('dav-drug-detail-modal').waitFor();
  await p.reload();
  await p.getByRole('button', { name: 'Mở điều hướng' }).click();
  const drawer = p.getByRole('dialog', { name: 'Điều hướng chính' });
  await drawer
    .getByRole('button', { name: 'Văn bản & tài liệu', exact: true })
    .click();
  const library = p.getByRole('dialog', { name: 'Văn bản và tài liệu' });
  await library.waitFor();
  await library
    .getByRole('button', { name: '18/2026/TT-BYT', exact: false })
    .click();
  assert.ok((await library.innerText()).includes('16/07/2026'));
  const link = await library
    .getByRole('link', { name: 'Mở văn bản gốc', exact: false })
    .getAttribute('href');
  assert.ok(link.startsWith('https://congbao.chinhphu.vn/'));
  await p.screenshot({
    path: '/tmp/clinical-workspace-redesign/375-library.png',
  });
  await library.getByRole('button', { name: 'Đóng thư viện' }).click();
  assert.deepEqual(errors, []);
  console.log('Workspace mobile dialog checks passed');
} finally {
  await browser.close();
}
