import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditBhytPrescription } from '../src/services/bhytAuditEngine';

const report = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '',
  hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'Z00', primaryDiagnosis: 'Khám sức khỏe', secondaryIcd10s: [],
  items: [
    { id: 'restricted', drugCode: 'MERO', drugName: 'Meropenem', activeIngredient: 'Meropenem', dosage: '1g', route: 'tiêm', quantity: 1, unitPrice: 100 },
    { id: 'eligible', drugCode: 'PARA', drugName: 'Paracetamol', activeIngredient: 'Paracetamol', dosage: '500mg', route: 'uống', quantity: 1, unitPrice: 50 },
  ],
});

assert.ok(report.violations.filter((violation) => violation.drugCode === 'MERO').length > 1);
assert.equal(report.atRiskCostVnd, 100, 'xuất toán cùng một dòng không vượt giá trị dòng đó');
assert.equal(report.passCount, 1, 'đếm số dòng thuốc đạt, không trừ số lượng vi phạm');

const source = fs.readFileSync('src/components/RightPane/Tabs/BhytAuditTab.tsx', 'utf8');
assert.ok(!source.includes('NGUYỄN VĂN AN'), 'không đưa danh tính mẫu vào báo cáo xuất');
assert.ok(!source.includes('DN4010123456789'), 'không đưa mã thẻ mẫu vào báo cáo xuất');
assert.ok(!source.includes("'RX-2026'"), 'không đưa mã đơn mẫu vào báo cáo xuất');
console.log('BHYT audit accounting checks passed');
