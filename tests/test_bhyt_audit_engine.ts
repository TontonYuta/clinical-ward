/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive Unit Test Suite: BHYT Claims Adjudication Engine,
 * Knowledge Base Catalog & QD 130 XML Parser
 */

import { auditBhytPrescription, isIcd10Matching, getTherapeuticGroup } from '../src/services/bhytAuditEngine';
import { SAMPLE_PRESCRIPTIONS, parseQd130Xml, generateSampleQd130Xml } from '../src/services/bhytIngestion';
import {
  BHYT_DRUG_RULES,
  findBhytRule,
  searchBhytRules,
  getBhytRulesByRank,
  getConsultationRequiredRules,
  getPartialPaymentRules,
  normalizeDrugSearchText
} from '../src/data/bhytDrugRules';

console.log('======================================================================');
console.log('🏥 KIỂM THỬ TỰ ĐỘNG BỘ QUY TẮC GIÁM ĐỊNH ĐƠN THUỐC BHYT (TT 20 & QĐ 3618)');
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

// ---------------------------------------------------------------------
// 1. Kiểm tra Từ điển quy tắc thuốc & Chuẩn hóa tìm kiếm
// ---------------------------------------------------------------------
console.log('--- 1. Tra cứu từ điển hoạt chất TT 20/2022 & So khớp không dấu ---');
assert(BHYT_DRUG_RULES.length >= 40, `Danh mục BHYT đạt quy mô bao phủ rộng (Hiện có: ${BHYT_DRUG_RULES.length} quy tắc)`);

const norm = normalizeDrugSearchText('Thuốc Kháng Sinh Meropenem 1g');
assert(norm === 'thuoc khang sinh meropenem 1g', `Chuẩn hóa chuỗi tìm kiếm bỏ dấu chuẩn: "${norm}"`);

const meroRule = findBhytRule('Meropenem');
assert(meroRule !== null, 'Tìm thấy hoạt chất Meropenem');
assert(meroRule?.requiresConsultation === true, 'Meropenem yêu cầu biên bản hội chẩn');
assert(!meroRule?.allowedRanks.includes('HANG_III'), 'Meropenem KHÔNG được dùng tại Hạng III (Tuyến huyện)');

const ppiRule = findBhytRule('Nexium');
assert(ppiRule !== null, 'Biệt dược Nexium nhận diện đúng thành Esomeprazol');
assert(ppiRule?.atcGroup === 'A02BC05', 'Mã ATC của Nexium là A02BC05 (PPI)');

const jardiRule = findBhytRule('Jardiance');
assert(jardiRule !== null, 'Biệt dược Jardiance nhận diện đúng thành Empagliflozin');
assert(jardiRule?.paymentRatio === 0.5, 'Jardiance (Empagliflozin) có tỷ lệ thanh toán BHYT 50%');

const alphaRule = findBhytRule('Alpha Choay');
assert(alphaRule !== null, 'Biệt dược Alpha Choay nhận diện đúng thành Alpha Chymotrypsin');
assert(alphaRule?.approvedIcd10Prefixes?.includes('T81') === true, 'Alpha Chymotrypsin duyệt cho biến chứng phẫu thuật T81');
assert(alphaRule?.approvedIcd10Prefixes?.includes('J02') === false, 'Alpha Chymotrypsin KHÔNG duyệt cho viêm họng J02');

// ---------------------------------------------------------------------
// 2. Ca 1: Vượt tuyến & Trùng PPI
// ---------------------------------------------------------------------
console.log('\n--- 2. Kiểm thử Ca 1: Vượt tuyến & Trùng lặp PPI ---');
const report1 = auditBhytPrescription(SAMPLE_PRESCRIPTIONS.hospital_rank_violation);
assert(report1.status === 'REJECT', 'Ca 1 bị đánh giá trạng thái REJECT');
assert(report1.rejectCount >= 2, `Ca 1 phát hiện ít nhất 2 lỗi REJECT (Thực tế: ${report1.rejectCount})`);
assert(report1.atRiskCostVnd > 0, `Tiền nguy cơ xuất toán > 0: ${report1.atRiskCostVnd.toLocaleString('vi-VN')} đ`);

