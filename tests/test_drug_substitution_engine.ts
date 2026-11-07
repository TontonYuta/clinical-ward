/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Kiểm thử Độc lập Thuật toán Gợi ý Thuốc Thay thế Hợp lệ BHYT (Smart Drug Substitution Engine)
 * Căn cứ: Thông tư 20/2022/TT-BYT, Quyết định 3618/QĐ-BHXH, WHO ATC Classification
 * 100% Zero-Hardcode: Quét danh mục động, tính điểm đa tiêu chí, vượt qua Pre-flight Safety Gate
 */

import { findDrugSubstitutes } from '../src/services/drugSubstitutionService';
import { BhytPrescriptionItem, BhytViolationItem } from '../src/types/bhyt';
import { findBhytRule } from '../src/data/bhytDrugRules';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('======================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ THUẬT TOÁN GỢI Ý THUỐC THAY THẾ BHYT 1-CLICK');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// CA 1: Meropenem tại BV Hạng III (Tuyến Huyện) - Vượt tuyến kỹ thuật
// -----------------------------------------------------------------------------
console.log('--- 1. Kiểm thử Ca 1: Thay thế Meropenem (Hạng III) bằng kháng sinh được phép ---');
const meroItem: BhytPrescriptionItem = {
  id: 'item-mero',
  drugName: 'Meronem 1g',
  activeIngredient: 'Meropenem',
  dosage: '1g',
  route: 'Tiêm truyền tĩnh mạch',
  quantity: 14,
  unitPrice: 350000,
  daysSupply: 7,
  instructions: 'Truyền TM 1g x 2 lần/ngày'
};

const meroViolation: BhytViolationItem = {
  id: 'v-mero-rank',
  drugId: 'item-mero',
  drugCode: 'MER1G',
  title: 'Vượt tuyến kỹ thuật',
  drugName: 'Meronem 1g',
  activeIngredient: 'Meropenem',
  category: 'HOSPITAL_RANK_MISMATCH',
  severity: 'REJECT',
  rejectionRiskVnd: 4900000,
  detail: 'Meropenem chỉ được thanh toán BHYT tại Bệnh viện Hạng Đặc Biệt và Hạng I, không được thanh toán tại Bệnh viện Hạng III.',
  action: 'Thay thế bằng kháng sinh thuộc danh mục được phép sử dụng tại Hạng III.',
  legalRef: {
    docCode: '20/2022/TT-BYT',
    docTitle: 'Thông tư 20/2022/TT-BYT',
    localPdfPath: '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf',
    section: 'Phụ lục I - Danh mục thuốc hóa dược',
    pageNumber: 15
  }
};

const meroCandidates = findDrugSubstitutes(
  meroItem,
  meroViolation,
  'HANG_III',
  'J18', // Viêm phổi
  [meroItem]
);

assert(meroCandidates.length > 0, `Phải tìm thấy ít nhất 1 thuốc thay thế cho Meropenem tại Tuyến Huyện (Tìm thấy: ${meroCandidates.length})`);
console.log(`   -> Tìm thấy ${meroCandidates.length} ứng viên thay thế cho Meropenem:`);
meroCandidates.slice(0, 3).forEach((c, idx) => {
  console.log(`      [${idx + 1}] ${c.drugName} (${c.activeIngredient}) - Điểm: ${c.score} - Cứu: ${c.savedRejectionVnd.toLocaleString('vi-VN')} đ`);
});

// Toàn bộ ứng viên phải được phép dùng tại HANG_III
assert(
  meroCandidates.every(c => c.allowedRanks.includes('HANG_III')),
  'Mọi ứng viên đề xuất cho Tuyến Huyện đều phải có HANG_III trong allowedRanks'
);

// Không được đề xuất lại Meropenem
assert(
  !meroCandidates.some(c => c.activeIngredient.toLowerCase().includes('meropenem')),
  'Không được gợi ý lại chính Meropenem'
);

// Kiểm tra ứng viên hàng đầu là nhóm Cephalosporin / Beta-lactam cùng nhóm ATC J01
const topMero = meroCandidates[0];
assert(topMero.atcCode.startsWith('J01'), `Ứng viên hàng đầu phải thuộc nhóm kháng sinh ATC J01 (Thực tế: ${topMero.atcCode})`);
assert(topMero.savedRejectionVnd === 4900000, `Tiền cứu xuất toán phải bằng 4.900.000 đ (Thực tế: ${topMero.savedRejectionVnd})`);


