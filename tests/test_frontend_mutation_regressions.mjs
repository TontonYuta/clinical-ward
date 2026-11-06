import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CLINICAL_TEST_ORIGIN || 'http://localhost:3000';
const browser = await chromium.launch();
const selected = process.argv[2];
const rawBatch = {
  id: 'server-batch', item_name: 'Test medication 10mg', batch_number: 'SERVER-001',
  category: 'Kháng sinh', expiry_date: '2099-12-31', days_left: 10000,
  current_stock: 30, min_threshold: 25, max_threshold: 100, unit: 'Viên',
  warehouse_location: 'Kho Dược', is_near_expiry: false, is_low_stock: false,
  is_quarantined: false,
};
const order = {
  id: 'RX-REGRESSION', prescriptionType: 'outpatient', patientId: 'BN-8820',
  patientName: 'Võ Minh Trí', patientCccd: '079068012345', patientDob: '1968-05-14',
  patientGender: 'Nam', department: 'Cấp cứu', diagnosisIcd10: 'R50', diagnosisText: 'Sốt',
  daysPrescribed: 3, doctorName: 'BS. Test', doctorCertificate: '', status: 'signed',
  digitalSignature: 'untrusted assistant signature',
  items: [{ id: 'i1', medicationName: 'Paracetamol', activeIngredient: 'Paracetamol',
    dosage: '500mg', frequency: '2 lần/ngày', route: 'Uống', quantity: 6, unit: 'Viên',
    instructions: '', durationDays: 3 }],
};
const patientFixture = { id: 'BN-8820', fullName: 'Võ Minh Trí', dob: '1968-05-14', age: 58, gender: 'Nam', cccd: '079068012345', phone: '0912345678', email: 'tri.vm@hospital.vn', room: '101', department: 'Cấp cứu', allergies: '', chronicConditions: '', egfr: 90, creatinine: 80, weightKg: 60 };

