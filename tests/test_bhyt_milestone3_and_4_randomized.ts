/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Randomized / Property-Based Testing for Milestone 3 & 4
 * (Zero-hardcode Document Parsing, Canvas Compression & HITL Audit Pipeline)
 */

process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

import { parsePrescriptionText } from '../src/services/bhytIngestion';
import { auditBhytPrescription } from '../src/services/bhytAuditEngine';
import { bhytApi } from '../src/services/api/bhytApi';
import { HospitalRank, TreatmentType } from '../src/types/bhyt';

const PATIENT_NAMES = [
  'Nguyễn Văn Bình', 'Trần Thị Mai', 'Lê Hoàng Long', 'Phạm Minh Tuấn',
  'Võ Thị Hằng', 'Đặng Quốc Huy', 'Bùi Đức Anh', 'Hoàng Thu Trang'
];

const ICD10_POOL = [
  { code: 'K21.0', name: 'Bệnh trào ngược dạ dày - thực quản' },
  { code: 'I10', name: 'Tăng huyết áp nguyên phát' },
  { code: 'E11.9', name: 'Đái tháo đường típ 2' },
  { code: 'M17.1', name: 'Thoái hóa khớp gối nguyên phát' },
  { code: 'E78.0', name: 'Tăng cholesterol máu thuần túy' },
  { code: 'J02.9', name: 'Viêm họng cấp' }
];

const MED_LINES_POOL = [
  '1. Nexium 40mg (Esomeprazol) x 28 viên - uống sáng trước ăn 30 phút',
  '2. Losec 20mg (Omeprazol) x 14 viên - uống tối trước khi đi ngủ',
  '3. Panadol Extra 500mg SL: 20 viên - uống khi đau đầu',
  '4. Glucophage 850mg (Metformin) - 60 viên uống ngày 2 lần',
  '5. Amlor 5mg (Amlodipin) x 30 viên - 1 viên sáng sau ăn',
  '6. Lipitor 20mg (Atorvastatin) x 30 viên - 1 viên tối trước khi ngủ',
  '7. Augmentin 1g x 14 viên - ngày 2 lần mỗi lần 1 viên',
  '8. Voltaren 50mg (Diclofenac) x 20 viên - uống sau bữa ăn'
];

function generateRandomCardNumber(seed: number): string {
  const prefixes = ['DN', 'GD', 'HT', 'CH', 'TE', 'BT'];
  const p = prefixes[seed % prefixes.length];
  let numStr = '';
  for (let i = 0; i < 13; i++) {
    numStr += Math.floor((Math.sin(seed * 997 + i * 37) + 1) * 4.5).toString();
  }
  return `${p}${numStr.slice(0, 13)}`;
}

async function runMilestone3And4RandomizedTests() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ NGẪU NHIÊN GIAI ĐOẠN 3 & 4 (HITL & ZERO-HARDCODE)...');

  const TOTAL_RUNS = 20;
  let passedRuns = 0;

  for (let run = 1; run <= TOTAL_RUNS; run++) {
    const seed = Date.now() + run * 7919;
    const patientName = PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)];
    const cardNum = generateRandomCardNumber(seed);
    const icdObj = ICD10_POOL[Math.floor(Math.random() * ICD10_POOL.length)];
    const numMeds = 2 + Math.floor(Math.random() * 4); // 2 đến 5 thuốc ngẫu nhiên
    const selectedMeds = [...MED_LINES_POOL].sort(() => 0.5 - Math.random()).slice(0, numMeds);

    // Xây dựng chuỗi văn bản đơn thuốc thực tế có cấu trúc
    const prescriptionText = `
BỆNH VIỆN ĐA KHOA TỈNH
ĐƠN THUỐC NGOẠI TRÚ
Họ và tên: ${patientName}
Tuổi: ${30 + (run * 2) % 50}
Mã số thẻ BHYT: ${cardNum}
Chẩn đoán: ${icdObj.name}
Mã bệnh chính: ${icdObj.code}

DANH MỤC THUỐC KÊ ĐƠN:
${selectedMeds.join('\n')}

Lời dặn: Tái khám sau khi hết thuốc.
    `.trim();

    // 1. Kiểm tra Spatial Layout Parser (parsePrescriptionText)
    const t0 = performance.now();
    const parsedPayload = parsePrescriptionText(prescriptionText, 'HANG_II', 'NGOAI_TRU');
    const parseTime = performance.now() - t0;

    // Property Assertions
    if (parsedPayload.patientName !== patientName) {
      throw new Error(`[Run ${run}] Tên bệnh nhân trích xuất sai: '${parsedPayload.patientName}' != '${patientName}'`);
    }
    if (parsedPayload.insuranceCardNumber !== cardNum) {
      throw new Error(`[Run ${run}] Mã thẻ BHYT trích xuất sai: '${parsedPayload.insuranceCardNumber}' != '${cardNum}'`);
    }
    if (parsedPayload.primaryIcd10 !== icdObj.code) {
      throw new Error(`[Run ${run}] Mã ICD-10 trích xuất sai: '${parsedPayload.primaryIcd10}' != '${icdObj.code}'`);
    }
    if (parsedPayload.items.length !== numMeds) {
      throw new Error(`[Run ${run}] Số lượng thuốc trích xuất sai: ${parsedPayload.items.length} != ${numMeds}`);
    }

    // 2. Kiểm tra tính toán Pure Math của Audit Engine
    const auditReport = auditBhytPrescription(parsedPayload);
    const calculatedTotal = parsedPayload.items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
    if (Math.abs(auditReport.totalCostVnd - calculatedTotal) > 0.01) {
      throw new Error(`[Run ${run}] Tổng chi phí tiền thuốc không khớp công thức: ${auditReport.totalCostVnd} != ${calculatedTotal}`);
    }

    // 3. Kiểm tra tính toán số tiền xuất toán không âm
    if (auditReport.atRiskCostVnd < 0) {
      throw new Error(`[Run ${run}] Số tiền xuất toán âm: ${auditReport.atRiskCostVnd}`);
    }

    // 4. Kiểm tra tích hợp Batch Resolution API với CSDL Dược Quốc Gia
    if (run <= 3) {
      const drugQueries = parsedPayload.items.map(it => `${it.drugName} ${it.dosage}`);
      const tBatch = performance.now();
      const batchRes = await bhytApi.batchResolveDrugs(drugQueries);
      const batchLatency = performance.now() - tBatch;

      if (batchRes.total !== numMeds) {
        throw new Error(`[Run ${run}] Batch total không khớp: ${batchRes.total} != ${numMeds}`);
      }
      console.log(`  ✓ Run ${run}: Đã phân giải ${batchRes.resolved_count}/${batchRes.total} thuốc với DAV trong ${batchLatency.toFixed(1)}ms`);
    }

    passedRuns++;
  }

  console.log(`\n🎉 HOÀN THÀNH TOÀN BỘ ${passedRuns}/${TOTAL_RUNS} CA KIỂM THỬ NGẪU NHIÊN GIAI ĐOẠN 3 & 4 (100% GREEN)!`);
}

runMilestone3And4RandomizedTests().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
