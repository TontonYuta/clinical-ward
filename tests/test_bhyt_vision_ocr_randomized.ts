/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Randomized Property-Based Integration Test Suite:
 * BHYT Multimodal Vision OCR, Universal Third-Party Gateway & HITL Ingestion
 */

process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

import assert from 'node:assert';
import { bhytApi } from '../src/services/api/bhytApi';
import { HospitalRank, TreatmentType } from '../src/types/bhyt';
import { auditBhytPrescription } from '../src/services/bhytAuditEngine';

const SAMPLE_RANDOM_DRUGS = [
  { name: 'Panadol Extra 500mg', ingredient: 'Paracetamol', dosage: '500mg', atc: 'N02BE01' },
  { name: 'Voltaren 50mg', ingredient: 'Diclofenac', dosage: '50mg', atc: 'M01AB05' },
  { name: 'Amlor 5mg', ingredient: 'Amlodipin', dosage: '5mg', atc: 'C08CA01' },
  { name: 'Glucophage 850mg', ingredient: 'Metformin', dosage: '850mg', atc: 'A10BA02' },
  { name: 'Nexium 40mg', ingredient: 'Esomeprazol', dosage: '40mg', atc: 'A02BC05' },
  { name: 'Lipitor 20mg', ingredient: 'Atorvastatin', dosage: '20mg', atc: 'C10AA05' },
  { name: 'Coversyl 5mg', ingredient: 'Perindopril', dosage: '5mg', atc: 'C09AA04' },
  { name: 'Micardis 40mg', ingredient: 'Telmisartan', dosage: '40mg', atc: 'C09CA07' },
];

async function runRandomizedOcrTests() {
  console.log('================================================================');
  console.log('   BHYT VISION OCR & UNIVERSAL GATEWAY: RANDOMIZED VERIFICATION');
  console.log('================================================================');

  // 1. Kiểm thử trích xuất và phân giải thực thể qua OCR endpoint thực tế
  console.log('\n--- 1. Testing OCR Endpoint with Randomized Prescriptions ---');
  for (let trial = 1; trial <= 15; trial++) {
    const numItems = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...SAMPLE_RANDOM_DRUGS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, numItems);

    const randName = `Bệnh nhân ngẫu nhiên #${Math.floor(Math.random() * 900) + 100}`;
    const randCard = `GD479${Math.floor(Math.random() * 9000000000) + 1000000000}`;
    const rawTextLines = [
      `ĐƠN THUỐC BẢO HIỂM Y TẾ (Ca test ${trial})`,
      `Họ và tên: ${randName}`,
      `Mã thẻ: ${randCard}`,
      'Chẩn đoán: Bệnh cơ xương khớp / Tăng huyết áp',
      ...selected.map((d, i) => `${i + 1}. ${d.name} x ${Math.floor(Math.random() * 20) + 10} viên (Uống ngày 2 lần)`)
    ].join('\n');

    const res = await bhytApi.ocrPrescription(
      `data:image/jpeg;base64,mockBase64StringForTrial_${trial}`,
      'image/jpeg',
      rawTextLines
    );

    assert(res !== null, 'Phản hồi OCR không được rỗng');
    assert(res.prescription !== null, 'Phải có payload đơn thuốc');
    assert(res.total_items >= 2, `Phải có ít nhất 2 thuốc, thực tế: ${res.total_items}`);
    assert(res.resolved_count >= 1, `Phải đối soát thành công ít nhất 1 thuốc với DAV, thực tế: ${res.resolved_count}`);

    // Thẩm định an toàn lâm sàng thời gian thực trên payload trích xuất
    const audit = auditBhytPrescription({
      prescriptionId: res.prescription.prescriptionId || `RX-TRIAL-${trial}`,
      patientName: res.prescription.patientName,
      patientAge: res.prescription.patientAge,
      insuranceCardNumber: res.prescription.insuranceCardNumber,
      hospitalRank: (res.prescription.hospitalRank as HospitalRank) || 'HANG_I',
      treatmentType: (res.prescription.treatmentType as TreatmentType) || 'NGOAI_TRU',
      primaryIcd10: res.prescription.primaryIcd10 || 'I10',
      primaryDiagnosis: res.prescription.primaryDiagnosis || 'Tăng huyết áp',
      secondaryIcd10s: res.prescription.secondaryIcd10s || [],
      items: res.prescription.items.map((it: any) => ({
        id: it.id,
        drugCode: it.drugCode || it.drug_code || '',
        drugName: it.drugName || it.drug_name || '',
        activeIngredient: it.activeIngredient || it.active_ingredient || '',
        dosage: it.dosage || '',
        route: it.route || 'Uống',
        quantity: Number(it.quantity || 10),
        daysSupply: Number(it.daysSupply ?? it.days_supply ?? 7),
        unitPrice: Number(it.unitPrice ?? it.unit_price ?? 12000),
        instructions: it.instructions || '',
        hasConsultationForm: false
      }))
    });

    assert(audit !== null, 'Báo cáo giám định BHYT không được null');
    assert(typeof audit.totalCostVnd === 'number', 'Tổng tiền phải là số');
    console.log(`  [Trial ${trial.toString().padStart(2, '0')}] OK | ${res.total_items} thuốc | ${res.resolved_count} khớp DAV | Chi phí: ${audit.totalCostVnd.toLocaleString('vi-VN')} đ | Provider: ${res.provider}`);
  }

  // 2. Kiểm thử khả năng chống chịu ngoại tuyến (Offline Resilience)
  console.log('\n--- 2. Testing Offline Resilience & Zero Failure ---');
  const offlineRes = await bhytApi.ocrPrescription('', 'image/jpeg');
  assert(offlineRes !== null, 'Offline fallback không được ném ngoại lệ');
  assert(offlineRes.prescription !== null, 'Phải có cấu trúc dự phòng');
  console.log(`  [Offline Test] OK | Cấu trúc mặc định sẵn sàng: ${offlineRes.prescription.insuranceCardNumber}`);

  console.log('\n================================================================');
  console.log('   ALL 15 RANDOMIZED OCR & GATEWAY INTEGRATION TESTS PASSED!   ');
  console.log('================================================================');
}

runRandomizedOcrTests().catch(err => {
  console.error('Test thất bại:', err);
  process.exit(1);
});
