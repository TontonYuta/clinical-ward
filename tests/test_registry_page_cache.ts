import assert from 'node:assert/strict';
import { createRegistryPageCacheKey } from '../src/utils/storage/registryPageCache';

const base = { search: '  AmoxiCillin ', group: 'all', pharmGroup: 'all', page: 1, pageSize: 12, onlyInWarehouse: false };
assert.equal(createRegistryPageCacheKey(base), createRegistryPageCacheKey({ ...base, search: 'amoxicillin' }));
assert.notEqual(createRegistryPageCacheKey(base), createRegistryPageCacheKey({ ...base, page: 2 }));
assert.notEqual(createRegistryPageCacheKey(base), createRegistryPageCacheKey({ ...base, onlyInWarehouse: true }));
