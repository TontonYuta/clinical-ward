import { sanitizeOcrPrescriptionPayload } from '../src/utils/bhytSanitizer';

const result = sanitizeOcrPrescriptionPayload({ items: [{ drug_name: 'Paracetamol' }] }, '', '');
if (result.patientAge !== 0) throw new Error('Sanitizer fabricated patient age');
if (result.hospitalRank !== '' || result.treatmentType !== '') throw new Error('Sanitizer fabricated treatment context');
const item = result.items[0];
if (item.quantity !== 0 || item.daysSupply !== undefined || item.route !== '' || item.unit !== undefined) {
  throw new Error(`Sanitizer fabricated item fields: ${JSON.stringify(item)}`);
}
if (item.hasConsultationForm !== undefined) throw new Error('Sanitizer fabricated consultation state');
console.log('BHYT sanitizer missing data checks passed');