const rankViolation = report1.violations.find(v => v.category === 'HOSPITAL_RANK_MISMATCH');
assert(rankViolation !== undefined, 'Bắt đúng lỗi HOSPITAL_RANK_MISMATCH (Meropenem tại Tuyến Huyện)');
assert(rankViolation?.legalRef.docCode === '20/2022/TT-BYT', 'Căn cứ pháp lý đúng Thông tư 20/2022/TT-BYT');

const dupPpiViolation = report1.violations.find(v => v.category === 'THERAPEUTIC_DUPLICATION');
assert(dupPpiViolation !== undefined, 'Bắt đúng lỗi THERAPEUTIC_DUPLICATION (Trùng lặp nhóm PPI)');
assert(dupPpiViolation?.legalRef.docCode === '3618/QĐ-BHXH', 'Căn cứ pháp lý đúng Quyết định 3618/QĐ-BHXH');

// ---------------------------------------------------------------------
// 3. Ca 2: Trùng NSAID & Thuốc ngoài BHYT
// ---------------------------------------------------------------------
console.log('\n--- 3. Kiểm thử Ca 2: Trùng NSAID & Thuốc ngoài BHYT ---');
const report2 = auditBhytPrescription(SAMPLE_PRESCRIPTIONS.duplicate_nsaid_and_uncovered);
assert(report2.status === 'REJECT', 'Ca 2 bị đánh giá trạng thái REJECT');

const dupNsaid = report2.violations.find(v => v.category === 'THERAPEUTIC_DUPLICATION');
assert(dupNsaid !== undefined, 'Bắt đúng lỗi trùng lặp nhóm NSAID (Mobic + Celebrex)');

const notInCatalog = report2.violations.find(v => v.category === 'NOT_IN_BHYT_CATALOG');
assert(notInCatalog !== undefined, 'Bắt đúng lỗi Thực phẩm chức năng không thuộc danh mục BHYT (Luật BHYT Điều 23)');

// ---------------------------------------------------------------------
// 3b. Kiểm thử Glucosamin & Diacerein theo Cột 8 TT 20/2022 (ICD-10 M17 vs M47)
// ---------------------------------------------------------------------
console.log('\n--- 3b. Kiểm thử Glucosamin & Diacerein Cột 8 TT 20/2022 ---');
// Ca Glucosamin kê cho M17 (Thoái hóa khớp gối) -> HỢP LỆ 100%
const glucosaminValidReport = auditBhytPrescription({
  patientName: 'Bệnh nhân Khớp Gối',
  patientAge: 65,
  insuranceCardNumber: 'GD1234567890123',
  hospitalRank: 'HANG_III',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'M17.0',
  primaryDiagnosis: 'Thoái hóa khớp gối nguyên phát hai bên',
  secondaryIcd10s: [],
  items: [
    {
      id: 'item-glu-valid',
      drugCode: 'GLU500',
      drugName: 'Viartril-S 500mg',
      activeIngredient: 'Glucosamin',
      dosage: '500mg',
      route: 'Uống',
      quantity: 60,
      daysSupply: 30,
      unitPrice: 8500
    }
  ]
});
assert(glucosaminValidReport.status === 'PASS', 'Glucosamin kê cho Thoái hóa khớp gối M17 được DUYỆT HỢP LỆ BHYT 100%');
assert(glucosaminValidReport.atRiskCostVnd === 0, 'Glucosamin đúng mã M17 có 0 đ nguy cơ xuất toán');

// Ca Glucosamin kê cho M47 (Thoái hóa cột sống) -> BỊ XUẤT TOÁN VÌ SAI ĐIỀU KIỆN CỘT 8 TT 20 (yêu cầu M17)
const glucosaminInvalidReport = auditBhytPrescription({
  patientName: 'Bệnh nhân Cột Sống',
  patientAge: 60,
  insuranceCardNumber: 'GD1234567890124',
  hospitalRank: 'HANG_III',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'M47.8',
  primaryDiagnosis: 'Thoái hóa cột sống thắt lưng',
  secondaryIcd10s: [],
  items: [
    {
      id: 'item-glu-invalid',
      drugCode: 'GLU500',
      drugName: 'Viartril-S 500mg',
      activeIngredient: 'Glucosamin',
      dosage: '500mg',
      route: 'Uống',
      quantity: 60,
      daysSupply: 30,
      unitPrice: 8500
    }
  ]
});
assert(glucosaminInvalidReport.status === 'REJECT', 'Glucosamin kê cho Thoái hóa cột sống M47 bị REJECT');
const gluIcdErr = glucosaminInvalidReport.violations.find(v => v.category === 'ICD10_UNSUPPORTED');
assert(gluIcdErr !== undefined, 'Bắt đúng lỗi ICD10_UNSUPPORTED (Không khớp điều kiện Cột 8 TT 20)');
assert(gluIcdErr?.detail.includes('M17') === true, 'Thông báo chi tiết chỉ rõ yêu cầu nhóm bệnh Thoái hóa khớp gối M17');

