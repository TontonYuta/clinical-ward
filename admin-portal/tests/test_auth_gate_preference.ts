import assert from 'node:assert/strict';
import { clearMonitorPrivateCache, readAuthGatePreference, saveAuthGatePreference } from '../src/services/authGatePreference';

const data = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } },
});

assert.equal(readAuthGatePreference(), true, 'login gate defaults to enabled');
saveAuthGatePreference(false);
assert.equal(readAuthGatePreference(), false, 'disabled preference persists');
saveAuthGatePreference(true);
assert.equal(readAuthGatePreference(), true, 'enabled preference persists');
data.set('clinical_ai_monitor_telemetry_cache_v2', 'private');
clearMonitorPrivateCache();
assert.equal(data.has('clinical_ai_monitor_telemetry_cache_v2'), false, 'private cache is cleared on unauthenticated state');
console.log('auth gate preference tests passed');
