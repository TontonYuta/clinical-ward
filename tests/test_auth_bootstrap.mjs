import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CLINICAL_TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch();
const selected = process.argv[2];

async function setup({ mode = 'required', delayed = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  let signedIn = false;
  let currentMode = mode;
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push({ path, method: request.method() });
    if (path.endsWith('/auth/me')) {
      if (delayed) await new Promise(resolve => setTimeout(resolve, 500));
      if (currentMode === 'unavailable') return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
      if (currentMode === 'invalid') return route.fulfill({ json: { enabled: true, authenticated: true, username: 'unexpected', role: 'superadmin' } });
      if (currentMode === 'disabled') return route.fulfill({ json: { enabled: false, authenticated: true, username: 'local', role: 'nurse' } });
      return signedIn
        ? route.fulfill({ json: { enabled: true, authenticated: true, username: 'pharmacist.test', role: 'pharmacist' } })
        : route.fulfill({ status: 401, json: { detail: 'Authentication required' } });
    }
    if (path.endsWith('/auth/login')) {
      if (request.postDataJSON().password !== 'correct') return route.fulfill({ status: 401, json: { detail: 'Invalid username or password' } });
      signedIn = true;
      return route.fulfill({ json: { username: 'pharmacist.test', role: 'pharmacist' } });
    }
    if (path.endsWith('/auth/logout')) { signedIn = false; return route.fulfill({ json: { status: 'logged_out' } }); }
    if (path.endsWith('/coldchain/status')) return route.fulfill({ json: { id: 1, current_temp: 4.5, is_outage: false, is_quarantined: false, vvm_level: 1, mkt_temp: 5.6, outage_minutes: 0, total_vaccine_doses: 0, logs: [] } });
    return route.fulfill({ json: [] });
  });
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('clinical_user_role', 'doctor');
    localStorage.setItem('clinical_audio_muted', 'true');
    localStorage.setItem('clinical_cached_cpoe', JSON.stringify([{ id: 'RX-CACHED-PRIVATE', patientId: 'BN-PRIVATE', patientName: 'Cached private patient', items: [] }]));
  });
  const page = await context.newPage();
  await page.goto(`${origin}/#cpoe`, { waitUntil: 'domcontentloaded' });
  return { context, page, requests, setMode: mode => { currentMode = mode; } };
}

async function run(name, test) {
  if (selected && !name.includes(selected)) return;
  await test();
  console.log(`PASS ${name}`);
}

try {
  await run('required auth login uses server role and logout hides clinical workspace', async () => {
    const { context, page, requests } = await setup();
    await page.waitForTimeout(100);
    assert.equal(await page.getByLabel('Tên đăng nhập', { exact: true }).count(), 1, '401 session status must show login');
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    assert.equal(requests.filter(request => !request.path.includes('/auth/')).length, 0, 'clinical requests wait for authentication');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill('pharmacist.test');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('incorrect');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Invalid username or password' }).waitFor();
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('correct');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.locator('.workspace-shell').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).count(), 0, 'cached doctor role cannot override authenticated pharmacist role');
    assert.equal(await page.locator('.header-demo-indicator').count(), 0);
    await page.locator('.account-trigger:visible').click();
    assert.equal(await page.getByRole('menu', { name: 'Chọn vai trò' }).count(), 0, 'authenticated users have no demo role chooser');
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).filter({ visible: true }).click();
    const settings = page.getByRole('dialog', { name: 'Cài đặt', exact: true });
    assert.ok((await settings.innerText()).includes('pharmacist.test'));
    await settings.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).waitFor();
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    assert.equal(requests.filter(request => request.path.endsWith('/auth/logout')).length, 1);
    await context.close();
  });
  await run('disabled server auth explicitly enables demo role selection', async () => {
    const { context, page, requests } = await setup({ mode: 'disabled' });
    await page.locator('.workspace-shell').waitFor();
    assert.equal(await page.locator('.header-demo-indicator').count(), 1);
    assert.equal(requests.filter(request => request.path.endsWith('/auth/me')).length, 1, 'demo mode must be explicitly returned by server');
    await page.locator('.account-trigger:visible').click();
    assert.equal(await page.getByRole('menu', { name: 'Chọn vai trò' }).count(), 1);
    await context.close();
  });
  await run('unknown auth state fails closed and offers meaningful retry', async () => {
    const { context, page, requests, setMode } = await setup({ mode: 'unavailable' });
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', { name: 'Thử lại kiểm tra phiên', exact: true }).count(), 1);
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    assert.equal(await page.getByText('Cached private patient', { exact: true }).count(), 0);
    assert.equal(requests.filter(request => !request.path.includes('/auth/')).length, 0);
    setMode('disabled');
    await page.getByRole('button', { name: 'Thử lại kiểm tra phiên', exact: true }).click();
    await page.locator('.workspace-shell').waitFor();
    await context.close();
  });
  await run('auth checking shows neither login flash nor cached clinical view', async () => {
    const { context, page } = await setup({ delayed: true });
    assert.equal(await page.getByRole('status').filter({ hasText: 'Đang kiểm tra phiên đăng nhập' }).count(), 1);
    assert.equal(await page.getByLabel('Tên đăng nhập', { exact: true }).count(), 0);
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    await page.getByLabel('Tên đăng nhập', { exact: true }).waitFor();
    await context.close();
  });
  await run('unrecognized authenticated role cannot enter demo or clinical workspace', async () => {
    const { context, page } = await setup({ mode: 'invalid' });
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', { name: 'Thử lại kiểm tra phiên', exact: true }).count(), 1);
    assert.equal(await page.locator('.workspace-shell').count(), 0);
    await context.close();
  });
} finally { await browser.close(); }
