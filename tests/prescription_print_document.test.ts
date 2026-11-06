import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatPrescriptionQuantity } from '../src/components/RightPane/Tabs/CPOE/PrescriptionPrintDocument';

test('formats single digit prescription quantities with a leading zero', () => {
  assert.equal(formatPrescriptionQuantity(5), '05');
});

test('preserves ordinary quantity without padding', () => {
  assert.equal(formatPrescriptionQuantity(12), '12');
});

test('writes controlled medicine quantity in Vietnamese words', () => {
  assert.equal(formatPrescriptionQuantity(5, true), '05 (năm)');
});