async function setup({ role = 'doctor', batches = [rawBatch], inventoryStatus = 200, orders = [], patients = [patientFixture], patientStatus = 200, harness = true, coldchain = { current_temp: 4.5, is_outage: false, is_quarantined: false, vvm_level: 1, mkt_temp: 5.6, outage_minutes: 0, total_vaccine_doses: 1250, logs: [] } } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  const errors = [];
  let failWrites = true;
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      requests.push({ pathname, body: request.postDataJSON() });
      if (failWrites) return route.fulfill({ status: 400, json: { detail: 'Server rejected operation' } });
      if (pathname.endsWith('/simulate-outage')) {
        coldchain = { ...coldchain, current_temp: 11, is_outage: true, is_quarantined: true, outage_minutes: 12 };
        batches = batches.map(batch => batch.cold_storage_required ? { ...batch, is_dispatchable: false, dispatch_hold_reason: 'Đang biệt trữ theo trạng thái tủ' } : batch);
      }
      if (pathname.endsWith('/restore-power')) coldchain = { ...coldchain, current_temp: 4.5, is_outage: false };
      if (pathname.endsWith('/release-quarantine')) coldchain = { ...coldchain, is_quarantined: false };
      if (pathname.includes('/coldchain/')) return route.fulfill({ json: { message: 'Saved' } });
      if (pathname.endsWith('/dispatch')) return route.fulfill({ json: { ...rawBatch, current_stock: 20, is_low_stock: true } });
      return route.fulfill({ status: 201, json: { ...request.postDataJSON(), id: 'RX-SERVER-ID' } });
    }
    if (pathname.endsWith('/auth/me')) return route.fulfill({ json: { authenticated: true, enabled: false, username: 'demo', role } });
    if (pathname.endsWith('/patients')) return route.fulfill({ status: patientStatus, json: patientStatus === 200 ? patients : { detail: 'Patient data unavailable' } });
    if (pathname.endsWith('/inventory/batches') && inventoryStatus !== 200) return route.fulfill({ status: inventoryStatus, json: { detail: 'Inventory unavailable' } });
    return route.fulfill({ json: pathname.endsWith('/inventory/batches') ? batches : pathname.endsWith('/coldchain/status') ? coldchain : pathname.endsWith('/cpoe') ? orders : [] });
  });
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  if (harness) {
    // Replace presentation only: execute real App callbacks and HTTP adapters without hidden UI paths.
    const component = (name, globalName, content = 'null') =>
      `import React from '/node_modules/.vite/deps/react.js'; export function ${name}(props) { window.${globalName} = props; return ${content}; }`;
    await context.route('**/src/components/RightPane/Dashboard.tsx*', route => route.fulfill({
      contentType: 'text/javascript', body: component('Dashboard', 'dashboardProps', "React.createElement('pre', {id:'test-batches'}, JSON.stringify(props.batches))"),
    }));
    await context.route('**/src/components/LeftPane/ChatWindow.tsx*', route => route.fulfill({
      contentType: 'text/javascript', body: component('ChatWindow', 'chatProps'),
    }));
    await context.route('**/src/components/Modals/ClinicalAuthModal.tsx*', route => route.fulfill({
      contentType: 'text/javascript', body: component('ClinicalAuthModal', 'authProps'),
    }));
  }
  await context.addInitScript(({ role, harness }) => {
    localStorage.setItem('clinical_user_role', role);
    localStorage.setItem('clinical_audio_muted', 'true');
    localStorage.setItem('clinical_copilot_open', String(harness));
    localStorage.setItem('clinical_chat_messages', JSON.stringify([{ id: 'regression-card', sender: 'agent', text: 'Review draft', card: { type: 'cpoe_order', status: 'pending' } }]));
    window.savedEvents = [];
    window.addEventListener('cpoe_order_created', e => window.savedEvents.push(e.detail));
  }, { role, harness });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/#${harness ? 'fefo' : 'cpoe'}`);
  if (harness) {
    await page.waitForFunction(() => window.dashboardProps && window.chatProps && window.authProps);
    await page.waitForFunction(() => Number.isFinite(window.dashboardProps.coldChainState.currentTemp));
  }
  return { context, page, requests, errors, allowWrites: () => { failWrites = false; } };
}

async function caseRun(name, run) {
  if (selected && !name.includes(selected)) return;
  await run();
  console.log(`PASS ${name}`);
}

