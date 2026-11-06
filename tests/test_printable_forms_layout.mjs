import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const ids = ['TT20_AMPOULE_DESTRUCTION', 'TT22_RESTOCK_PROPOSAL', 'TSC_HANDOVER_TRANSFER', 'EMERGENCY_BORROW_TICKET', 'EQUIPMENT_HANDOVER_INSPECT', 'TSC_ANNUAL_AUDIT', 'COLD_CHAIN_INCIDENT_REPORT', 'SHIFT_HANDOVER_RECORD'];
const selected = process.argv[2];
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, json: {} }));
  await mockDemoAuth(context);
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CLINICAL_TEST_ORIGIN || 'http://localhost:3000');
  for (const id of ids) {
    if (selected && selected !== id) continue;
    await page.evaluate(async id => (await import('/tests/fixtures/administrative-form-harness.tsx')).mountAdministrativeForm(id), id);
    const modal = page.getByTestId('printable-form-modal');
    await modal.waitFor();
    await page.waitForTimeout(50);
    const document = modal.locator('#printable-medical-document');
    const text = await document.innerText();
    assert.ok(text.includes('DỰ THẢO — CHƯA XÁC MINH'), `${id}: draft status is printed`);
    for (const field of ['Cơ sở', 'Địa chỉ', 'Mã văn bản', 'Ngày lập / họp', 'Địa điểm', 'Chưa ghi']) assert.ok(text.includes(field), `${id}: administrative field ${field}`);
    for (const field of ['Cơ sở', 'Địa chỉ', 'Mã văn bản', 'Ngày lập / họp', 'Địa điểm']) {
      const row = document.locator('dl > div').filter({ has: page.getByText(field, { exact: true }) }).first();
      assert.equal((await row.locator('dd').innerText()).trim(), 'Chưa ghi', `${id}: absent ${field} stays blank`);
    }
    for (const fabricated of ['104/QĐ', '45/QĐ', '88/QĐ', '10 giờ 30', 'DS. CKI Nguyễn Văn Hoàng', 'BS. CKII Trần Văn Hùng', 'BỆNH VIỆN ĐA KHOA TỈNH', '100%', '1.250.000.000', '12 tháng', 'Đủ điều kiện giải phóng', '24 người bệnh', 'LOT-VAT24', '200J', 'Âm tính', 'Đạt chuẩn', 'Ban hành kèm theo', 'Mẫu số', 'UNVERIFIED-LEGAL-CITATION']) assert.ok(!text.includes(fabricated), `${id}: must not invent ${fabricated}`);
    if (id === ids[0]) {
      assert.ok(text.includes('SOURCE-DEBT-42') && text.includes('Người bệnh nguồn A') && text.includes('3'));
      assert.ok(!text.includes('SOURCE-NOT-RETURNED') && !text.includes('SOURCE-DESTROYED'));
      assert.equal(await document.locator('[data-source-row]').count(), 1, 'only returned, not destroyed controlled-drug source is included');
      assert.ok(text.includes('Số vỏ thực kiểm') && text.includes('Phương pháp dự kiến'));
    }
    if (id === ids[1]) {
      assert.ok(text.includes('Thuốc nguồn hàng 7') && text.includes('LOT-SOURCE-7'), 'all source rows are retained');
      assert.equal(await document.locator('[data-source-row]').count(), 8);
      const issued = await document.locator('[data-field="actual-issued"]').allTextContents();
      assert.ok(issued.length === 8 && issued.every(value => value.includes('Chưa ghi')), 'proposal never claims stock physically issued');
    }
    if (id === ids[2] || id === ids[5]) for (const value of ['SOURCE-ASSET-91', 'SN-ASSET-91', 'Đơn vị theo sổ A', 'Vị trí ghi nhận B', 'broken_unrepairable']) assert.ok(text.includes(value), `${id}: preserve asset ${value}`);
    if (id === ids[3]) for (const value of ['SOURCE-DEBT-42', 'Người bệnh nguồn A', 'Phòng nguồn 01', '09:41', '2025-03-12', '3', 'ống']) assert.ok(text.includes(value), `borrow source ${value}`);
    if (id === ids[4]) {
      for (const value of ['SOURCE-TICKET-77', 'SN-SOURCE-77', 'MODEL-SOURCE', 'Vấn đề ghi nhận trên nguồn']) assert.ok(text.includes(value));
      const results = await document.locator('[data-field="measurement-result"]').allTextContents();
      assert.equal(results.length, 4, 'measurement fields are preserved');
      assert.ok(results.every(value => value.includes('Chưa ghi')));
    }
    if (id === ids[6]) {
      for (const value of ['Tủ nguồn 9', '6.75', '6.42', '9.25', '17', '1250', 'chưa đối soát tồn', 'LOT-COLD-SOURCE', '7', 'lọ']) assert.ok(text.includes(value), `coldchain source ${value}`);
      const lotVvm = await document.locator('[data-field="lot-vvm"]').allTextContents();
      assert.equal(lotVvm.length, 1);
      assert.ok(lotVvm.every(value => value.includes('Chưa ghi')), 'cabinet VVM is not assigned to individual lots');
    }
    if (id === ids[7]) {
      assert.ok(text.includes('SOURCE-DEBT-42') && text.includes('SOURCE-TICKET-77'));
      assert.ok(!text.includes('SOURCE-SETTLED') && !text.includes('SOURCE-TICKET-CLOSED'));
      assert.ok(text.includes('Số người bệnh hiện diện') && text.includes('Chưa ghi'));
    }
    if ([ids[0], ids[2], ids[3], ids[4], ids[5], ids[7]].includes(id)) assert.ok(text.includes('mô phỏng'), 'hidden-domain data must be marked on the printed page');
    const signatures = await document.locator('[data-field="signature-name"]').allTextContents();
    assert.equal(signatures.length, 3, 'party fields are preserved');
    assert.ok(signatures.every(value => value.includes('Chưa ghi')), 'no identities are auto-signed');
    console.log(`PASS truthful administrative draft ${id}`);
  }
  if (!selected) {
    for (const id of [ids[0], ids[1], ids[5], ids[6], ids[7]]) {
      await page.evaluate(async id => (await import('/tests/fixtures/administrative-form-harness.tsx')).mountAdministrativeForm(id, true), id);
      await page.waitForTimeout(50);
      const document = page.locator('#printable-medical-document');
      assert.equal(await document.locator('[data-source-row]').count(), 0, `${id}: empty sources produce no invented rows`);
      assert.ok((await document.innerText()).includes('Chưa có'));
    }
    for (const id of [ids[2], ids[3], ids[4]]) {
      await page.evaluate(async id => (await import('/tests/fixtures/administrative-form-harness.tsx')).mountAdministrativeForm(id, true), id);
      await page.waitForTimeout(50);
      assert.ok(await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).isDisabled(), 'single-record forms require explicit source selection');
      assert.equal(await page.locator('#printable-medical-document').isVisible(), false);
    }
    await page.evaluate(async () => (await import('/tests/fixtures/administrative-form-harness.tsx')).mountAdministrativeForm('EMERGENCY_BORROW_TICKET'));
    const modal = page.getByTestId('printable-form-modal');
    await page.waitForTimeout(50);
    const picker = modal.getByRole('combobox', { name: 'Hồ sơ xuất mượn', exact: true });
    await picker.selectOption('DEBT-NOT-RETURNED');
    assert.ok((await modal.locator('#printable-medical-document').innerText()).includes('SOURCE-NOT-RETURNED'), 'source picker changes the printed source');
    await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls++; }; });
    await modal.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click();
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    await modal.getByRole('button', { name: 'Tùy chọn xuất biểu mẫu', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Tải bản HTML', exact: true }).click();
    const html = await readFile(await (await downloadPromise).path(), 'utf8');
    assert.ok(html.includes('DỰ THẢO — CHƯA XÁC MINH') && html.includes('SOURCE-NOT-RETURNED'));
    assert.ok(html.includes('size: A4 portrait'));
    await page.setViewportSize({ width: 375, height: 812 });
    assert.ok((await modal.getByRole('button', { name: 'In / Lưu PDF', exact: true }).boundingBox()).height >= 44);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await modal.locator('header:visible').count(), 0);
    assert.equal(await page.locator('button:visible').count(), 0, 'floating application controls must not appear in printed drafts');
    assert.ok(await modal.locator('#printable-medical-document').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS administrative empty sources, picker, HTML export and A4 print behavior');
  }
} finally { await browser.close(); }
