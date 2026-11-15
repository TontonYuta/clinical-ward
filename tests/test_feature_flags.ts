import assert from 'node:assert/strict';
import { DEFAULT_FEATURE_FLAGS, getEffectiveAllowedTabs, isValidFeatureFlagPayload, normalizeFeatureFlags } from '../src/services/featureFlags';

const disabled = normalizeFeatureFlags({
  version: 4,
  flags: DEFAULT_FEATURE_FLAGS.map((flag) => ({ ...flag, enabled: flag.key !== 'bhyt_audit' })),
});

assert.equal(disabled.version, 4);
assert.equal(disabled.flags.find((flag) => flag.key === 'bhyt_audit')?.enabled, false);
assert.equal(disabled.flags.find((flag) => flag.key === 'overview')?.enabled, true);
assert.equal(isValidFeatureFlagPayload({ version: 4, flags: [{ key: 'overview', enabled: false }] }), false);
assert.deepEqual(getEffectiveAllowedTabs('doctor', disabled), ['overview', 'cpoe', 'fefo', 'documents']);
assert.deepEqual(getEffectiveAllowedTabs('doctor', null), ['overview', 'cpoe', 'bhyt_audit', 'fefo', 'documents']);
console.log('feature flags tests passed');
