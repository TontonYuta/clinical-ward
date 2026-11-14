import assert from 'node:assert/strict';
import { fontScaleToPixels } from '../src/components/Settings/fontScaleModel';
import { getInitialFontScale, saveFontScale } from '../src/utils/storage/appStatePersistence';

assert.equal(fontScaleToPixels(12), 12);
assert.equal(fontScaleToPixels(18.5), 18.5);
assert.equal(fontScaleToPixels(30), 24);
assert.equal(fontScaleToPixels('compact'), 14.5);
assert.equal(fontScaleToPixels('standard'), 16);
assert.equal(fontScaleToPixels('large'), 17.5);
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
assert.equal(getInitialFontScale(), 16);
store.set('clinical_font_scale', 'large');
assert.equal(getInitialFontScale(), 17.5);
saveFontScale(19.5);
assert.equal(getInitialFontScale(), 19.5);
assert.equal(store.get('clinical_font_scale'), '19.5');
console.log('font scale model checks passed');
