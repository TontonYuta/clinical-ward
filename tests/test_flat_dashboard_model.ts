import assert from 'node:assert/strict';
import { canSearchPatients, normalizeLookupQuery, canSearchMedications } from '../src/components/RightPane/flatDashboardModel';

assert.equal(canSearchPatients('doctor'), true);
assert.equal(canSearchPatients('pharmacist'), false);
assert.equal(canSearchMedications('nurse'), true);
assert.equal(normalizeLookupQuery('  Ceftriaxon 1g  '), 'Ceftriaxon 1g');
assert.equal(normalizeLookupQuery('   '), '');
console.log('flat dashboard model checks passed');