// ---------------------------------------------------------------------
// 3c. Kiểm thử Đường dùng (Route-Aware): Tobramycin nhỏ mắt & Meropenem ngoại trú
// ---------------------------------------------------------------------
console.log('\n--- 3c. Kiểm thử Đường dùng (Route-Aware) & Kháng sinh dự trữ ngoại trú ---');
const tobrexReport = auditBhytPrescription({
  patientName: 'Bệnh nhân Mắt',
  patientAge: 40,
  insuranceCardNumber: 'GD1234567890125',
  hospitalRank: 'HANG_III', // Tuyến Huyện
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'H10',
  primaryDiagnosis: 'Viêm kết mạc cấp',
  secondaryIcd10s: [],
  items: [
    {
      id: 'item-tobrex',
      drugCode: 'TOB-03',
      drugName: 'Tobrex nhỏ mắt 0.3%',
      activeIngredient: 'Tobramycin',
      dosage: '5ml',
      route: 'Nhỏ mắt',
      quantity: 1,
      daysSupply: 7,
      unitPrice: 45000
    }
  ]
});
assert(tobrexReport.status === 'PASS', 'Tobramycin nhỏ mắt tại Tuyến Huyện duyệt hợp lệ BHYT 100% (không đòi hội chẩn)');

// Ca Kháng sinh dự trữ Meropenem kê Ngoại trú -> Bị chặn RESTRICTED_OUTPATIENT
const meroOutpatientReport = auditBhytPrescription({
  patientName: 'Bệnh nhân Ngoại Trú',
  patientAge: 55,
  insuranceCardNumber: 'GD1234567890126',
  hospitalRank: 'HANG_I',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'J18',
  primaryDiagnosis: 'Viêm phổi',
  secondaryIcd10s: [],
  items: [
    {
      id: 'item-mero-out',
      drugCode: 'MERO1G',
      drugName: 'Meronem 1g',
      activeIngredient: 'Meropenem',
      dosage: '1g',
      route: 'Tiêm truyền TM',
      quantity: 6,
      daysSupply: 3,
      unitPrice: 420000
    }
  ]
});
assert(meroOutpatientReport.status === 'REJECT', 'Meropenem kê ngoại trú bị REJECT');
const meroOutErr = meroOutpatientReport.violations.find(v => v.category === 'RESTRICTED_OUTPATIENT');
assert(meroOutErr !== undefined, 'Bắt đúng lỗi RESTRICTED_OUTPATIENT (Kháng sinh dự trữ cấm kê đơn ngoại trú theo QĐ 5631/QĐ-BYT)');
assert(meroOutErr?.legalRef.localPdfPath.includes('Thong_Tu_20_2022'), 'Căn cứ danh mục BHYT trỏ đúng PDF TT 20');

// ---------------------------------------------------------------------
// 4. Ca 3: Thuốc Tỷ lệ 50% & Kê vượt 30 ngày ngoại trú
// ---------------------------------------------------------------------
console.log('\n--- 4. Kiểm thử Ca 3: Thuốc Tỷ lệ 50% & Vượt 30 ngày ngoại trú ---');
const report3 = auditBhytPrescription(SAMPLE_PRESCRIPTIONS.ratio_sglt2_empagliflozin_overdays);
assert(report3.status === 'WARNING', `Ca 3 có trạng thái WARNING (Thực tế: ${report3.status})`);

const partialAlert = report3.violations.find(v => v.category === 'PARTIAL_PAYMENT_ALERT');
assert(partialAlert !== undefined, 'Bắt đúng cảnh báo PARTIAL_PAYMENT_ALERT (Jardiance 50%)');
assert(report3.patientCoPayCostVnd > 0, `Ca 3 tính đúng tiền bệnh nhân đồng chi trả theo luật: ${report3.patientCoPayCostVnd.toLocaleString('vi-VN')} đ`);
assert(report3.atRiskCostVnd < report3.totalCostVnd, 'Thuốc 50% không bị tính thành tiền phạt xuất toán');

