import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validatePrescriptionDraft } from '../src/services/prescriptionValidation';

const valid = { patientName: 'Nguyen Van A', diagnosisText: 'Viem hong', items: [{ medicationName: 'Paracetamol 500mg', dosage: '1 vien', frequency: '2 lan/ngay', route: 'Uong', quantity: 10, durationDays: 3 }] };

test('accepts a complete prescription draft', () => {
  assert.deepEqual(validatePrescriptionDraft(valid), []);
});

test('reports missing patient, diagnosis, and medication instructions', () => {
  const errors = validatePrescriptionDraft({ patientName: '', diagnosisText: '', items: [{ ...valid.items[0], medicationName: '', dosage: '', frequency: '', quantity: 0, durationDays: 0 }] });
  assert.ok(errors.some((e) => e.includes('người bệnh')));
  assert.ok(errors.some((e) => e.includes('chẩn đoán')));
  assert.ok(errors.some((e) => e.includes('thuốc')));
});

test('reports missing medicine collection and does not accept invented defaults', () => {
  const errors = validatePrescriptionDraft({ patientName: 'A', diagnosisText: 'B', items: [] });
  assert.ok(errors.some((e) => e.includes('ít nhất một thuốc')));
});

test('validates every medicine in a multi-item prescription independently', () => {
  const errors = validatePrescriptionDraft({
    patientName: 'A', diagnosisText: 'B',
    items: [valid.items[0], { ...valid.items[0], medicationName: 'Amoxicillin', dosage: '' }],
  });
  assert.ok(errors.some((error) => error.includes('Thuốc 2: cần ghi liều')));
});
