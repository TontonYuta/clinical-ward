import assert from 'node:assert/strict';
import { getInitialTab } from '../src/utils/storage/appStatePersistence';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { location: { hash: '', pathname: '/' }, history: { replaceState() {} } },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
});

assert.equal(getInitialTab(), 'overview', 'new users should land on the operations overview');
window.location.hash = '#cpoe';
assert.equal(getInitialTab(), 'cpoe', 'valid deep links should keep precedence');
window.location.hash = '';
localStorage.setItem('clinical_current_tab', 'fefo');
assert.equal(getInitialTab(), 'fefo', 'valid saved module should be restored');
console.log('operations overview navigation checks passed');
