import assert from 'node:assert/strict';
import type { FeatureFlagResponse } from '../src/types/admin';
import { rebaseFeatureFlagDraft } from '../src/utils/featureFlagMerge.ts';

const base: FeatureFlagResponse = { version: 2, flags: [
  { key: 'overview', label: 'Overview', description: '', enabled: true },
  { key: 'cpoe', label: 'CPOE', description: '', enabled: true },
  { key: 'fefo', label: 'Inventory', description: '', enabled: true },
  { key: 'documents', label: 'Documents', description: '', enabled: true },
  { key: 'bhyt_audit', label: 'Insurance', description: '', enabled: true },
] };
const draft: FeatureFlagResponse = { ...base, flags: base.flags.map((flag) => flag.key === 'bhyt_audit' ? { ...flag, enabled: false } : flag) };
const latest: FeatureFlagResponse = { ...base, version: 3, flags: base.flags.map((flag) => flag.key === 'documents' ? { ...flag, enabled: false } : flag) };
const rebased = rebaseFeatureFlagDraft(base, draft, latest);
assert.equal(rebased.version, 3);
assert.equal(rebased.flags.find((flag) => flag.key === 'bhyt_audit')?.enabled, false);
assert.equal(rebased.flags.find((flag) => flag.key === 'documents')?.enabled, false);
assert.equal(rebased.flags.find((flag) => flag.key === 'overview')?.enabled, true);
console.log('feature flag merge tests passed');
