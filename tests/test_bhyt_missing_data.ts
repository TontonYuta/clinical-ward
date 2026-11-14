import { parsePrescriptionText } from '../src/services/bhytIngestion';
import { auditBhytPrescription } from '../src/services/bhytAuditEngine';

const parsed = parsePrescriptionText('Thuốc: Paracetamol\nChẩn đoán: Đau đầu');
if (parsed.insuranceCardNumber !== '') throw new Error('Missing insurance card must stay empty');
if (parsed.patientAge !== 0) throw new Error('Missing age must stay unknown');
if (parsed.primaryIcd10 !== '') throw new Error('Missing ICD-10 must stay unknown');
if (parsed.primaryDiagnosis !== 'Đau đầu') throw new Error('Parsed diagnosis must be preserved');
if (parsed.hospitalRank !== '') throw new Error('Hospital rank must not default when absent from source');
if (parsed.treatmentType !== '') throw new Error('Treatment type must not default when absent from source');
if (parsed.items.some((item) => item.quantity > 0 || item.unitPrice > 0 || item.daysSupply || item.dosage)) {
  throw new Error('Missing medication values must not be fabricated');
}

const incomplete = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '', hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: '', primaryDiagnosis: '', items: [{ id: 'x', drugName: 'Paracetamol', activeIngredient: 'Paracetamol', dosage: '', route: '', quantity: 0, unitPrice: 0 }],
});
if (incomplete.status !== 'NEEDS_REVIEW') throw new Error(`Expected NEEDS_REVIEW, got ${incomplete.status}`);
if (incomplete.rejectCount !== 0) throw new Error('Missing data must not create a rejection');
if (incomplete.violations.some(v => v.category === 'MISSING_DATA')) throw new Error('Missing data must not be represented as a violation');
if (!incomplete.missingFields?.length) throw new Error('Missing fields must be preserved separately for review');
if (incomplete.atRiskCostVnd !== 0) throw new Error('Unknown costs must not become rejection risk');
console.log('Missing data audit checks passed');

const oral = parsePrescriptionText('1. Paracetamol 500mg, uống 1 viên x 2 lần/ngày, số lượng 10 viên');
if (oral.items[0]?.route !== 'Uống') throw new Error(`Expected oral route to be parsed, got ${oral.items[0]?.route}`);

const unknownCatalogDrug = auditBhytPrescription({
  patientName: 'Người bệnh', patientAge: 40, insuranceCardNumber: 'GD1234567890123', hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: 'R51', primaryDiagnosis: 'Đau đầu', items: [{ id: 'unknown', drugName: 'Unknown clinically named medicine', activeIngredient: 'Unknown clinically named medicine', dosage: '10mg', route: 'Uống', quantity: 10, unitPrice: 1000, daysSupply: 5 }],
});
if (unknownCatalogDrug.status !== 'NEEDS_REVIEW') throw new Error('Unmatched item in a partial catalog must be reviewed, not rejected');
if (unknownCatalogDrug.rejectCount !== 0) throw new Error('Catalog lookup miss is not proof of a coverage violation');

const routineParacetamolBHYT = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '', hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: '', primaryDiagnosis: '', items: [{ id: 'para-routine', drugName: 'Paracetamol', activeIngredient: 'Paracetamol', dosage: '', route: 'Uống', quantity: 10, unitPrice: 0 }],
});
if (routineParacetamolBHYT.status === 'NEEDS_REVIEW') throw new Error('Routine Paracetamol coverage must not require unrelated patient billing fields or an ICD rule that does not apply');
if (routineParacetamolBHYT.missingFields?.some((field) => ['insuranceCardNumber', 'patientAge', 'primaryDiagnosis', 'unitPrice', 'dosage'].includes(field))) {
  throw new Error('Non-decision fields must not block BHYT coverage review');
}

const conditionalIcdDrug = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '', hospitalRank: 'HANG_III', treatmentType: 'NGOAI_TRU',
  primaryIcd10: '', primaryDiagnosis: '', items: [{ id: 'alpha', drugName: 'Alpha Chymotrypsin', activeIngredient: 'Alpha Chymotrypsin', dosage: '4.2mg', route: 'Uống', quantity: 10, unitPrice: 0, daysSupply: 5 }],
});
if (conditionalIcdDrug.status !== 'NEEDS_REVIEW' || !conditionalIcdDrug.missingFields?.includes('primaryIcd10')) throw new Error('Missing ICD-10 must require review when the matched BHYT rule has ICD conditions');

const ordinaryPrescription = auditBhytPrescription({
  patientName: '', patientAge: 0, insuranceCardNumber: '', hospitalRank: '', treatmentType: '',
  primaryIcd10: '', primaryDiagnosis: '', items: [{ id: 'ordinary', drugName: 'Paracetamol', activeIngredient: 'Paracetamol', dosage: '500mg', route: 'Uống', quantity: 10, unitPrice: 0 }],
}, { mode: 'prescription' });
if (ordinaryPrescription.missingFields?.some((field) => ['unitPrice', 'insuranceCardNumber', 'primaryIcd10', 'hospitalRank', 'treatmentType'].includes(field))) {
  throw new Error('Ordinary prescriptions must not require BHYT administrative or pricing fields');
}
if (ordinaryPrescription.status === 'REJECT') throw new Error('Ordinary prescription missing payment fields must not be rejected');
