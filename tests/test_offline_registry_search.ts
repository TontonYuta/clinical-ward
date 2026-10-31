import assert from 'node:assert/strict';
import { queryOfflineRegistry } from '../src/components/Modals/NationalDrugRegistry/offlineRegistry';

const originalFetch = globalThis.fetch;
const products = [
  { id: 'b', nationalCode: 'SDK-B', brandName: 'Para 500', activeIngredient: 'Paracetamol', strength_raw: '500 mg', dosageForm: 'Viên nén', atcCode: 'N02BE01' },
  { id: 'a', nationalCode: 'SDK-A', brandName: 'Paracetamol Brand', activeIngredient: 'Paracetamol', strength_raw: '250 mg', dosageForm: 'Viên', atcCode: 'N02BE01' },
  { id: 'c', nationalCode: 'VN-EXACT-1', brandName: 'Other medicine', activeIngredient: 'Ibuprofen', strength_raw: '200 mg', dosageForm: 'Viên', atcCode: 'M01AE01' },
];
globalThis.fetch = async () => new Response(JSON.stringify(products), { status: 200, headers: { 'Content-Type': 'application/json' } });
try {
  const normalized = await queryOfflineRegistry('paracetamol 500mg', 'all', 'all', 1, 12);
  assert.equal(normalized.total, 1, 'accent-insensitive multi-token query includes strength');
  assert.equal(normalized.items[0].nationalCode, 'SDK-B');
  const code = await queryOfflineRegistry('VN-EXACT-1', 'all', 'all', 1, 12);
  assert.equal(code.items[0].nationalCode, 'VN-EXACT-1', 'registration-code lookup selects exact product');
  const unknown = await queryOfflineRegistry('nonexistent medicine', 'all', 'all', 1, 12);
  assert.equal(unknown.total, 0, 'unknown query returns no candidates');
  console.log('offline registry search checks passed');
} finally { globalThis.fetch = originalFetch; }
