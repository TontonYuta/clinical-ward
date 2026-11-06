import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDemoAuth } from './helpers/mockDemoAuth.mjs';
const browser = await chromium.launch();
const selected = process.argv[2];
const patient = { id: 'BN-TEMPLATE', fullName: 'Người bệnh nguồn', phone: '0909888777', email: 'source@example.test', gender: 'Nữ', room: 'Vị trí nguồn', allergies: '', chronicConditions: '', egfr: 90, creatinine: 80, weightKg: 60 };
const order = { clinicalNotes: 'GLOBAL-SOURCE-INSTRUCTION', facilityName: null, id: 'RX-DRAFT-SOURCE', status: 'draft', prescriptionType: 'outpatient', patientId: patient.id, patientName: patient.fullName, patientCccd: '', patientPhone: patient.phone, patientEmail: patient.email, patientDob: '', patientGender: 'Nữ', department: 'Khoa trên nguồn', diagnosisIcd10: 'SOURCE', diagnosisText: 'Chẩn đoán trên nguồn', doctorName: '', doctorCertificate: '', prescribedAt: '2026-11-05 08:15:00', daysPrescribed: 2, isChronicDisease: false, items: [{ id: 'i1', medicationName: 'Thuốc nguồn A', activeIngredient: 'Hoạt chất nguồn A', dosage: '2 ml', frequency: 'mỗi 8 giờ', route: 'Tiêm bắp', quantity: 6, unit: 'ống', instructions: 'Chỉ dẫn trên nguồn A', durationDays: 2 }, { id: 'i2', medicationName: 'Thuốc nguồn B', activeIngredient: 'Hoạt chất nguồn B', dosage: '1 gói', frequency: 'ngày 1 lần', route: 'Uống', quantity: 2, unit: 'gói', instructions: '', durationDays: 2 }] };
async function setup(doctorName = '') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const writes = [];
  await context.route('**/api/v1/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      const data = request.postDataJSON(); writes.push({ path, data });
      if (path.endsWith('/send-email')) return route.fulfill({ json: { success: true, message: 'Accepted', timestamp: '2026-11-05T10:00:00Z', emailSentTo: patient.email, provider: 'backend_relay' } });
      return route.fulfill({ status: 201, json: data });
    }
    if (path.endsWith('/cpoe')) return route.fulfill({ json: [{ ...order, doctorName }] });
    if (path.endsWith('/patients')) return route.fulfill({ json: [patient] });
    if (path.endsWith('/sms/templates')) return route.fulfill({ json: [
      { id: 'old-prescription', category: 'cpoe_prescription', title: 'Legacy prescription template', description: 'da ky so toan quoc', template: '[BV LAM SANG] BS {doctorName} da ky don tai https://donthuocquocgia.vn/?id={orderId}' },
      { id: 'old-advice', category: 'medication_advice', title: 'Legacy advice template', description: 'uống sáng tối', template: 'Sang07:30 1 vien sau an, toi20:00 1 vien truoc ngu' },
      { id: 'old-notice', category: 'hospital_notice', title: 'Legacy notice template', description: 'đã thanh toán', template: 'Da thanh toan vien phi, tai kham sau30ngay' },
    ] });
    if (path.endsWith('/coldchain/status')) return route.fulfill({ json: { id: 1, current_temp: 4.5, is_outage: false, is_quarantined: false, vvm_level: 1, mkt_temp: 5.6, outage_minutes: 0, total_vaccine_doses: 0, logs: [] } });
    return route.fulfill({ json: [] });
  });
  await mockDemoAuth(context);
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.addInitScript(() => { localStorage.setItem('clinical_user_role', 'doctor'); localStorage.setItem('clinical_audio_muted', 'true'); });
  const page = await context.newPage();
  await page.goto(process.env.CLINICAL_TEST_ORIGIN || 'http://localhost:3000/#cpoe');
  await page.getByTestId('cpoe-order-id-btn').filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Gửi thông báo cho BN', exact: true }).click();
  const modal = page.getByTestId('send-sms-modal'); await modal.waitFor();
  return { context, page, modal, writes };
}
function truthful(text) {
  for (const claim of ['BV LAM SANG', 'BV_LAMSANG', 'ĐA KHOA LÂM SÀNG', 'Trần Văn Hùng', 'donthuocquocgia', 'toàn quốc', 'Quốc gia', 'đã hoàn tất', 'đã ký số', 'da ky', '07:30', '20:00', '19:30', 'PARACETAMOL', '30 ngày', 'Phòng 204']) assert.ok(!text.includes(claim), 'must not invent ' + claim);
}
function sourceDetails(text) {
  for (const value of ['GLOBAL-SOURCE-INSTRUCTION', 'RX-DRAFT-SOURCE', 'Bản nháp', 'nội bộ', 'Thuốc nguồn A', '2 ml', 'mỗi 8 giờ', 'Tiêm bắp', 'Thuốc nguồn B', '1 gói', 'ngày 1 lần', 'Uống']) assert.ok(text.includes(value), 'retain source ' + value);
}
async function run(name, test) { if (selected && !name.includes(selected)) return; await test(); console.log('PASS ' + name); }
try {
  await run('draft SMS default and all category templates preserve source facts', async () => {
    const { context, modal } = await setup();
    const content = modal.getByRole('textbox', { name: 'Nội dung tin nhắn SMS', exact: true });
    truthful(await content.inputValue()); sourceDetails(await content.inputValue());
    for (const category of ['cpoe_prescription', 'medication_advice', 'hospital_notice']) {
      await modal.getByTestId('notification-template-' + category).filter({ visible: true }).click();
      truthful(await content.inputValue()); sourceDetails(await content.inputValue());
    }
    await modal.getByRole('button', { name: '+ Chèn đơn', exact: true }).click();
    truthful(await content.inputValue()); sourceDetails(await content.inputValue());
    assert.equal((await content.inputValue()).match(/Thuốc nguồn A/g)?.length, 1, 'inserting source summary does not duplicate an existing summary');
    assert.ok(!(await modal.innerText()).includes('BS:'));
    assert.ok(!(await modal.locator('input[readonly]').first().inputValue()).includes('BV_LAMSANG'));
    await context.close();
  });
  await run('email templates and insert retain draft metadata without invented prescribing', async () => {
    const { context, modal, writes } = await setup('operator.actual');
    await modal.getByTestId('tab-email').click();
    const content = modal.getByRole('textbox', { name: 'Nội dung thư gửi bệnh nhân', exact: true });
    truthful(await content.inputValue()); sourceDetails(await content.inputValue());
    for (const category of ['cpoe_prescription', 'medication_advice', 'hospital_notice']) {
      await modal.getByTestId('notification-template-' + category).filter({ visible: true }).click();
      const text = await content.inputValue(); truthful(text); sourceDetails(text);
      assert.ok(text.includes('operator.actual') && !text.includes('BS operator.actual'));
    }
    await modal.getByRole('button', { name: '+ Chèn đơn', exact: true }).click();
    truthful(await content.inputValue()); sourceDetails(await content.inputValue());
    assert.equal(await modal.getByText('Tiêu đề thư (Subject) *', { exact: true }).count(), 0, 'unused subject editor is removed');
    await modal.getByRole('button', { name: /Gửi.*Email|Gửi thông báo|Gửi ngay/i }).filter({ visible: true }).last().click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const sent = writes.find(write => write.path.endsWith('/send-email'))?.data;
    assert.ok(sent, 'email request was recorded');
    truthful(sent.generalDoctorAdvice); sourceDetails(sent.generalDoctorAdvice);
    assert.equal(sent.doctorName, 'operator.actual');
    assert.ok(!sent.doctorHospital, 'absent facility cannot become a named institution');
    assert.equal(sent.department, 'Khoa trên nguồn');
    assert.deepEqual(sent.medications.map(item => [item.medicationName, item.frequency, item.route]), [['Thuốc nguồn A', 'mỗi 8 giờ', 'Tiêm bắp'], ['Thuốc nguồn B', 'ngày 1 lần', 'Uống']]);
    assert.equal(sent.endDate, '', 'no invented treatment end date');
    await context.close();
  });
} finally { await browser.close(); }
