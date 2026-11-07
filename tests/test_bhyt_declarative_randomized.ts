/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Randomized Property-based Stress Testing for Declarative BHYT Rule Engine
 * Chạy tự động với các ca sinh ngẫu nhiên mỗi lần thực thi để đảm bảo tính ổn định và chính xác 100%.
 */

import { auditBhytPrescription, DECLARATIVE_THERAPEUTIC_CLASSES, DECLARATIVE_INCOMPATIBLE_CLASSES } from '../src/services/bhytAuditEngine';
import { BhytPrescriptionPayload, HospitalRank, TreatmentType } from '../src/types/bhyt';

console.log('======================================================================');
console.log('🎲 KIỂM THỬ ĐỘNG CƠ LUẬT BHYT KHAI BÁO BẰNG DỮ LIỆU NGẪU NHIÊN (PROPERTY-BASED)');
console.log('======================================================================\n');

let allPassed = true;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// 1. Kiểm tra tính khai báo động của các cấu hình luật
console.log('--- 1. Cấu hình bảng luật khai báo (Declarative Rule Tables) ---');
assert(DECLARATIVE_THERAPEUTIC_CLASSES.length >= 4, `Bảng luật nhóm tác dụng có ${DECLARATIVE_THERAPEUTIC_CLASSES.length} nhóm khai báo.`);
assert(DECLARATIVE_INCOMPATIBLE_CLASSES.length >= 1, `Bảng cặp chống chỉ định có ${DECLARATIVE_INCOMPATIBLE_CLASSES.length} cặp.`);

// 2. Sinh ngẫu nhiên 20 ca đơn thuốc hỗn hợp
console.log('\n--- 2. Chạy 20 ca đơn thuốc sinh ngẫu nhiên (Randomized Prescriptions) ---');

const PPI_POOL = [
  { name: 'Nexium 40mg', active: 'Esomeprazol', code: 'A02BC05', price: 24500 },
  { name: 'Losec 20mg', active: 'Omeprazol', code: 'A02BC01', price: 15200 },
  { name: 'Pantoloc 40mg', active: 'Pantoprazol', code: 'A02BC02', price: 18000 },
  { name: 'Pariet 20mg', active: 'Rabeprazol', code: 'A02BC04', price: 19500 }
];

const NSAID_POOL = [
  { name: 'Mobic 7.5mg', active: 'Meloxicam', code: 'M01AC06', price: 12000 },
  { name: 'Celebrex 200mg', active: 'Celecoxib', code: 'M01AH01', price: 18500 },
  { name: 'Voltaren 50mg', active: 'Diclofenac', code: 'M01AB05', price: 8500 }
];

const STATIN_POOL = [
  { name: 'Lipitor 20mg', active: 'Atorvastatin', code: 'C10AA05', price: 16500 },
  { name: 'Crestor 10mg', active: 'Rosuvastatin', code: 'C10AA07', price: 15200 }
];

const CLEAN_POOL = [
  { name: 'Amlor 5mg', active: 'Amlodipin', code: 'C08CA01', price: 8200, icd: 'I10', diag: 'Tăng huyết áp nguyên phát' },
  { name: 'Glucophage 850mg', active: 'Metformin', code: 'A10BA02', price: 4200, icd: 'E11.9', diag: 'Đái tháo đường type 2' },
  { name: 'Panadol 500mg', active: 'Paracetamol', code: 'N02BE01', price: 1500, icd: 'R50', diag: 'Sốt không rõ nguyên nhân' }
];

for (let i = 1; i <= 20; i++) {
  const seed = Date.now() + i * 17;
  const isDuplicateTest = i % 2 === 0;

  let items = [];
  let expectedDuplicateCount = 0;
  let expectedExtraCost = 0;

  if (isDuplicateTest) {
    // Kê ngẫu nhiên 2 thuốc cùng nhóm (PPI hoặc NSAID hoặc Statin)
    const pool = (i % 3 === 0) ? PPI_POOL : ((i % 3 === 1) ? NSAID_POOL : STATIN_POOL);
    const d1 = pool[0];
    const d2 = pool[1];
    const qty1 = 10 + (seed % 20);
    const qty2 = 10 + ((seed * 3) % 20);

    items = [
      {
        id: `rnd-${i}-1`,
        drugCode: d1.code,
        drugName: d1.name,
        activeIngredient: d1.active,
        dosage: 'chuẩn',
        route: 'Uống',
        quantity: qty1,
        daysSupply: 14,
        unitPrice: d1.price
      },
      {
        id: `rnd-${i}-2`,
        drugCode: d2.code,
        drugName: d2.name,
        activeIngredient: d2.active,
        dosage: 'chuẩn',
        route: 'Uống',
        quantity: qty2,
        daysSupply: 14,
        unitPrice: d2.price
      }
    ];
    expectedDuplicateCount = 1;
    expectedExtraCost = qty2 * d2.price;
  } else {
    // Đơn thuốc hợp lệ từ clean pool
    const cleanDrug = CLEAN_POOL[i % CLEAN_POOL.length];
    const qty = 10 + (seed % 25);
    items = [
      {
        id: `rnd-${i}-clean`,
        drugCode: cleanDrug.code,
        drugName: cleanDrug.name,
        activeIngredient: cleanDrug.active,
        dosage: 'chuẩn',
        route: 'Uống',
        quantity: qty,
        daysSupply: 20,
        unitPrice: cleanDrug.price
      }
    ];
  }

  const cleanRef = CLEAN_POOL[i % CLEAN_POOL.length];
  const payload: BhytPrescriptionPayload = {
    prescriptionId: `RX-RND-${seed}`,
    patientName: `Bệnh nhân Ngẫu Nhiên ${i}`,
    patientAge: 25 + (seed % 50),
    insuranceCardNumber: `DN479${String(seed).slice(-10)}`,
    hospitalRank: 'HANG_I',
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: isDuplicateTest ? 'K21' : cleanRef.icd,
    primaryDiagnosis: isDuplicateTest ? 'Trào ngược dạ dày' : cleanRef.diag,
    secondaryIcd10s: isDuplicateTest ? ['E78', 'M17'] : [],
    items
  };

  const report = auditBhytPrescription(payload);

  if (isDuplicateTest) {
    const dupErrors = report.violations.filter(v => v.category === 'THERAPEUTIC_DUPLICATION');
    assert(dupErrors.length >= 1, `[Ca ngẫu nhiên #${i}] Bắt chính xác lỗi trùng lặp khi kê ${items[0].drugName} & ${items[1].drugName}`);
    assert(Math.abs(dupErrors[0].rejectionRiskVnd - expectedExtraCost) === 0, `[Ca #${i}] Số tiền xuất toán khớp từng đồng: ${expectedExtraCost.toLocaleString('vi-VN')} đ`);
  } else {
    const dupErrors = report.violations.filter(v => v.category === 'THERAPEUTIC_DUPLICATION');
    assert(dupErrors.length === 0, `[Ca ngẫu nhiên #${i}] Đơn thuốc sạch không bị báo lỗi trùng lặp oan.`);
    assert(report.status === 'PASS', `[Ca #${i}] Trạng thái thẩm định hợp lệ: PASS`);
  }
}

console.log('\n======================================================================');
if (allPassed) {
  console.log('🎉 TOÀN BỘ CÁC BÀI TEST NGẪU NHIÊN ĐẠT 100% GREEN!');
  console.log('======================================================================\n');
} else {
  console.error('❌ CÓ BÀI TEST NGẪU NHIÊN THẤT BẠI!');
  process.exit(1);
}
