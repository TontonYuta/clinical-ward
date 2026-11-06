import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const b = await chromium.launch();
try {
  const landscape = process.argv.includes('--landscape');
  const c = await b.newContext({
    viewport: landscape ? { width: 812, height: 375 } : { width: 1440, height: 900 },
  });
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
  await p.goto('http://localhost:3000/#overview');
  await p.getByRole('button', { name: 'Biểu mẫu', exact: true }).click();
  const modal = p.getByTestId('printable-form-modal');
  await modal.waitFor();
  if (process.argv.includes('--catalog')) {
    await p.setViewportSize({ width: 375, height: 812 });
    const trigger = modal.getByRole('button', { name: 'Chọn phiếu', exact: true });
    await trigger.click();
    assert.ok(
      await p.evaluate(() => !!document.activeElement?.closest('.forms-catalog')),
      'catalog opening focuses its controls',
    );
    for (let i = 0; i < 15; i++) {
      await p.keyboard.press('Tab');
      assert.ok(
        await p.evaluate(() => !!document.activeElement?.closest('.forms-catalog')),
        'focus cannot enter covered work area',
      );
    }
    await p.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.ok(
      await trigger.evaluate((e) => e === document.activeElement),
      'focus restored after catalog close',
    );
  } else if (landscape) {
    await modal.locator('.forms-work-area').evaluate((e) => (e.scrollTop = e.scrollHeight));
    const rect = await modal.locator('.forms-preview-canvas').boundingBox();
    assert.ok(
      rect && Math.min(rect.y + rect.height, 375) - Math.max(rect.y, 80) >= 150,
      'landscape preview remains reachable by scrolling',
    );
  } else {
    assert.ok(
      await modal.getByRole('button', { name: 'In / Lưu PDF', exact: true }).isDisabled(),
      'generic entry does not silently select first patient',
    );
    const picker = modal.getByRole('combobox', { name: 'Hồ sơ xuất mượn', exact: true });
    assert.equal(await picker.inputValue(), '');
    assert.equal(
      await modal.locator('#printable-medical-document').isVisible(),
      false,
      'no sample patient shown as selected',
    );
    await picker.selectOption({ index: 2 });
    assert.ok(await modal.getByRole('button', { name: 'In / Lưu PDF', exact: true }).isEnabled());
    await modal.getByTestId('form-choice-SHIFT_HANDOVER_RECORD').click();
    await modal.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click();
    await p.getByRole('button', { name: 'Biểu mẫu', exact: true }).click();
    await modal.getByRole('combobox', { name: 'Hồ sơ xuất mượn', exact: true }).waitFor();
    assert.equal(
      await modal.getByRole('combobox', { name: 'Hồ sơ xuất mượn', exact: true }).inputValue(),
      '',
      'new opening clears stale patient source',
    );
    assert.ok(await modal.getByRole('button', { name: 'In / Lưu PDF', exact: true }).isDisabled());
  }
  console.log(
    process.argv.includes('--catalog')
      ? 'Forms catalog keyboard focus passed'
      : landscape
        ? 'Landscape forms navigation passed'
        : 'Forms opening and source identity checks passed',
  );
} finally {
  await b.close();
}
