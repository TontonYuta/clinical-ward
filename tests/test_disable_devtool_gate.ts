import assert from 'node:assert/strict';
import { shouldEnableDevtool } from '../src/security/disableDevtool';

assert.equal(shouldEnableDevtool(true, true), true);
assert.equal(shouldEnableDevtool(true, false), false);
assert.equal(shouldEnableDevtool(false, true), false);
assert.equal(shouldEnableDevtool(true, true, 'production'), true);
assert.equal(shouldEnableDevtool(true, true, 'true'), false);
assert.equal(shouldEnableDevtool(true, true, '1'), false);
assert.equal(shouldEnableDevtool(true, true, '0'), true);
console.log('disable-devtool production gate checks passed');
