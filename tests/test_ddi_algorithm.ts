/**
 * Unit Test for Client-Side Clinical DDI Algorithm (<=180 LOC)
 */
import { evaluatePairDdi, auditPrescriptionList, normalizeDrug } from '../src/utils/clinical/ddiAlgorithm';

console.log('=== TEST CLINICAL DDI ALGORITHM (CLIENT-SIDE) ===');

// 1. Test Normalization
const ent1 = normalizeDrug('Plavix 75mg uống');
if (ent1.inn !== 'clopidogrel' || !ent1.classes.includes('P2Y12')) {
  throw new Error(`Normalization failed for Plavix: ${JSON.stringify(ent1)}`);
}
console.log('✅ Normalizer: Plavix -> Clopidogrel (P2Y12)');

const ent2 = normalizeDrug('Nexium 40mg');
if (ent2.inn !== 'esomeprazol' || !ent2.classes.includes('PPI_CYP2C19')) {
  throw new Error(`Normalization failed for Nexium: ${JSON.stringify(ent2)}`);
}
console.log('✅ Normalizer: Nexium -> Esomeprazol (PPI_CYP2C19)');

// 2. Test Contraindicated DDI Pair
const alertPlavixNexium = evaluatePairDdi('Plavix 75mg', 'Nexium 40mg');
if (!alertPlavixNexium || alertPlavixNexium.severity !== 'CONTRAINDICATED') {
  throw new Error('DDI failed for Plavix + Nexium');
}
console.log('✅ DDI Pair: Plavix + Nexium -> CONTRAINDICATED');

const alertNitroViagra = evaluatePairDdi('Nitroglycerin', 'Viagra');
if (!alertNitroViagra || alertNitroViagra.severity !== 'CONTRAINDICATED') {
  throw new Error('DDI failed for Nitroglycerin + Viagra');
}
console.log('✅ DDI Pair: Nitroglycerin + Viagra -> CONTRAINDICATED');

// 3. Test Safe Synergy
const alertMorphinPara = evaluatePairDdi('Morphin 10mg', 'Paracetamol 500mg');
if (!alertMorphinPara || alertMorphinPara.severity !== 'SAFE_SYNERGY') {
  throw new Error('Safe synergy failed for Morphin + Paracetamol');
}
console.log('✅ Safe Synergy: Morphin + Paracetamol -> SAFE_SYNERGY');

// 4. Test Dynamic Patient Escalation
const normalAmiodColch = evaluatePairDdi('Amiodaron', 'Colchicin', { egfr: 90 });
if (!normalAmiodColch || normalAmiodColch.severity !== 'MAJOR' || normalAmiodColch.escalated) {
  throw new Error('Amiodaron + Colchicin normal eGFR failed');
}
console.log('✅ Patient Escalation Baseline: Amiodaron + Colchicin -> MAJOR');

const renalAmiodColch = evaluatePairDdi('Amiodaron', 'Colchicin', { egfr: 25 });
if (!renalAmiodColch || renalAmiodColch.severity !== 'CONTRAINDICATED' || !renalAmiodColch.escalated) {
  throw new Error('Amiodaron + Colchicin renal escalation failed');
}
console.log('✅ Patient Escalation Escalated: Amiodaron + Colchicin (eGFR=25) -> CONTRAINDICATED');

// 5. Test Polypharmacy: Cumulative QTc & Triple Whammy
const polyRes = auditPrescriptionList(['Cordarone', 'Klacid', 'Cravit']);
const hasQt = polyRes.poly.some(p => p.ruleId === 'POLY_QT');
if (!hasQt) {
  throw new Error('Cumulative QTc polypharmacy alert not generated');
}
console.log('✅ Polypharmacy: Cumulative QTc alert verified');

const twRes = auditPrescriptionList(['Renitec', 'Lasix', 'Voltaren']);
const hasTw = twRes.poly.some(p => p.ruleId === 'POLY_TRIPLE_WHAMMY');
if (!hasTw) {
  throw new Error('Triple Whammy polypharmacy alert not generated');
}
console.log('✅ Polypharmacy: Triple Whammy alert verified');

console.log('🎉 ALL CLIENT DDI ALGORITHM TESTS PASSED 100%!');
