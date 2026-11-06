import { mockClinicalReads } from '../../tests/helpers/mockClinicalReads.mjs';
import { mockDemoAuth } from '../../tests/helpers/mockDemoAuth.mjs';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function collectRuntime({ baseUrl, screenshotDir, onSnapshot = () => {}, allowFullCatalog = false }) {
  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const snapshots = [],
    errors = [];
  let visit = 0;
  async function contextFor(role, viewport) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      // Header auditing does not need to parse the 415MB full catalog. Exercise
      // the application's real essential-catalog fallback, with --full-catalog
      // available when the complete offline dataset is deliberately requested.
      if (
        !allowFullCatalog &&
        [
          '/data/canonical-drug-catalog.json.gz',
          '/data/vietnam_drug_registry/dav_master_registry.json.gz',
        ].includes(u.pathname)
      )
        return route.abort();
      if (u.pathname.startsWith('/api/'))
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"detail":"Read-only UI audit: no backend requests"}',
        });
      if (u.origin !== new URL(baseUrl).origin && /^https?:/.test(u.protocol)) return route.abort();
      return route.continue();
    });
    await mockDemoAuth(context);
    await mockClinicalReads(context);
    await context.addInitScript((role) => {
      localStorage.clear();
      localStorage.setItem('clinical_user_role', role);
      localStorage.setItem('clinical_audio_muted', 'true');
      sessionStorage.clear();
    }, role);
    return context;
  }
  async function take(page, id, selector = 'main', extra = {}) {
    const root = page.locator(selector).last();
    await root.waitFor();
    const result = await root.evaluate(
      (scope, { id, extra }) => {
        const printSelector =
          '#printable-medical-document,#prescription-print-portal,#prescription-print-document';
        const visible = (e) =>
          !!e.getClientRects().length &&
          getComputedStyle(e).visibility !== 'hidden' &&
          !e.closest('[hidden],[aria-hidden="true"],[inert]');
        function cssPath(e) {
          if (e.id) return '#' + e.id;
          const test = e.getAttribute('data-testid');
          if (test) return `[data-testid="${test}"]`;
          return (
            e.tagName.toLowerCase() +
            [...e.classList]
              .filter((c) => /^[a-z-]+$/.test(c))
              .slice(0, 3)
              .map((c) => '.' + c)
              .join('')
          );
        }
        function text(e) {
          const copy = e.cloneNode(true);
          copy
            .querySelectorAll('button,input,select,[aria-hidden="true"]')
            .forEach((n) => n.remove());
          return (copy.textContent || '').replace(/\s+/g, ' ').trim();
        }
        const seen = new Set(),
          headings = [];
        const add = (e, kind) => {
          if (!e || seen.has(e) || !visible(e) || e.closest(printSelector)) return;
          seen.add(e);
          const r = e.getBoundingClientRect();
          const t = kind.startsWith('selected-') ? (e.innerText || '').trim() : text(e);
          if (!t) return;
          headings.push({
            kind,
            text: t,
            selector: cssPath(e),
            tag: e.tagName.toLowerCase(),
            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
            inViewport: r.bottom > 0 && r.top < innerHeight,
          });
        };
        if (scope.matches('main'))
          add(
            document.querySelector('.workspace-topbar-label,.workspace-page-header h1'),
            'shell-title',
          );
        scope.querySelectorAll('.workspace-heading h1').forEach((e) => add(e, 'page-title'));
        scope
          .querySelectorAll('h1,h2,h3,h4,h5,h6')
          .forEach((e) =>
            add(
              e,
              e.closest('[role="status"],[role="alert"]')
                ? 'status-title'
                : e.closest('header,.library-header,.composer-header')
                  ? 'dialog-title'
                  : 'section-title',
            ),
          );
        scope.querySelectorAll('.eyebrow,.section-kicker').forEach((e) => add(e, 'eyebrow'));
        scope.querySelectorAll('.list-caption > strong').forEach((e) => add(e, 'list-title'));
        scope
          .querySelectorAll('[role="tab"][aria-selected="true"]')
          .forEach((e) => add(e, 'selected-tab'));
        scope
          .querySelectorAll('.segment-control [aria-pressed="true"]')
          .forEach((e) => add(e, 'selected-group'));
        const bands = [...scope.querySelectorAll('header')]
          .filter(visible)
          .filter((e) => !e.closest(printSelector))
          .map((e) => ({
            selector: cssPath(e),
            height: e.getBoundingClientRect().height,
            text: text(e),
          }));
        if (scope.matches('main')) {
          const shell = document.querySelector('.workspace-topbar');
          if (shell && visible(shell))
            bands.unshift({
              selector: cssPath(shell),
              height: shell.getBoundingClientRect().height,
              text: text(shell),
            });
        }
        const doc = scope.querySelector('#printable-medical-document');
        const printedHeadings = doc
          ? [...doc.querySelectorAll('h1,h2,h3')].filter(visible).map((e) => e.innerText.trim())
          : [];
        const controls = [...scope.querySelectorAll('button,select')]
          .filter(visible)
          .filter((e) => !e.closest(printSelector));
        const panel = scope.firstElementChild;
        const beforePreview =
          doc && panel
            ? [...panel.children].slice(0, -2).map((e) => ({
                text: text(e).slice(0, 180),
                height: e.getBoundingClientRect().height,
              }))
            : [];
        return {
          id,
          ...extra,
          width: innerWidth,
          height: innerHeight,
          headings,
          bands,
          printedHeadings,
          printedText: doc ? (doc.innerText || '').replace(/\s+/g, ' ').trim() : null,
          controls: controls.length,
          beforePreview,
        };
      },
      { id, extra },
    );
    snapshots.push(result);
    onSnapshot(result);
    if (['page-cpoe', 'page-coldchain', 'forms-1', 'forms-4'].includes(id)) {
      const filename = `${result.width}-${id}.png`;
      await page.screenshot({ path: path.join(screenshotDir, filename) });
      result.screenshot = filename;
    }
    return result;
  }
  const attempt = async (id, fn) => {
    try {
      await fn();
    } catch (error) {
      errors.push({ scenario: id, error: error.message.split('\n').slice(0, 3).join(' ') });
    }
  };
  try {
    for (const width of [1440, 375]) {
      const context = await contextFor('doctor', { width, height: width === 375 ? 812 : 1000 });
      const p = await context.newPage();
      p.setDefaultTimeout(15000);
      p.on('pageerror', (e) => errors.push({ scenario: 'runtime', error: e.message }));
      const go = async (tab) => {
        await p.goto(`${baseUrl}/?header-audit=${++visit}#${tab}`, {
          waitUntil: 'domcontentloaded',
        });
        await p.locator('main').waitFor();
      };
      const sidebar = async (label) => {
        if (width < 768)
          await p.getByRole('button', { name: 'Mở điều hướng', exact: true }).click();
        await p.getByRole('button', { name: label, exact: true }).last().click();
      };
      for (const tab of ['overview', 'cpoe', 'fefo', 'coldchain'])
        await attempt(`page-${tab}`, async () => {
          await go(tab);
          await take(p, `page-${tab}`, 'main', { tab, role: 'doctor' });
        });
      await attempt('coldchain-logs', async () => {
        await p.getByTestId('subtab-datalogger').click();
        await take(p, 'coldchain-logs');
      });
      await attempt('composer', async () => {
        await go('cpoe');
        await p.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
        await take(p, 'composer', '[role="dialog"]');
      });
      await attempt('prescription-details', async () => {
        await go('cpoe');
        await p.locator('[data-testid="cpoe-order-id-btn"]:visible').nth(1).click();
        const root = p.getByTestId('cpoe-order-detail-modal');
        await take(p, 'prescription-overview', '[data-testid="cpoe-order-detail-modal"]');
        for (const [group, tabs] of [
          ['Thông tin', ['Thuốc']],
          ['An toàn', ['Thông tin lâm sàng', 'Thẩm định']],
          ['Theo dõi', ['Dặn dò & lịch dùng', 'Thực hiện y lệnh', 'Thông tin ký đơn']],
        ]) {
          await root.getByRole('button', { name: group, exact: true }).click();
          for (const name of tabs) {
            await root.getByRole('tab', { name, exact: false }).click();
            await p.waitForTimeout(80);
            await take(p, `prescription-${name}`, '[data-testid="cpoe-order-detail-modal"]');
          }
        }
        await root.getByTestId('btn-open-sms-from-order').click();
        for (const tab of ['sms', 'email', 'history-sms', 'history-email', 'settings']) {
          await p.getByTestId(`tab-${tab}`).click();
          await take(p, `notification-${tab}`, '[aria-labelledby="notification-modal-title"]');
        }
      });
      await attempt('patient', async () => {
        await go('cpoe');
        await p.locator('[data-testid="patient-name-btn"]:visible').nth(1).click();
        const root = p.getByTestId('patient-detail-modal');
        for (let i = 0; i < (await root.getByRole('tab').count()); i++) {
          await root.getByRole('tab').nth(i).click();
          await take(p, `patient-${i}`, '[data-testid="patient-detail-modal"]');
        }
      });
      await attempt('drug-detail', async () => {
        await go('fefo');
        await p.locator('main [data-testid^="btn-medname-"]:visible').first().click();
        const root = p.getByTestId('dav-drug-detail-modal');
        await root.waitFor();
        await root
          .locator('[data-testid="dav-modal-loading-skeleton"]')
          .waitFor({ state: 'hidden', timeout: 12000 });
        const drugTabs = root.getByRole('tablist', { name: 'Nhóm thông tin chi tiết thuốc', exact: true }).getByRole('tab');
        const drugTabCount = await drugTabs.count();
        for (let i = 0; i < drugTabCount; i++) {
          await drugTabs.nth(i).click();
          await take(p, `drug-${i}`, '[data-testid="dav-drug-detail-modal"]');
        }
      });
      await attempt('vaccine', async () => {
        await go('coldchain');
        await p.locator('main [data-workspace-record] .record-link:visible').first().click();
        await take(p, 'vaccine', '[data-testid="dav-drug-detail-modal"]');
      });
      for (const [label, id, selector] of [
        ['Tra cứu thuốc', 'registry', '[role="dialog"][aria-label="Tra cứu thuốc"]'],
        ['Văn bản & tài liệu', 'legal', '[role="dialog"][aria-label="Văn bản và tài liệu"]'],
        ['Nhật ký hoạt động', 'audit', '[role="dialog"][aria-label="Nhật ký hoạt động"]'],
        ['Hướng dẫn', 'guide', '.clinical-modal-overlay'],
      ]) {
        await attempt(id, async () => {
          await go(id === 'registry' ? 'fefo' : 'overview');
          if (id === 'registry') await p.getByTestId('btn-open-national-registry').click();
          else await sidebar(label);
          await take(p, id, selector);
          if (id === 'guide') {
            const root = p.locator(selector).last();
            for (let i = 1; i < (await root.getByRole('tab').count()); i++) {
              await root.getByRole('tab').nth(i).click();
              await take(p, `guide-${i}`, selector);
            }
          }
        });
      }
      await attempt('settings', async () => {
        await go('overview');
        if (width < 768) await p.getByRole('button', { name: 'Mở điều hướng' }).click();
        await p.getByRole('button', { name: 'Cài đặt', exact: true }).last().click();
        await take(p, 'settings', '[aria-labelledby="app-settings-title"]');
      });
      await attempt('assistant', async () => {
        await go('overview');
        await p.getByRole('button', { name: 'Trợ lý AI lâm sàng', exact: true }).click();
        await take(p, 'assistant', '.copilot-panel');
      });
      await attempt('forms', async () => {
        await go('overview');
        await sidebar('Biểu mẫu');
        const modal = p.getByTestId('printable-form-modal');
        await modal.waitFor();
        for (let i = 0; i < 8; i++) {
          const ids = [
            'TT20_AMPOULE_DESTRUCTION',
            'TT22_RESTOCK_PROPOSAL',
            'TSC_HANDOVER_TRANSFER',
            'EMERGENCY_BORROW_TICKET',
            'EQUIPMENT_HANDOVER_INSPECT',
            'TSC_ANNUAL_AUDIT',
            'COLD_CHAIN_INCIDENT_REPORT',
            'SHIFT_HANDOVER_RECORD',
          ];
          const choice = modal.getByTestId(`form-choice-${ids[i]}`);
          if (await choice.count()) {
            if (width < 1024)
              await modal.getByRole('button', { name: 'Chọn phiếu', exact: true }).click();
            await choice.click();
          } else if (width < 768) await modal.locator('select').first().selectOption({ index: i });
          else
            await modal
              .locator('button:visible')
              .filter({ hasText: new RegExp(`^${i + 1}\\.`) })
              .click();
          await take(p, `forms-${i + 1}`, '[data-testid="printable-form-modal"]');
        }
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return { snapshots, errors };
}