// -----------------------------------------------------------------------------
// CA 2: Trùng lặp PPI (Nexium + Omez) -> Gợi ý Thuốc bảo vệ niêm mạc (Sucralfat)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Kiểm thử Ca 2: Trùng lặp nhóm PPI -> Gợi ý bảo vệ niêm mạc (Sucralfat) ---');
const nexiumItem: BhytPrescriptionItem = {
  id: 'item-nexium',
  drugName: 'Nexium 40mg',
  activeIngredient: 'Esomeprazol',
  dosage: '40mg',
  route: 'Uống',
  quantity: 28,
  unitPrice: 22000,
  daysSupply: 14,
  instructions: 'Uống 1 viên trước ăn sáng'
};

const omezItem: BhytPrescriptionItem = {
  id: 'item-omez',
  drugName: 'Omez 20mg',
  activeIngredient: 'Omeprazol',
  dosage: '20mg',
  route: 'Uống',
  quantity: 28,
  unitPrice: 5000,
  daysSupply: 14,
  instructions: 'Uống 1 viên trước ăn tối'
};

const ppiViolation: BhytViolationItem = {
  id: 'v-ppi-dup',
  drugId: 'item-omez',
  drugCode: 'OME20',
  title: 'Trùng lặp nhóm tác dụng (PPI)',
  drugName: 'Omez 20mg',
  activeIngredient: 'Omeprazol',
  category: 'THERAPEUTIC_DUPLICATION',
  severity: 'REJECT',
  rejectionRiskVnd: 140000,
  detail: 'Trùng lặp nhóm ức chế bơm proton (PPI): Esomeprazol và Omeprazol.',
  action: 'Bỏ hoặc thay thế bằng thuốc kháng acid / bảo vệ niêm mạc dạ dày (Sucralfat, Antacid).',
  legalRef: {
    docCode: '3618/QĐ-BHXH',
    docTitle: 'Quyết định 3618/QĐ-BHXH',
    localPdfPath: '/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf',
    section: 'Điều 14 - Giám định tính hợp lý chỉ định',
    pageNumber: 22
  }
};

const ppiCandidates = findDrugSubstitutes(
  omezItem,
  ppiViolation,
  'HANG_II',
  'K21.0', // Trào ngược dạ dày thực quản
  [nexiumItem, omezItem]
);

assert(ppiCandidates.length > 0, `Phải tìm thấy thuốc thay thế cho Omeprazol khi đã có Nexium trong đơn (Tìm thấy: ${ppiCandidates.length})`);
console.log(`   -> Tìm thấy ${ppiCandidates.length} ứng viên:`);
ppiCandidates.slice(0, 3).forEach((c, idx) => {
  console.log(`      [${idx + 1}] ${c.drugName} (${c.activeIngredient}) - Điểm: ${c.score}`);
});

// Safety Gate: Không được gợi ý thêm bất kỳ PPI nào khác (Rabeprazol, Pantoprazol) vì Nexium vẫn đang có trong đơn!
const hasPpiInCandidates = ppiCandidates.some(c => {
  const rule = findBhytRule(c.activeIngredient);
  return rule?.atcGroup === 'A02BC';
});
assert(!hasPpiInCandidates, 'Pre-flight Safety Gate PHẢI ngăn chặn việc gợi ý một PPI khác khi trong đơn đã có Nexium');

// Kiểm tra có gợi ý Sucralfat / Nhôm phosphat
const hasSucralfate = ppiCandidates.some(c => c.activeIngredient.toLowerCase().includes('sucralfat'));
assert(hasSucralfate, 'Phải có Sucralfat trong danh sách gợi ý thay thế điều trị loét/trào ngược dạ dày');


// -----------------------------------------------------------------------------
// CA 3: Trùng lặp NSAID (Mobic + Celebrex) -> Gợi ý Paracetamol
// -----------------------------------------------------------------------------
console.log('\n--- 3. Kiểm thử Ca 3: Trùng lặp NSAID (Mobic + Celebrex) -> Gợi ý Paracetamol ---');
const mobicItem: BhytPrescriptionItem = {
  id: 'item-mobic',
  drugName: 'Mobic 7.5mg',
  activeIngredient: 'Meloxicam',
  dosage: '7.5mg',
  route: 'Uống',
  quantity: 20,
  unitPrice: 15000,
  daysSupply: 10,
  instructions: 'Uống 1 viên sau ăn'
};