try {
  await caseRun('patient source accepts empty data and never restores fixtures after denied requests', async () => {
    for (const patientStatus of [200, 401, 403, 503]) {
      const { context, page } = await setup({ patients: [], patientStatus });
      await page.evaluate(patient => localStorage.setItem('clinical_patients_cache_v1', JSON.stringify([patient])), patientFixture);
      const result = await page.evaluate(async () => {
        const { fetchPatients } = await import('/src/services/patientService.ts');
        return fetchPatients().then(patients => ({ patients }), () => ({ patients: [] }));
      });
      assert.deepEqual(result.patients, [], `status ${patientStatus} must not resurrect cached/sample people`);
      assert.deepEqual(await page.evaluate(() => window.dashboardProps.patients), []);
      if (patientStatus === 401 || patientStatus === 403) assert.equal(await page.evaluate(() => localStorage.getItem('clinical_patients_cache_v1')), null);
      await context.close();
    }
  });
  await caseRun('CPOE patient consumers use the shared server registry', async () => {
    const patient = { ...patientFixture, id: 'BN-REAL-SOURCE', fullName: 'Người bệnh từ máy chủ', cccd: 'REAL-IDENTITY-123', phone: '0909888777', email: 'real-source@example.test' };
    const prescription = { ...order, patientId: patient.id, patientName: patient.fullName, patientCccd: '', patientPhone: undefined, patientEmail: undefined, id: 'RX-SHARED-SOURCE' };
    const { context, page } = await setup({ harness: false, patients: [patient], orders: [prescription] });
    await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
    const selector = page.locator('select').filter({ has: page.locator('option[value="BN-REAL-SOURCE"]') });
    assert.equal(await selector.count(), 1, 'composer must use server patients');
    await selector.selectOption(patient.id);
    assert.equal(await page.locator('input[placeholder="001201019283"]').inputValue(), patient.cccd);
    assert.equal(await page.locator('option[value="BN-8820"]').count(), 0, 'sample identity must not be offered');
    await page.getByRole('button', { name: 'Đóng form kê đơn', exact: true }).click();
    await page.locator('.desktop-records [data-testid="patient-name-btn"]').click();
    await page.getByTestId('patient-detail-modal').waitFor();
    assert.ok((await page.getByTestId('patient-detail-modal').innerText()).includes(patient.id));
    await page.getByTestId('btn-close-patient-detail').click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open_prescription_advice_modal', { detail: { orderId: 'RX-SHARED-SOURCE' } })));
    await page.locator('input[placeholder="nhap-email-benh-nhan@example.com"]').waitFor();
    assert.equal(await page.locator('input[placeholder="nhap-email-benh-nhan@example.com"]').inputValue(), patient.email);
    assert.equal(await page.locator('input[placeholder="Ví dụ: 09xxxxxxxx"]').inputValue(), patient.phone);
    await context.close();
  });
  await caseRun('CPOE normalization preserves unknown fields without inventing identities or diagnoses', async () => {
    const { context, page, errors } = await setup({ harness: false, orders: [{ id: 'RX-UNKNOWN', items: [] }, { items: [] }] });
    await page.waitForFunction(() => localStorage.getItem('clinical_cached_cpoe'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clinical_cached_cpoe')));
    assert.equal(saved.length, 1, 'an order without an identifier is discarded');
    for (const field of ['patientId', 'patientName', 'diagnosisIcd10', 'diagnosisText', 'doctorName']) assert.equal(saved[0][field], '', `${field} remains unknown`);
    assert.ok((await page.locator('.desktop-records tbody').innerText()).includes('Chưa ghi nhận'));
    assert.deepEqual(errors, []);
    await context.close();
  });
  await caseRun('local audit entries are explicitly simulated and have no fake cryptographic proof', async () => {
    const { context, page, allowWrites } = await setup({ role: 'pharmacist' });
    assert.deepEqual(await page.evaluate(() => window.dashboardProps.auditRecords), [], 'session begins with no fixture audit records');
    allowWrites();
    await page.waitForFunction(() => window.dashboardProps.batches.some(b => b.id === 'server-batch'));
    await page.evaluate(async () => {
      window.dashboardProps.onDispatchBatch('server-batch', 10);
    });
    await page.evaluate(async () => window.authProps.request.onConfirm({ name: 'DS. Test', role: 'pharmacist', roleName: 'Dược sĩ', practiceCertificate: 'TEST' }, undefined, 'PIN'));
    const record = await page.evaluate(() => window.dashboardProps.auditRecords[0]);
    assert.equal(record.status, 'session_simulated');
    assert.ok(!record.integrityHash);
    assert.ok((await page.evaluate(() => window.chatProps.messages.at(-1).text)).includes('Nhật ký phiên'));
    await context.close();
  });
  await caseRun('printable form requests reject unsupported runtime values', async () => {
    const { context, page, errors } = await setup();
    for (const formType of ['INVALID_FORM', '__proto__', 'constructor']) {
      await page.evaluate(formType => window.chatProps.onExecuteCardAction('regression-card', 'OPEN_PRINTABLE_FORM', { formType }), formType);
      await page.waitForTimeout(50);
    }
    assert.deepEqual(errors, [], 'invalid form keys must not crash the render tree');
    assert.equal(await page.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).count(), 0);
    await context.close();
  });
  await caseRun('coldchain restore leaves audio untouched until authorization succeeds', async () => {
    const { context, page } = await setup();
    await page.evaluate(async () => {
      window.chatProps.onClose();
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { ColdChainTab } = await import('/src/components/RightPane/Tabs/ColdChainTab.tsx');
      const { clinicalAudio } = await import('/src/utils/audio.ts');
      window.audioStops = 0; window.audioSuccesses = 0; window.restoreRequests = 0;
      clinicalAudio.stopAlarm = () => { window.audioStops++; };
      clinicalAudio.playSuccessChime = () => { window.audioSuccesses++; };
      const host = document.createElement('div'); document.body.appendChild(host);
      host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white';
      ReactDOM.createRoot(host).render(React.createElement(ColdChainTab, { coldChainState: { currentTemp: 11, currentHumidity: 54, totalVaccineDoses: 1250, alarmActive: true, quarantineStatus: 'quarantined', logs: [] }, isAudioMuted: false, onTriggerOutage() {}, onRestorePower() { window.restoreRequests++; } }));
    });
    await page.getByRole('button', { name: 'Tùy chọn', exact: true }).click();
    await page.getByRole('button', { name: 'Khôi phục điện', exact: true }).first().click();
    assert.equal(await page.evaluate(() => window.restoreRequests), 1);
    assert.equal(await page.evaluate(() => window.audioStops), 0, 'opening auth must not silence the active alarm');
    assert.equal(await page.evaluate(() => window.audioSuccesses), 0);
    await context.close();
  });
  await caseRun('coldchain inventory shows only real stock and unknown storage metadata', async () => {
    const coldBatch = { ...rawBatch, id: 'real-cold-stock', item_name: 'RealColdStock', current_stock: 7, cold_storage_required: true, cold_chain_state_id: null, cold_storage_link_verified: false, cold_storage_unknown_reason: 'Chưa xác nhận liên kết tủ', is_dispatchable: false, dispatch_hold_reason: 'Chờ xác nhận liên kết kho lạnh' };
    const { context, page } = await setup({ harness: false, role: 'pharmacist', batches: [coldBatch] });
    await page.goto(`${origin}/#coldchain`);
    await page.waitForTimeout(100);
    const text = await page.locator('#workspace-main').innerText();
    assert.ok(text.includes('RealColdStock'), 'reported cold storage batch must be displayed');
    assert.ok(!text.includes('Verorab'), 'fictional vaccine catalog must not appear');
    assert.ok(text.includes('Chưa xác nhận liên kết tủ'));
    assert.ok(text.includes('Chưa có dữ liệu VVM'));
    const humidity = page.locator('.telemetry-item').filter({ hasText: 'Độ ẩm ghi nhận' });
    assert.ok((await humidity.innerText()).includes('—'), 'unreported humidity must remain unknown');
    await context.close();
  });
  await caseRun('coldchain mutations refresh server inventory holds', async () => {
    const { context, page, allowWrites } = await setup({ role: 'pharmacist', batches: [{ ...rawBatch, cold_storage_required: true, cold_storage_link_verified: true, cold_chain_state_id: 1, is_dispatchable: true }] });
    await page.waitForFunction(() => window.dashboardProps.batches[0]?.id === 'server-batch');
    allowWrites();
    await page.evaluate(async () => window.dashboardProps.onTriggerOutage());
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].isDispatchable), false, 'outage refresh must obtain server holds for the inventory view');
    await context.close();
  });
  await caseRun('AI audit distinguishes unverified signature from unsigned order', async () => {
    const { context, page } = await setup();
    await context.route('**/api/v1/prescriptions/audit', route => route.fulfill({ json: { overall_status: 'WARNING', safety_score: 80, doctor_signature_verified: false, legal_checks: [], clinical_checks: [], drug_interactions: [], recommendations: [] } }));
    await page.evaluate(async order => {
      window.chatProps.onClose();
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { AiPrescriptionAuditView } = await import('/src/components/RightPane/Tabs/CPOE/AiPrescriptionAuditView.tsx');
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white'; document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(AiPrescriptionAuditView, { order }));
    }, order);
    await page.waitForTimeout(150);
    assert.equal(await page.getByText('Chưa xác minh chữ ký', { exact: true }).count(), 1);
    assert.equal(await page.getByText('CHỜ BÁC SĨ KÝ TÊN', { exact: true }).count(), 0);
    await context.close();
  });
  await caseRun('CPOE trusts empty server response and removes synthetic orders', async () => {
    for (const orders of [[], [{ ...order, id: 'RX-AUTHORITATIVE', status: 'draft' }]]) {
      const { context, page } = await setup({ harness: false, orders });
      await page.waitForFunction(expected => JSON.stringify(JSON.parse(localStorage.getItem('clinical_cached_cpoe') || 'null')?.map(o => o.id)) === JSON.stringify(expected), orders.map(o => o.id));
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('clinical_cached_cpoe') || 'null')?.map(o => o.id)), orders.map(o => o.id));
      await context.close();
    }
  });
  await caseRun('advice event requires an explicit existing prescription', async () => {
    const { context, page } = await setup({ harness: false, orders: [{ ...order, id: 'RX-EXPLICIT', status: 'draft' }] });
    await page.waitForTimeout(150);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open_prescription_advice_modal', { detail: { patientName: 'Another patient' } })));
    assert.equal(await page.getByRole('heading', { name: 'Dặn dò & Lên lịch nhắc uống thuốc hàng ngày' }).count(), 0, 'missing order must never choose a sample patient');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open_prescription_advice_modal', { detail: { orderId: 'RX-EXPLICIT' } })));
    await page.getByRole('heading', { name: 'Dặn dò & Lên lịch nhắc uống thuốc hàng ngày' }).waitFor();
    assert.ok((await page.locator('.clinical-modal-overlay').innerText()).includes('RX-EXPLICIT'));
    await context.close();
  });
  await caseRun('patient records use identity and refresh when reopened or order created', async () => {
    const { context, page } = await setup();
    const patient = { id: 'BN-IDENTITY-1', fullName: 'Nguyễn Văn Chung', gender: 'Nam', email: '', room: '101', allergies: '', chronicConditions: '', egfr: 90, creatinine: 80, weightKg: 60 };
    const first = { ...order, patientId: patient.id, patientName: patient.fullName, id: 'RX-RIGHT' };
    await page.evaluate(async ({ patient, first, wrong }) => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { PatientDetailModal } = await import('/src/components/Modals/PatientDetailModal.tsx');
      localStorage.setItem('clinical_cached_cpoe', JSON.stringify([first, wrong, { ...wrong, patientId: '', id: 'RX-AMBIGUOUS' }]));
      const host = document.createElement('div'); document.body.appendChild(host);
      const root = ReactDOM.createRoot(host);
      window.renderPatient = isOpen => root.render(React.createElement(PatientDetailModal, { isOpen, onClose() {}, patient, patients: [patient, { ...patient, id: 'BN-IDENTITY-2' }] }));
      window.renderPatient(true);
    }, { patient, first, wrong: { ...first, patientId: 'BN-IDENTITY-2', id: 'RX-WRONG' } });
    const detail = page.getByTestId('patient-detail-modal');
    await detail.waitFor();
    assert.equal(await detail.getByRole('tab', { name: 'Điều trị (1)', exact: true }).count(), 1, 'same-name patient with another ID and ambiguous unlinked orders must be excluded');
    await page.evaluate(first => { window.renderPatient(false); localStorage.setItem('clinical_cached_cpoe', JSON.stringify([first, { ...first, id: 'RX-NEW' }])); }, first);
    await detail.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.renderPatient(true));
    await detail.getByRole('tab', { name: 'Điều trị (2)', exact: true }).waitFor();
    await page.evaluate(first => { localStorage.setItem('clinical_cached_cpoe', JSON.stringify([first, { ...first, id: 'RX-NEW' }, { ...first, id: 'RX-EVENT' }])); window.dispatchEvent(new CustomEvent('cpoe_order_created', { detail: { ...first, id: 'RX-EVENT' } })); }, first);
    await detail.getByRole('tab', { name: 'Điều trị (3)', exact: true }).waitFor();
    await context.close();
  });
  await caseRun('inventory trusts authoritative empty response', async () => {
    const { context, page } = await setup({ batches: [] });
    await page.waitForFunction(() => window.dashboardProps.batches.length === 0, { timeout: 3000 });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('clinical_cached_batches')).length), 0);
    await context.close();
  });
  await caseRun('inventory never appends synthetic rows', async () => {
    const { context, page } = await setup();
    await page.waitForFunction(() => window.dashboardProps.batches.some(b => b.id === 'server-batch'));
    assert.deepEqual(await page.evaluate(() => window.dashboardProps.batches.map(b => b.id)), ['server-batch']);
    await context.close();
  });
  await caseRun('inventory unavailable source does not display cached or sample stock', async () => {
    const { context, page } = await setup({ inventoryStatus: 503 });
    assert.deepEqual(await page.evaluate(() => window.dashboardProps.batches), []);
    assert.ok((await page.locator('#workspace-main').innerText()).includes('Tồn kho chưa khả dụng'));
    await context.close();
  });
  await caseRun('assistant CPOE denies non-prescriber', async () => {
    const { context, page, requests } = await setup({ role: 'nurse' });
    await page.evaluate(order => window.chatProps.onExecuteCardAction('regression-card', 'EXECUTE_CREATE_CPOE_ORDER', order), order);
    assert.equal(requests.length, 0, 'nurse must not create an order through an assistant callback');
    assert.equal(await page.evaluate(() => window.savedEvents.length), 0);
    await context.close();
  });
  await caseRun('assistant CPOE rejection never creates local success', async () => {
    const { context, page, requests } = await setup();
    await page.evaluate(order => window.chatProps.onExecuteCardAction('regression-card', 'EXECUTE_CREATE_CPOE_ORDER', order), order);
    await page.waitForTimeout(150);
    assert.equal(requests.length, 1);
    assert.equal(await page.evaluate(() => window.savedEvents.length), 0, 'rejected server order must not be broadcast');
    assert.equal(await page.evaluate(() => window.chatProps.messages.some(m => m.text.includes('tạo đơn thuốc thành công'))), false);
    await context.close();
  });
  await caseRun('assistant CPOE saves only validated unsigned drafts', async () => {
    const { context, page, requests, allowWrites } = await setup();
    allowWrites();
    await page.evaluate(order => window.chatProps.onExecuteCardAction('regression-card', 'EXECUTE_CREATE_CPOE_ORDER', order), { ...order, items: [] });
    assert.equal(requests.length, 0, 'invalid drafts must be blocked before POST');
    await page.evaluate(order => window.chatProps.onExecuteCardAction('regression-card', 'EXECUTE_CREATE_CPOE_ORDER', order), order);
    await page.waitForFunction(() => window.savedEvents.length === 1);
    assert.equal(requests[0].body.status, 'draft');
    assert.ok(!requests[0].body.digitalSignature, 'assistant-provided signature is discarded');
    assert.equal(await page.evaluate(() => window.savedEvents[0].id), 'RX-SERVER-ID', 'broadcast server identity');
    await context.close();
  });
  await caseRun('FEFO validates quantity and persists before audit', async () => {
    const { context, page, requests, allowWrites } = await setup({ role: 'pharmacist' });
    await page.waitForFunction(() => window.dashboardProps.batches.some(b => b.id === 'server-batch'));
    for (const quantity of [-2, 0, 1.5, 31]) {
      await page.evaluate(qty => window.dashboardProps.onDispatchBatch('server-batch', qty), quantity);
      assert.equal(await page.evaluate(() => window.authProps.request), null, `invalid quantity ${quantity} must not start signing`);
    }
    const sign = () => page.evaluate(async () => {
      await window.authProps.request.onConfirm({ name: 'DS. Test', role: 'pharmacist', roleName: 'Dược sĩ', practiceCertificate: 'TEST' }, undefined, 'PIN');
    });
    await page.evaluate(() => window.dashboardProps.onDispatchBatch('server-batch', 10));
    await assert.rejects(sign(), /Server rejected operation/);
    assert.equal(requests.length, 1, 'dispatch must reach backend');
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].currentStock), 30, 'rejection leaves stock unchanged');
    assert.equal(await page.evaluate(() => window.dashboardProps.auditRecords.filter(a => a.actionType === 'DISPATCH_FEFO' && a.targetItem.includes('SERVER-001')).length), 0);
    allowWrites();
    await page.evaluate(() => window.dashboardProps.onDispatchBatch('server-batch', 10));
    await sign();
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].currentStock), 20);
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].isLowStock), true);
    await context.close();
  });
  await caseRun('restock proposals never manufacture inventory', async () => {
    const { context, page, requests, allowWrites } = await setup({ role: 'pharmacist' });
    await page.waitForFunction(() => window.dashboardProps.batches.some(b => b.id === 'server-batch'));
    const sign = () => page.evaluate(async () => {
      await window.authProps.request.onConfirm({ name: 'DS. Test', role: 'pharmacist', roleName: 'Dược sĩ', practiceCertificate: 'TEST' }, undefined, 'PIN');
    });
    await page.evaluate(() => window.dashboardProps.onRestockBatches(['server-batch']));
    await assert.rejects(sign(), /Server rejected operation/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].pathname, '/api/v1/inventory/restock-proposal');
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].currentStock), 30);
    allowWrites();
    await page.evaluate(() => window.dashboardProps.onRestockBatches(['server-batch']));
    await sign();
    assert.equal(await page.evaluate(() => window.dashboardProps.batches[0].currentStock), 30, 'proposal is not receipt of physical stock');
    await context.close();
  });
  await caseRun('coldchain refresh restores server quarantine and transitions persist', async () => {
    const { context, page, requests, allowWrites } = await setup({ role: 'pharmacist', coldchain: { current_temp: 11, is_outage: true, is_quarantined: true, vvm_level: 1, mkt_temp: 6.25, outage_minutes: 12, total_vaccine_doses: 800, logs: [] } });
    await page.waitForFunction(() => window.dashboardProps.coldChainState.totalVaccineDoses === 800, null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.quarantineStatus), 'quarantined');
    const sign = () => page.evaluate(async () => {
      await window.authProps.request.onConfirm({ name: 'DS. Test', role: 'pharmacist', roleName: 'Dược sĩ', practiceCertificate: 'TEST' }, { name: 'BS. Witness', role: 'doctor' }, 'PIN');
    });
    await page.evaluate(() => window.dashboardProps.onRestorePower());
    await assert.rejects(sign(), /Server rejected operation/);
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.currentTemp), 11);
    allowWrites();
    await page.evaluate(() => window.dashboardProps.onRestorePower());
    await sign();
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.currentTemp), 4.5);
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.quarantineStatus), 'quarantined');
    await page.evaluate(() => window.dashboardProps.onReleaseQuarantine());
    await sign();
    assert.equal(requests.at(-1).body.mkt_confirmed, 6.25, 'release uses current server MKT rather than a fixed example');
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.quarantineStatus), 'normal');
    await page.reload();
    await page.waitForFunction(() => window.dashboardProps.coldChainState.totalVaccineDoses === 800);
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.quarantineStatus), 'normal');
    await context.close();
  });
  await caseRun('coldchain outage rejects unauthorized roles and waits for server', async () => {
    const denied = await setup({ role: 'nurse' });
    await denied.page.evaluate(() => window.dashboardProps.onTriggerOutage());
    assert.equal(denied.requests.length, 0);
    assert.equal(await denied.page.evaluate(() => window.dashboardProps.coldChainState.currentTemp), 4.5);
    await denied.context.close();
    const { context, page, requests, allowWrites } = await setup({ role: 'pharmacist' });
    await page.evaluate(() => window.dashboardProps.onTriggerOutage());
    assert.equal(requests.length, 1);
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.currentTemp), 4.5);
    allowWrites();
    await page.evaluate(() => window.dashboardProps.onTriggerOutage());
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.currentTemp), 11);
    assert.equal(await page.evaluate(() => window.dashboardProps.coldChainState.quarantineStatus), 'quarantined');
    await context.close();
  });
  await caseRun('coldchain unavailable status is visible in workspace', async () => {
    const { context, page } = await setup();
    await context.route('**/api/v1/coldchain/status', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }));
    await page.reload();
    await page.waitForFunction(() => window.dashboardProps);
    await page.evaluate(() => window.dashboardProps.onTabChange('coldchain'));
    assert.equal(await page.getByRole('status').filter({ hasText: 'Chưa xác nhận trạng thái chuỗi lạnh' }).count(), 1);
    assert.equal(await page.evaluate(() => Number.isFinite(window.dashboardProps.coldChainState.currentTemp)), false, 'unavailable sensor must not show the example temperature as measured data');
    await context.close();
  });
  await caseRun('prescription name changes clear prior patient identity', async () => {
    const { context, page } = await setup({ harness: false });
    await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
    const selector = page.locator('select').filter({ has: page.locator('option[value="BN-8820"]') });
    await selector.selectOption('BN-8820');
    await page.locator('input[placeholder="Nguyễn Văn A"]').fill('Người bệnh mới');
    assert.equal(await selector.inputValue(), '', 'editing the patient clears the selected record');
    assert.equal(await page.locator('input[placeholder="001201019283"]').inputValue(), '', 'CCCD must not leak from prior patient');
    assert.equal(await page.locator('input[placeholder="09xxxxxxxx"]').inputValue(), '', 'phone must not leak from prior patient');
    await context.close();
  });
  await caseRun('prescription composer resets when reopened', async () => {
    const { context, page } = await setup({ harness: false });
    await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
    await page.locator('input[placeholder="Nguyễn Văn A"]').fill('Previous patient');
    await page.getByRole('button', { name: 'Đóng form kê đơn', exact: true }).click();
    await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
    assert.equal(await page.locator('input[placeholder="Nguyễn Văn A"]').inputValue(), '', 'new composer must start with no previous patient');
    await context.close();
  });
  await caseRun('prescription preserves selected route and dispensing unit', async () => {
    const { context, page, requests, allowWrites } = await setup({ harness: false });
    allowWrites();
    await page.getByRole('button', { name: 'Kê đơn mới', exact: true }).click();
    await page.locator('input[placeholder="Nguyễn Văn A"]').fill('Người bệnh mới');
    await page.locator('input[placeholder="Nhập chẩn đoán lâm sàng..."]').fill('Hen');
    await page.locator('input[placeholder="Bắt buộc với trẻ < 72 tháng"]').fill('25');
    await page.locator('input[placeholder="Số thẻ BHYT"]').fill('INSURANCE-TEST');
    const search = page.locator('input[placeholder="Tìm biệt dược hoặc hoạt chất"]');
    await search.fill('Salbutamol');
    await search.press('Enter');
    await page.getByRole('textbox', { name: 'Liều mỗi lần', exact: true }).fill('2.5mg');
    await page.getByRole('textbox', { name: 'Tần suất', exact: true }).fill('2 lần/ngày');
    await page.locator('#prescription-days').fill('3');
    await page.getByRole('spinbutton', { name: 'Số lượng', exact: true }).fill('6');
    await page.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption('Gói');
    await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal(requests.length, 1, await page.evaluate(() => document.querySelector('form')?.innerText || 'composer closed'));
    assert.equal(requests[0].body.items[0].route, 'Khí dung qua mặt nạ');
    assert.equal(requests[0].body.items[0].unit, 'Gói');
    assert.equal(requests[0].body.patientWeight, 25);
    assert.equal(requests[0].body.patientInsuranceId, 'INSURANCE-TEST');
    await context.close();
  });
} finally {
  await browser.close();
}
