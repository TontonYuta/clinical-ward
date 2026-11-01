import assert from 'node:assert/strict';
import { fontScaleToPixels } from '../src/components/Settings/fontScaleModel';
import { getInitialFontScale, saveFontScale } from '../src/utils/storage/appStatePersistence';

assert.equal(fontScaleToPixels('compact'), 18.2);
assert.equal(fontScaleToPixels('standard'), 20.8);
assert.equal(fontScaleToPixels('large'), 23.4);
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
assert.equal(getInitialFontScale(), 'large');
saveFontScale('compact');
assert.equal(getInitialFontScale(), 'compact');
console.log('font scale model checks passed');