const celebrexItem: BhytPrescriptionItem = {
  id: 'item-celebrex',
  drugName: 'Celebrex 200mg',
  activeIngredient: 'Celecoxib',
  dosage: '200mg',
  route: 'Uống',
  quantity: 20,
  unitPrice: 20000,
  daysSupply: 10,
  instructions: 'Uống 1 viên sau ăn'
};

const nsaidViolation: BhytViolationItem = {
  id: 'v-nsaid-dup',
  drugId: 'item-celebrex',
  drugCode: 'CEL200',
  title: 'Trùng lặp nhóm tác dụng (NSAID)',
  drugName: 'Celebrex 200mg',
  activeIngredient: 'Celecoxib',
  category: 'THERAPEUTIC_DUPLICATION',
  severity: 'REJECT',
  rejectionRiskVnd: 400000,
  detail: 'Trùng lặp 2 thuốc kháng viêm không steroid (NSAID): Meloxicam và Celecoxib.',
  action: 'Thay thế bằng thuốc giảm đau đơn thuần (Paracetamol).',
  legalRef: {
    docCode: '3618/QĐ-BHXH',
    docTitle: 'QĐ 3618/QĐ-BHXH',
    localPdfPath: '/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf',
    section: 'Điều 14',
    pageNumber: 22
  }
};

const nsaidCandidates = findDrugSubstitutes(
  celebrexItem,
  nsaidViolation,
  'HANG_II',
  'M17', // Thoái hóa khớp gối
  [mobicItem, celebrexItem]
);

assert(nsaidCandidates.length > 0, `Phải tìm thấy thuốc thay thế cho Celebrex (Tìm thấy: ${nsaidCandidates.length})`);

// Pre-flight Safety Gate: Không được gợi ý thêm NSAID nào khác (Ibuprofen, Diclofenac) vì Mobic đang trong đơn!
const hasOtherNsaid = nsaidCandidates.some(c => {
  const rule = findBhytRule(c.activeIngredient);
  return rule?.atcGroup === 'M01A';
});
assert(!hasOtherNsaid, 'Pre-flight Safety Gate PHẢI loại bỏ hoàn toàn các thuốc NSAID M01A khác khi Mobic đang có trong đơn');

// Phải có Paracetamol (N02BE01)
const hasParacetamol = nsaidCandidates.some(c => c.activeIngredient.toLowerCase().includes('paracetamol'));
assert(hasParacetamol, 'Phải gợi ý Paracetamol làm thuốc giảm đau thay thế an toàn');


// -----------------------------------------------------------------------------
// CA 4: Thuốc BHYT thanh toán một phần (Jardiance 50%) -> Gợi ý Thuốc 100% BHYT
// -----------------------------------------------------------------------------
console.log('\n--- 4. Kiểm thử Ca 4: Thuốc BHYT 50% (Jardiance) -> Gợi ý Thuốc đái tháo đường 100% BHYT ---');
const jardianceItem: BhytPrescriptionItem = {
  id: 'item-jardiance',
  drugName: 'Jardiance 10mg',
  activeIngredient: 'Empagliflozin',
  dosage: '10mg',
  route: 'Uống',
  quantity: 30,
  unitPrice: 25000,
  daysSupply: 30,
  instructions: 'Uống 1 viên buổi sáng'
};

const partialViolation: BhytViolationItem = {
  id: 'v-jardiance-partial',
  drugId: 'item-jardiance',
  drugCode: 'JAR10',
  title: 'Thuốc thanh toán BHYT 50%',
  drugName: 'Jardiance 10mg',
  activeIngredient: 'Empagliflozin',
  category: 'PARTIAL_PAYMENT_ALERT',
  severity: 'WARNING',
  rejectionRiskVnd: 375000,
  detail: 'Empagliflozin có tỷ lệ thanh toán BHYT là 50%.',
  action: 'Cân nhắc chuyển sang thuốc ĐTĐ týp 2 thanh toán 100% BHYT (Metformin, Gliclazid) nếu bệnh nhân khó khăn chi phí.',
  legalRef: {
    docCode: '20/2022/TT-BYT',
    docTitle: 'Thông tư 20/2022/TT-BYT',
    localPdfPath: '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf',
    section: 'Phụ lục I',
    pageNumber: 28
  }
};

