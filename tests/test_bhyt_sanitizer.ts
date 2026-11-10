/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Test Suite: BHYT Sanitizer & Schema Coercion
 * Xác minh tính phòng vệ 100% trước các dị thường dữ liệu
 */

import {
  sanitizeHospitalRank,
  sanitizeTreatmentType,
  sanitizePrescriptionItem,
  sanitizeOcrPrescriptionPayload,
  sanitizeViolationItem,
  DEFAULT_LEGAL_REF
} from '../src/utils/bhytSanitizer';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('🧪 Bắt đầu kiểm thử BHYT Data Sanitizer & Schema Coercion...\n');

// 1. Kiểm thử sanitizeHospitalRank
assert(sanitizeHospitalRank('HANG_III') === 'HANG_III', 'Nhận diện đúng HANG_III');
assert(sanitizeHospitalRank('HANG_DAC_BIET') === 'HANG_DAC_BIET', 'Nhận diện đúng HANG_DAC_BIET');
assert(sanitizeHospitalRank('hạng 3') === 'HANG_III', 'Ánh xạ "hạng 3" sang HANG_III');
assert(sanitizeHospitalRank('Tuyến Huyện') === 'HANG_III', 'Ánh xạ "Tuyến Huyện" sang HANG_III');
assert(sanitizeHospitalRank('Bệnh viện Đa khoa Tỉnh') === 'HANG_I', 'Ánh xạ "Tỉnh" sang HANG_I');
assert(sanitizeHospitalRank('Trạm Y Tế Xã') === 'HANG_IV', 'Ánh xạ "Trạm Y Tế Xã" sang HANG_IV');
assert(sanitizeHospitalRank(null, 'HANG_II') === 'HANG_II', 'Fallback đúng khi rank là null');
assert(sanitizeHospitalRank('UNKNOWN_RANK', 'HANG_I') === 'HANG_I', 'Fallback đúng khi rank lạ');

// 2. Kiểm thử sanitizeTreatmentType
assert(sanitizeTreatmentType('NGOAI_TRU') === 'NGOAI_TRU', 'Nhận diện đúng NGOAI_TRU');
assert(sanitizeTreatmentType('NOI_TRU') === 'NOI_TRU', 'Nhận diện đúng NOI_TRU');
assert(sanitizeTreatmentType('Điều trị Nội trú') === 'NOI_TRU', 'Ánh xạ tiếng Việt sang NOI_TRU');
assert(sanitizeTreatmentType(null) === 'NGOAI_TRU', 'Fallback mặc định sang NGOAI_TRU');

// 3. Kiểm thử sanitizePrescriptionItem với dữ liệu dị thường
const dirtyItem = {
  id: null,
  drug_name: '  Meropenem 1g  ',
  active_ingredient: 'Meropenem',
  dosage: '1g',
  quantity: '5.5',
  unit_price: '350000',
  total_price: null,
  expiry_date: 2027, // Số thay vì chuỗi!
  vat_rate: '8',
  days_supply: -3
};
const cleanedItem = sanitizePrescriptionItem(dirtyItem, 0);
assert(cleanedItem.drugName === 'Meropenem 1g', 'Tên thuốc được trim sạch');
assert(cleanedItem.quantity === 5.5, 'Số lượng được ép kiểu float chính xác');
assert(cleanedItem.unitPrice === 350000, 'Đơn giá được ép kiểu float chính xác');
assert(cleanedItem.totalPrice === Math.round(5.5 * 350000), 'Tổng tiền tự động tính đúng');
assert(typeof cleanedItem.expiryDate === 'string' && cleanedItem.expiryDate === '2027', 'HSD dạng số được ép thành chuỗi an toàn');
assert(cleanedItem.daysSupply === 7, 'Số ngày âm được fallback về 7 ngày mặc định');
assert(cleanedItem.vatRate === 8, 'Thuế suất VAT được ép kiểu float');

// 4. Kiểm thử sanitizeOcrPrescriptionPayload với payload nguy cơ sập ứng dụng
const crashPronePayload = {
  prescriptionId: undefined,
  patient_name: null,
  patient_age: 'abc', // Không phải số
  insurance_card_number: undefined,
  hospital_rank: 'tuyen_huyen',
  treatment_type: null,
  primary_icd10: ' j18.9 ',
  secondary_icd10s: null, // NULL GÂY CRASH .join()
  items: [
    { drug_name: 'Paracetamol 500mg' },
    null, // Phần tử null trong mảng!
    { drug_name: 'Amoxicillin 500mg', expiry_date: null }
  ]
};

const safePayload = sanitizeOcrPrescriptionPayload(crashPronePayload, 'HANG_II', 'NGOAI_TRU');
assert(Array.isArray(safePayload.secondaryIcd10s), 'secondaryIcd10s bắt buộc là Array');
assert(safePayload.secondaryIcd10s.join(', ') === '', 'Gọi .join() trên secondaryIcd10s không bị crash');
assert(safePayload.patientAge === 50, 'Tuổi không hợp lệ được fallback về 50');
assert(safePayload.hospitalRank === 'HANG_III', 'Rank "tuyen_huyen" được chuẩn hóa sang HANG_III');
assert(safePayload.treatmentType === 'NGOAI_TRU', 'TreatmentType được fallback về NGOAI_TRU');
assert(safePayload.primaryIcd10 === 'J18.9', 'Mã ICD-10 được uppercase và trim sạch');
assert(safePayload.items.length === 3, 'Tất cả 3 phần tử items (kể cả null) đều được bảo toàn an toàn');
assert(safePayload.items[1].drugName === 'Thuốc 2', 'Phần tử null được sinh thuốc mặc định hợp lệ');

// 5. Kiểm thử sanitizeOcrPrescriptionPayload khi secondaryIcd10s là chuỗi phân tách bởi dấu phẩy
const stringSecondaryPayload = {
  secondaryIcd10s: 'I10, E11.9, K21'
};
const parsedSecondary = sanitizeOcrPrescriptionPayload(stringSecondaryPayload);
assert(parsedSecondary.secondaryIcd10s.length === 3, 'Chuỗi ICD phụ được phân tách thành 3 mã');
assert(parsedSecondary.secondaryIcd10s[1] === 'E11.9', 'Mã thứ hai là E11.9');

// 6. Kiểm thử sanitizeViolationItem khi thiếu legalRef
const rawViolationWithoutLegal = {
  id: 'v-test-01',
  drug_name: 'Augmentin 1g',
  severity: 'REJECT',
  detail: 'Vi phạm phân tuyến'
  // Hoàn toàn không có legalRef!
};
const safeViolation = sanitizeViolationItem(rawViolationWithoutLegal, 0);
assert(safeViolation.legalRef !== undefined && safeViolation.legalRef !== null, 'legalRef không bao giờ undefined');
assert(safeViolation.legalRef.docCode === DEFAULT_LEGAL_REF.docCode, 'legalRef tự động có docCode mặc định');
assert(safeViolation.legalRef.pageNumber === DEFAULT_LEGAL_REF.pageNumber, 'legalRef tự động có pageNumber mặc định');

console.log('\n🎉 TOÀN BỘ 18/18 TEST CASES ĐÃ ĐẠT 100% GREEN!\n');
