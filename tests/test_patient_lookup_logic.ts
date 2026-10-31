import assert from 'node:assert/strict';
import { findPatientByNameOrQuery, findPatientsByQuery, INITIAL_PATIENTS } from '../src/services/patientService';

assert.equal(findPatientByNameOrQuery('BN-8820')?.fullName, 'Võ Minh Trí');
assert.equal(findPatientByNameOrQuery('vo minh tri')?.id, 'BN-8820');
assert.equal(findPatientByNameOrQuery('Võ Minh Trí (BN-8820)')?.id, 'BN-8820');
assert.equal(findPatientByNameOrQuery('An'), undefined, 'short ambiguous names must not resolve to a patient');
assert.equal(findPatientByNameOrQuery('patient unknown'), undefined, 'unknown patients must not fall back to first record');
assert.equal(findPatientByNameOrQuery('xyz'), undefined, 'unknown partial names must not resolve');
const duplicatePatients = [INITIAL_PATIENTS[0], { ...INITIAL_PATIENTS[1], fullName: INITIAL_PATIENTS[0].fullName, id: 'BN-9999' }];
assert.equal(findPatientByNameOrQuery('Võ Minh Trí', duplicatePatients), undefined, 'duplicate exact names must be ambiguous');
assert.deepEqual(findPatientsByQuery('Võ Minh Trí', duplicatePatients).map((p) => p.id), ['BN-8820', 'BN-9999']);
assert.equal(findPatientByNameOrQuery('BN-9999', duplicatePatients)?.id, 'BN-9999', 'unique patient ID disambiguates duplicate names');
const unique = [{ ...INITIAL_PATIENTS[0], fullName: 'Unique Patient' }];
assert.equal(findPatientByNameOrQuery('Unique', unique)?.id, 'BN-8820');
console.log('patient lookup logic checks passed');
