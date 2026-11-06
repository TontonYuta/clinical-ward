import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route(u => u.pathname.endsWith('.json.gz'), r => r.abort());
  await page.route(u => u.pathname.startsWith('/api/'), r => r.fulfill({status:503,body:'{}'}));
  await mockDemoAuth(page);
  await page.goto('http://localhost:3000/');
  async function mount(mode) {
    await page.evaluate(async mode => (await import('/tests/fixtures/clinical-auth-harness.tsx')).mountAuth(mode), mode);
    await page.getByRole('dialog').waitFor();
  }
  await mount('cancel');
  await page.getByTitle('Tự động điền mã PIN demo').click();
  await page.getByRole('button', {name:'Ký Xác Thực & Thực Thi'}).click();
  await page.getByRole('button', {name:'Hủy bỏ'}).click();
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(() => window.authCalls), 0, 'closing cancels queued authorization');
  await mount('reject');
  await page.getByTitle('Tự động điền mã PIN demo').click();
  await page.getByRole('button', {name:'Ký Xác Thực & Thực Thi'}).click();
  await page.getByText('API refused operation', {exact:true}).waitFor({timeout:4000});
  assert.ok(await page.getByRole('dialog').isVisible(), 'rejected action stays open');
  assert.equal(await page.evaluate(() => window.authCalls), 1);
  await mount('witness');
  await page.getByRole('button', {name:'Chạm thẻ RFID / NFC'}).click();
  await page.getByRole('button', {name:/^Chạm thẻ:/}).click();
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(() => window.authCalls), 0, 'RFID requires independent witness confirmation');
  console.log('Clinical authorization cancellation, rejection and witness regressions passed');
} finally { await browser.close(); }
