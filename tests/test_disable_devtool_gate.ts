import assert from 'node:assert/strict';
import { shouldEnableDevtool } from '../src/security/disableDevtool';

assert.equal(shouldEnableDevtool(true, true), true);
assert.equal(shouldEnableDevtool(true, false), false);
assert.equal(shouldEnableDevtool(false, true), false);
console.log('disable-devtool production gate checks passed');
