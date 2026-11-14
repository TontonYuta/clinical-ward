import { parsePrescriptionText } from '../src/services/bhytIngestion';
import { auditBhytPrescription } from '../src/services/bhytAuditEngine';

const parsed = parsePrescriptionText('Thuốc: Paracetamol\nChẩn đoán: Đau đầu');
if (parsed.insuranceCardNumber !== '') throw new Error('Missing insurance card must stay empty');
if (parsed.patientAge !== 0) throw new Error('Missing age must stay unknown');
if (parsed.primaryIcd10 !== '') throw new Error('Missing ICD-10 must stay unknown');
if (parsed.primaryDiagnosis !== 'Đau đầu') throw new Error('Parsed diagnosis must be preserved');
if (parsed.items.some((item) => item.quantity > 0 || item.unitPrice > 0 || item.daysSupply || item.dosage)) {
  throw new Error('Missing medication values must not be fabricated');
}

const incomplete = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '', hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: '', primaryDiagnosis: '', items: [{ id: 'x', drugName: 'Paracetamol', activeIngredient: 'Paracetamol', dosage: '', route: '', quantity: 0, unitPrice: 0 }],
});
if (incomplete.status !== 'NEEDS_REVIEW') throw new Error(`Expected NEEDS_REVIEW, got ${incomplete.status}`);
if (incomplete.rejectCount !== 0) throw new Error('Missing data must not create a rejection');
if (!incomplete.violations.some(v => v.category === 'MISSING_DATA')) throw new Error('Missing data must be explained');
if (incomplete.atRiskCostVnd !== 0) throw new Error('Unknown costs must not become rejection risk');
console.log('Missing data audit checks passed');