const diabetesCandidates = findDrugSubstitutes(
  jardianceItem,
  partialViolation,
  'HANG_III',
  'E11', // Đái tháo đường týp 2
  [jardianceItem]
);

assert(diabetesCandidates.length > 0, `Phải tìm thấy thuốc ĐTĐ 100% BHYT thay thế cho Jardiance (Tìm thấy: ${diabetesCandidates.length})`);
// Mọi ứng viên đề xuất phải có tỷ lệ thanh toán 100% (paymentRatio === 1.0)
assert(
  diabetesCandidates.every(c => c.paymentRatio === 1.0),
  'Tất cả ứng viên thay thế cho thuốc 50% phải đạt tỷ lệ thanh toán BHYT 100%'
);

// Phải có Metformin hoặc Gliclazid
const hasMetforminOrGliclazide = diabetesCandidates.some(c => 
  c.activeIngredient.toLowerCase().includes('metformin') || 
  c.activeIngredient.toLowerCase().includes('gliclazid') ||
  c.activeIngredient.toLowerCase().includes('glimepirid')
);
assert(hasMetforminOrGliclazide, 'Phải có Metformin hoặc Sulfonylurea trong danh sách gợi ý thuốc ĐTĐ 100% BHYT');


// -----------------------------------------------------------------------------
// CA 5: Tương tác thuốc chống chỉ định (Pre-flight Safety Gate)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Kiểm thử Ca 5: Pre-flight Safety Gate ngăn chặn tương tác chống chỉ định ---');
// Giả sử trong đơn có Enalapril (ACEI)
const enalaprilItem: BhytPrescriptionItem = {
  id: 'item-enalapril',
  drugName: 'Enalapril 5mg',
  activeIngredient: 'Enalapril',
  dosage: '5mg',
  route: 'Uống',
  quantity: 30,
  unitPrice: 1200,
  daysSupply: 30,
  instructions: 'Uống 1 viên'
};

const dummyItem: BhytPrescriptionItem = {
  id: 'item-bp-reject',
  drugName: 'Thuốc hạ áp ngoài thầu',
  activeIngredient: 'Unknown Drug',
  dosage: '10mg',
  route: 'Uống',
  quantity: 30,
  unitPrice: 15000,
  daysSupply: 30,
  instructions: 'Uống'
};

const dummyViolation: BhytViolationItem = {
  id: 'v-dummy',
  drugId: 'item-bp-reject',
  drugCode: 'BPOUT',
  title: 'Thuốc ngoài thầu BHYT',
  drugName: 'Thuốc hạ áp ngoài thầu',
  activeIngredient: 'Unknown Drug',
  category: 'HOSPITAL_RANK_MISMATCH',
  severity: 'REJECT',
  rejectionRiskVnd: 450000,
  detail: 'Thuốc không có trong thầu.',
  action: 'Thay thế bằng thuốc tim mạch hợp lệ.',
  legalRef: {
    docCode: '20/2022/TT-BYT',
    docTitle: 'Thông tư 20/2022/TT-BYT',
    localPdfPath: '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf',
    section: 'Điều 4',
    pageNumber: 1
  }
};

const bpCandidates = findDrugSubstitutes(
  dummyItem,
  dummyViolation,
  'HANG_II',
  'I10', // Tăng huyết áp vô căn
  [enalaprilItem, dummyItem]
);

// Safety Gate: Vì trong đơn đã có Enalapril (ACEI - C09AA), ứng viên KHÔNG được chứa nhóm ARB (Losartan, Telmisartan - C09CA)
// vì phối hợp song trùng RAAS bị chống chỉ định theo khuyến cáo ACC/AHA & BYT!
const hasArbWithAcei = bpCandidates.some(c => {
  const rule = findBhytRule(c.activeIngredient);
  return rule?.atcGroup === 'C09CA';
});
assert(!hasArbWithAcei, 'Pre-flight Safety Gate PHẢI ngăn chặn gợi ý ARB (Losartan) khi đơn thuốc đã có ACEI (Enalapril)');

console.log('\n======================================================================');
console.log('🎉 TOÀN BỘ 5 CA KIỂM THỬ THUẬT TOÁN GỢI Ý THAY THẾ THUỐC BHYT ĐÃ ĐẠT 100% GREEN!');
console.log('======================================================================\n');