const daysAlert = report3.violations.find(v => v.category === 'OVER_MAX_OUTPATIENT_DAYS');
assert(daysAlert !== undefined, 'Bắt đúng cảnh báo OVER_MAX_OUTPATIENT_DAYS (kê 45 ngày > 30 ngày)');

// ---------------------------------------------------------------------
// 5. Ca 4: Sai lệch chẩn đoán ICD-10 (Alpha Choay kê cho J02)
// ---------------------------------------------------------------------
console.log('\n--- 5. Kiểm thử Ca 4: Sai lệch chỉ định ICD-10 (Alpha Choay kê cho J02) ---');
const report4 = auditBhytPrescription(SAMPLE_PRESCRIPTIONS.alpha_chymotrypsin_icd_mismatch);
assert(report4.status === 'REJECT', 'Ca 4 bị REJECT do chỉ định không đúng điều kiện BHYT');

const icdMismatch = report4.violations.find(v => v.category === 'ICD10_UNSUPPORTED');
assert(icdMismatch !== undefined, 'Bắt đúng lỗi ICD10_UNSUPPORTED (Alpha Choay kê cho viêm họng J02)');
assert(icdMismatch?.legalRef.docCode === '3618/QĐ-BHXH', 'Căn cứ pháp lý đúng Quyết định 3618/QĐ-BHXH Điều 14');

// ---------------------------------------------------------------------
// 6. Ca 5: Đơn hợp lệ 100%
// ---------------------------------------------------------------------
console.log('\n--- 6. Kiểm thử Ca 5: Đơn thuốc hợp lệ 100% ---');
const report5 = auditBhytPrescription(SAMPLE_PRESCRIPTIONS.clean_valid_prescription);
assert(report5.status === 'PASS', 'Ca 5 được đánh giá trạng thái PASS');
assert(report5.rejectCount === 0, 'Ca 5 có 0 lỗi REJECT');
assert(report5.atRiskCostVnd === 0, 'Ca 5 có 0 đ nguy cơ xuất toán');

// ---------------------------------------------------------------------
// 7. XML Parser QĐ 130
// ---------------------------------------------------------------------
console.log('\n--- 7. Kiểm thử Bộ phân tích XML Bảng 2 QĐ 130 ---');
const sampleXml = generateSampleQd130Xml();
const parsedXml = parseQd130Xml(sampleXml);
assert(parsedXml.primaryIcd10 === 'K21.0', `Bóc tách đúng mã ICD-10 K21.0 (Thực tế: ${parsedXml.primaryIcd10})`);
assert(parsedXml.items !== undefined && parsedXml.items.length === 3, `Bóc tách đủ 3 thuốc trong XML (Thực tế: ${parsedXml.items?.length})`);

// ---------------------------------------------------------------------
// 8. Tiện ích truy vấn danh mục BHYT
// ---------------------------------------------------------------------
console.log('\n--- 8. Tiện ích truy vấn danh mục BHYT ---');
const searchResults = searchBhytRules('Kháng sinh');
assert(searchResults.length > 0, `Tìm kiếm "Kháng sinh" trả về ${searchResults.length} kết quả`);

const rank4Drugs = getBhytRulesByRank('HANG_IV');
assert(rank4Drugs.length > 0, `Trạm Y tế xã (Hạng IV) có ${rank4Drugs.length} thuốc được phép kê đơn`);

const consultDrugs = getConsultationRequiredRules();
assert(consultDrugs.length >= 8, `Có ${consultDrugs.length} thuốc yêu cầu biên bản hội chẩn (Carbapenem, Glycopeptide, Kháng thể đơn dòng)`);

const partialDrugs = getPartialPaymentRules();
assert(partialDrugs.length >= 5, `Có ${partialDrugs.length} thuốc có tỷ lệ thanh toán 50-70%`);

// ---------------------------------------------------------------------
// 9. Nâng cao: So khớp ICD-10 linh hoạt & Bệnh kèm theo (Secondary ICD)
// ---------------------------------------------------------------------
console.log('\n--- 9. So khớp ICD-10 linh hoạt & Bệnh kèm theo ---');
assert(isIcd10Matching('K21.0', 'K21'), 'K21.0 khớp prefix K21');
assert(isIcd10Matching('K210', 'K21'), 'K210 khớp prefix K21');
assert(isIcd10Matching('E11.9', 'E11'), 'E11.9 khớp prefix E11');
assert(!isIcd10Matching('J02.9', 'T81'), 'J02.9 không khớp T81');

