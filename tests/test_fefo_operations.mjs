import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
const browser = await chromium.launch();
const origin = process.env.CLINICAL_TEST_ORIGIN || 'http://localhost:3000';
const selected = process.argv[2];
const batch = { id: 'available', item_name: 'Available source medication', batch_number: 'LOT-AVAILABLE', category: 'Kháng sinh', expiry_date: '2099-12-31', days_left: 10000, current_stock: 20, min_threshold: 10, max_threshold: 40, unit: 'lọ', warehouse_location: 'Kho nguồn', is_near_expiry: false, is_low_stock: false, is_quarantined: false, is_dispatchable: true };
async function setup(role = 'pharmacist') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const writes = [];
  let rejectWrites = true;
  let stock = 20;
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes.push({ path, data: request.postDataJSON() });
      if (rejectWrites) return route.fulfill({ status: 400, json: { detail: 'Rejected inventory operation' } });
      if (path.endsWith('/dispatch')) { stock -= request.postDataJSON().quantity; return route.fulfill({ json: { ...batch, current_stock: stock, is_low_stock: stock <= batch.min_threshold } }); }
      return route.fulfill({ json: { message: 'Proposal recorded', proposed_count: 1, total_units_requested: 7, restocked_count: 0 } });
    }
    if (path.endsWith('/inventory/batches')) return route.fulfill({ json: [{ ...batch, current_stock: stock }, { ...batch, id: 'held', item_name: 'Held source vaccine', batch_number: 'LOT-HELD', is_dispatchable: false, cold_storage_required: true, cold_storage_link_verified: true, cold_chain_state_id: 1, dispatch_hold_reason: 'Lô đang giữ theo tủ nguồn' }, { ...batch, id: 'expired', item_name: 'Expired source medication', batch_number: 'LOT-EXPIRED', expiry_date: '2020-01-01', is_dispatchable: false }, { ...batch, id: 'low', item_name: 'Low source medication', batch_number: 'LOT-LOW', current_stock: 3, min_threshold: 5, max_threshold: 10, is_low_stock: true }] });
    if (path.endsWith('/coldchain/status')) return route.fulfill({ json: { id: 1, current_temp: 4.5, is_outage: false, is_quarantined: false, vvm_level: 1, mkt_temp: 5.6, outage_minutes: 0, total_vaccine_doses: 0, logs: [] } });
    return route.fulfill({ json: [] });
  });
  await mockDemoAuth(context);
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.addInitScript(role => { localStorage.setItem('clinical_user_role', role); localStorage.setItem('clinical_audio_muted', 'false'); }, role);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/#fefo');
  await page.getByTestId('btn-medname-available').filter({ visible: true }).waitFor();
  await page.evaluate(async () => { const { clinicalAudio } = await import('/src/utils/audio.ts'); window.successChimes = 0; clinicalAudio.playSuccessChime = () => { window.successChimes++; }; });
  const row = id => page.locator('.desktop-records tbody tr').filter({ has: page.getByTestId('btn-medname-' + id) });
  return { context, page, writes, errors, row, allowWrites: () => { rejectWrites = false; } };
}
async function run(name, task) { if (selected && !name.includes(selected)) return; await task(); console.log('PASS ' + name); }
async function confirmAuth(page) {
  const auth = page.getByRole('dialog', { name: 'Xác thực chữ ký số lâm sàng' });
  await auth.getByTitle('Tự động điền mã PIN demo').click();
  await auth.getByRole('button', { name: 'Ký Xác Thực & Thực Thi' }).click();
}
try {
  await run('held stock is visible and blocked on desktop and mobile', async () => {
    const { context, page, row } = await setup();
    assert.ok((await row('held').innerText()).includes('Lô đang giữ theo tủ nguồn'));
    assert.ok(await row('held').getByRole('button', { name: 'Xuất lô LOT-HELD', exact: true }).isDisabled());
    assert.ok(await row('expired').getByRole('button', { name: 'Xuất lô LOT-EXPIRED', exact: true }).isDisabled());
    await page.setViewportSize({ width: 375, height: 812 });
    const card = page.locator('.mobile-records article').filter({ has: page.getByTestId('btn-medname-held') });
    assert.ok((await card.innerText()).includes('Lô đang giữ theo tủ nguồn'));
    assert.ok(await card.getByRole('button', { name: 'Xuất lô LOT-HELD', exact: true }).isDisabled());
    await context.close();
  });
  await run('quantity confirmation is blank validated cancellable and persists only after auth', async () => {
    const { context, page, writes, errors, row, allowWrites } = await setup();
    assert.equal(await page.getByRole('button', { name: 'Xuất lô LOT-AVAILABLE', exact: true }).filter({ visible: true }).count(), 1, 'authorized operator has a dispatch entry');
    const open = () => page.getByRole('button', { name: 'Xuất lô LOT-AVAILABLE', exact: true }).filter({ visible: true }).click();
    await open();
    const dialog = page.getByRole('dialog', { name: 'Số lượng xuất kho', exact: true });
    const quantity = dialog.getByRole('spinbutton', { name: 'Số lượng xuất', exact: true });
    assert.equal(await quantity.inputValue(), '', 'no hardcoded10 or other presumed amount');
    for (const value of ['', '-1', '0', '1.5', '21']) {
      await quantity.fill(value);
      await dialog.getByRole('button', { name: 'Tiếp tục xác nhận', exact: true }).click();
      assert.equal(await page.getByRole('dialog', { name: 'Xác thực chữ ký số lâm sàng' }).count(), 0);
      assert.equal(writes.length, 0);
    }
    await quantity.fill('3');
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    assert.equal(writes.length, 0);
    await open();
    assert.equal(await quantity.inputValue(), '', 'reopening does not retain a previous amount');
    await quantity.fill('3');
    await dialog.getByRole('button', { name: 'Tiếp tục xác nhận', exact: true }).click();
    const auth = page.getByRole('dialog', { name: 'Xác thực chữ ký số lâm sàng' });
    await auth.waitFor();
    assert.equal(writes.length, 0, 'opening auth is not a completed dispatch');
    assert.equal(await page.evaluate(() => window.successChimes), 0);
    await auth.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();
    assert.ok((await row('available').innerText()).includes('20'));
    await open(); await quantity.fill('3'); await dialog.getByRole('button', { name: 'Tiếp tục xác nhận', exact: true }).click();
    await confirmAuth(page);
    await auth.getByText(/Rejected inventory operation/).waitFor();
    assert.ok((await row('available').innerText()).includes('20'));
    assert.equal(await page.evaluate(() => window.successChimes), 0);
    allowWrites();
    await confirmAuth(page);
    await auth.waitFor({ state: 'hidden' });
    assert.ok((await row('available').innerText()).includes('17'));
    assert.deepEqual(writes.at(-1).data, { quantity: 3 }, 'request does not invent dispatcher or authentication fields');
    assert.deepEqual(errors, []);
    await context.close();
  });
  await run('restock proposal opens from header and leaves on-hand stock unchanged', async () => {
    const { context, page, writes, row, allowWrites } = await setup();
    assert.equal(await page.getByRole('button', { name: 'Dự trù bổ sung', exact: true }).count(), 1, 'authorized operator has a restock entry');
    await page.getByRole('button', { name: 'Dự trù bổ sung', exact: true }).click();
    const proposal = page.getByRole('dialog', { name: 'Dự trù bổ sung', exact: true });
    await proposal.waitFor();
    assert.ok(!(await proposal.innerText()).includes('DS. Nguyễn Bích Ngọc'));
    await proposal.getByRole('button', { name: 'Tiếp tục xác nhận', exact: true }).click();
    const auth = page.getByRole('dialog', { name: 'Xác thực chữ ký số lâm sàng' });
    await auth.waitFor();
    assert.equal(writes.length, 0);
    assert.equal(await page.evaluate(() => window.successChimes), 0);
    await confirmAuth(page);
    await auth.getByText(/Rejected inventory operation/).waitFor();
    assert.ok((await row('low').innerText()).includes('3'));
    allowWrites(); await confirmAuth(page); await auth.waitFor({ state: 'hidden' });
    assert.ok((await row('low').innerText()).includes('3'), 'accepted proposal does not represent physical stock receipt');
    assert.deepEqual(writes.at(-1).data.batch_ids, ['low']);
    await context.close();
  });
  await run('doctor and nurse inventory views remain read-only', async () => {
    for (const role of ['doctor', 'nurse']) {
      const { context, page } = await setup(role);
      assert.equal(await page.getByRole('button', { name: /^Xuất lô / }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Dự trù bổ sung', exact: true }).count(), 0);
      await context.close();
    }
  });
  await run('director can enter inventory confirmation flows', async () => {
    const { context, page } = await setup('director');
    assert.equal(await page.getByRole('button', { name: 'Xuất lô LOT-AVAILABLE', exact: true }).filter({ visible: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Dự trù bổ sung', exact: true }).count(), 1);
    await context.close();
  });
} finally { await browser.close(); }
