import assert from 'node:assert/strict';
import { fitDocumentScale } from '../src/components/Modals/PrintableForms/formModel';
assert.ok(
  Math.abs(fitDocumentScale(355) - 355 / 794) < 0.001,
  'fit is calculated from actual available width',
);
assert.equal(fitDocumentScale(1400), 1, 'fit does not enlarge an A4 page');
assert.equal(fitDocumentScale(0), 1, 'unmeasured viewport gets stable natural size');
assert.ok(fitDocumentScale(375) > 0);
console.log('Printable forms sizing checks passed');