// Đơn có bệnh chính I10, bệnh phụ E11.9 kê Jardiance (Empagliflozin)
const reportComorbidity = auditBhytPrescription({
  prescriptionId: 'RX-TEST-COMORB',
  patientName: 'Lê Văn An',
  patientAge: 60,
  insuranceCardNumber: 'DN4791234567890',
  hospitalRank: 'HANG_I',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'I10',
  primaryDiagnosis: 'Tăng huyết áp',
  secondaryIcd10s: ['E11.9'],
  items: [
    {
      id: 'item-jardi',
      drugCode: 'JAR-10',
      drugName: 'Jardiance 10mg',
      activeIngredient: 'Empagliflozin',
      dosage: '10mg',
      route: 'Uống',
      quantity: 30,
      daysSupply: 30,
      unitPrice: 28000
    }
  ]
});
assert(!reportComorbidity.violations.some(v => v.category === 'ICD10_UNSUPPORTED'), 'Khớp ICD-10 phụ E11.9 cho Jardiance, không bị xuất toán ICD-10');

// ---------------------------------------------------------------------
// 10. Mở rộng kiểm tra trùng lặp tác dụng (Statin & Dual RAAS)
// ---------------------------------------------------------------------
console.log('\n--- 10. Trùng lặp Statin & Dual RAAS ---');
const reportStatinDup = auditBhytPrescription({
  prescriptionId: 'RX-TEST-STATIN',
  patientName: 'Trần Văn C',
  patientAge: 65,
  insuranceCardNumber: 'GD4790000000000',
  hospitalRank: 'HANG_I',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'E78.0',
  primaryDiagnosis: 'Rối loạn lipid máu',
  items: [
    {
      id: 'statin-1',
      drugCode: 'LIP-20',
      drugName: 'Lipitor 20mg',
      activeIngredient: 'Atorvastatin',
      dosage: '20mg',
      route: 'Uống',
      quantity: 30,
      daysSupply: 30,
      unitPrice: 16000
    },
    {
      id: 'statin-2',
      drugCode: 'CRES-10',
      drugName: 'Crestor 10mg',
      activeIngredient: 'Rosuvastatin',
      dosage: '10mg',
      route: 'Uống',
      quantity: 30,
      daysSupply: 30,
      unitPrice: 15000
    }
  ]
});
assert(reportStatinDup.violations.some(v => v.category === 'THERAPEUTIC_DUPLICATION' && v.title.includes('Statin')), 'Phát hiện trùng lặp 2 Statin (Atorvastatin + Rosuvastatin)');

const reportRaasDup = auditBhytPrescription({
  prescriptionId: 'RX-TEST-RAAS',
  patientName: 'Hoàng Văn D',
  patientAge: 55,
  insuranceCardNumber: 'GD4790000000001',
  hospitalRank: 'HANG_I',
  treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'I10',
  primaryDiagnosis: 'Tăng huyết áp',
  items: [
    {
      id: 'raas-1',
      drugCode: 'REN-5',
      drugName: 'Renitec 5mg',
      activeIngredient: 'Enalapril',
      dosage: '5mg',
      route: 'Uống',
      quantity: 30,
      daysSupply: 30,
      unitPrice: 6000
    },
    {
      id: 'raas-2',
      drugCode: 'COZ-50',
      drugName: 'Cozaar 50mg',
      activeIngredient: 'Losartan',
      dosage: '50mg',
      route: 'Uống',
      quantity: 30,
      daysSupply: 30,
      unitPrice: 12000
    }
  ]
});
assert(reportRaasDup.violations.some(v => v.category === 'THERAPEUTIC_DUPLICATION' && v.title.includes('Renin-Angiotensin')), 'Phát hiện phối hợp chống chỉ định ACEI + ARB (Enalapril + Losartan)');

console.log('\n======================================================================');
if (allPassed) {
  console.log('🎉 TOÀN BỘ 8 NHÓM KIỂM THỬ GIÁM ĐỊNH BHYT ĐÃ ĐẠT 100% GREEN!');
  console.log('======================================================================\n');
} else {
  console.error('❌ CÓ BÀI TEST THẤT BẠI!');
  console.log('======================================================================\n');
  process.exit(1);
}
